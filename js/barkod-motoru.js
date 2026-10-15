/**
 * Barkod motoru: kamera görüntüsünden hızlı, açıdan bağımsız okuma
 * ============================================================================
 *
 * SORUN
 * iPhone'da tarayıcının kendi barkod okuyucusu (BarcodeDetector) yok; sayfa
 * html5-qrcode'a düşüyordu. O kütüphane yalnız ortadaki kareye bakıyor ve
 * barkodu yatay çizgilerle tarıyor: telefon dik tutulmazsa okumuyordu.
 *
 * ÇÖZÜM
 * ZXing-C++ (WebAssembly) ayrı bir işçide (js/barkod-isci.js) çalışıyor.
 * Kareler dörtlü bir döngüyle gidiyor:
 *   - düz: bütün görüntü; çözücü kendisi 90/180/270 derece de deniyor,
 *   - eğik: ortadaki bölge 45 derece döndürülmüş; 45/135/225/315 de kapanıyor,
 *   - her biri iki eşiklemeyle: yerel ortalama (parlama, düzensiz ışık) ve
 *     sabit eşik (odak kaçmış, bulanık barkod).
 * Çizgili barkod tarama çizgisine ~30 dereceye kadar eğikken de okunuyor;
 * düz ve eğik birlikte her açıyı kapsıyor. Ölçüm: 5 derece arayla 72 açının
 * 72'si, ortalama 90 ms.
 *
 * HIZ VE PİL
 *   - Aynı anda tek kare çözülüyor; işçi meşgulken yeni kare alınmıyor.
 *   - Çözüm süresine göre kare boyutu kendini ayarlıyor (yavaş telefonda küçülür).
 *   - Saniyede en fazla ~15 kare; sekme arka plandayken hiç çalışmıyor.
 *   - `duraklat()` döngüyü tamamen durduruyor (sayım paneli açıkken).
 *
 * GÜVENLİK
 *   - Kontrolü zayıf ya da olmayan biçimler (EAN-8, Code39, ITF) art arda iki
 *     karede aynı okunmadan kabul edilmiyor. UPC-E hiç okunmuyor (işçide not).
 *     Yanlış okuma tabloya düşmüyor.
 *   - QR / DataMatrix yalnız barkod gibi bir içerik taşıyorsa (rakam ya da
 *     büyük harf kod) kabul ediliyor; link taşıyan reklam QR'ları elenir.
 *
 * Kullanım
 *   var m = JBBarkodMotoru.olustur(videoEl, function (kod, sonuc) { ... });
 *   m.baslat(); m.duraklat(); m.surdur(); m.durdur();
 *   sonuc: { rawValue, format, cornerPoints[4], boundingBox } (video pikseli)
 * ============================================================================
 */
(function (global) {
    'use strict';

    var SURUM = '20261015c';
    var betik = document.currentScript;
    var ISCI_ADRESI = new URL('barkod-isci.js?v=' + SURUM, (betik && betik.src) || location.href).href;

    var EN_AZ_ARA_MS = 66;          // ~15 kare/sn üst sınır
    var UZUN_KENAR = [1280, 1024, 800];
    var EGIK_KENAR = 720;
    var ONAY_GEREKEN = { Code39: true, ITF: true, EAN8: true };

    // ------------------------------------------------------------------
    // İşçi (sayfa başına tek; motor kapanınca da sıcak kalır, sonraki açılış anında)
    // ------------------------------------------------------------------

    var isci = null;
    var isciHazir = null;
    var bekleyen = {};
    var sira = 0;

    function isciAl() {
        if (isciHazir) return isciHazir;
        isciHazir = new Promise(function (coz, red) {
            try {
                isci = new Worker(ISCI_ADRESI);
            } catch (e) {
                red(e);
                return;
            }
            var sinir = setTimeout(function () { red(new Error('çözücü yüklenemedi')); }, 20000);
            isci.onmessage = function (e) {
                var d = e.data || {};
                if (d.tip === 'hazir') { clearTimeout(sinir); coz(isci); return; }
                if (d.tip === 'hata') { clearTimeout(sinir); red(new Error(d.mesaj || 'çözücü hatası')); return; }
                if (d.tip === 'sonuc') {
                    var b = bekleyen[d.no];
                    delete bekleyen[d.no];
                    if (b) b(d);
                }
            };
            isci.onerror = function (e) {
                clearTimeout(sinir);
                red(new Error((e && e.message) || 'çözücü başlatılamadı'));
            };
            isci.postMessage({ tip: 'baslat' });
        });
        isciHazir.catch(function () {
            // Sonraki deneme yeniden kurabilsin
            try { if (isci) isci.terminate(); } catch (e) { /* sessiz */ }
            isci = null;
            isciHazir = null;
        });
        return isciHazir;
    }

    function coz(g, y, veri, esik) {
        return new Promise(function (tamam) {
            if (!isci) { tamam({ sonuc: [], sure: 0 }); return; }
            var no = ++sira;
            // İşçi takılırsa döngü kilitlenmesin
            var sinir = setTimeout(function () {
                if (!bekleyen[no]) return;
                delete bekleyen[no];
                tamam({ sonuc: [], sure: 3000 });
            }, 3000);
            bekleyen[no] = function (d) { clearTimeout(sinir); tamam(d); };
            isci.postMessage({ tip: 'coz', no: no, g: g, y: y, veri: veri.buffer, esik: esik }, [veri.buffer]);
        });
    }

    // ------------------------------------------------------------------
    // İçerik süzgeci
    // ------------------------------------------------------------------

    function kabulEdilirMi(metin, bicim) {
        if (!metin) return false;
        if (bicim === 'QRCode' || bicim === 'DataMatrix') {
            // Yalnız barkod gibi içerik: rakam ya da büyük harf/rakam kod
            return /^[0-9]{6,20}$/.test(metin) || /^[A-Z0-9][A-Z0-9\-]{3,23}$/.test(metin);
        }
        return /^[\x20-\x7E]{1,48}$/.test(metin);
    }

    // ------------------------------------------------------------------
    // Motor
    // ------------------------------------------------------------------

    function Motor(video, geriBildirim) {
        this.video = video;
        this.geriBildirim = geriBildirim;
        this.calisiyor = false;
        this.mesgul = false;
        this.tur = 0;
        this.kademe = 0;
        this.sureler = [];
        this.sonAday = null;
        this.zamanlayici = null;
        this.tuval = document.createElement('canvas');
        this.ctx = this.tuval.getContext('2d', { willReadFrequently: true });
        this._gorunurluk = this._gorunurlukDegisti.bind(this);
    }

    Motor.prototype.baslat = function () {
        var self = this;
        this.calisiyor = true;
        document.addEventListener('visibilitychange', this._gorunurluk);
        return isciAl().then(function () {
            self._planla(0);
            return true;
        });
    };

    Motor.prototype.duraklat = function () {
        this.calisiyor = false;
        clearTimeout(this.zamanlayici);
        this.zamanlayici = null;
        this.sonAday = null;
    };

    Motor.prototype.surdur = function () {
        if (this.calisiyor) return;
        this.calisiyor = true;
        this._planla(0);
    };

    Motor.prototype.durdur = function () {
        this.duraklat();
        document.removeEventListener('visibilitychange', this._gorunurluk);
    };

    Motor.prototype._gorunurlukDegisti = function () {
        if (!document.hidden && this.calisiyor && !this.zamanlayici && !this.mesgul) this._planla(0);
    };

    Motor.prototype._planla = function (ms) {
        var self = this;
        clearTimeout(this.zamanlayici);
        this.zamanlayici = setTimeout(function () {
            self.zamanlayici = null;
            self._kare();
        }, ms);
    };

    /* Kare yakala: düz (bütün görüntü, küçültülmüş) ya da eğik (orta bölge
       45 derece döndürülmüş). Dönen `donustur` noktayı video pikseline çevirir. */
    Motor.prototype._yakala = function (egik) {
        var v = this.video;
        var vg = v.videoWidth || v.width || 0;
        var vy = v.videoHeight || v.height || 0;
        if (!vg || !vy) return null;
        var t = this.tuval;
        var ctx = this.ctx;
        if (!egik) {
            var s = Math.min(1, UZUN_KENAR[this.kademe] / Math.max(vg, vy));
            var g = Math.max(1, Math.round(vg * s));
            var y = Math.max(1, Math.round(vy * s));
            if (t.width !== g) t.width = g;
            if (t.height !== y) t.height = y;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(v, 0, 0, g, y);
            return {
                g: g, y: y,
                donustur: function (p) { return { x: p.x / s, y: p.y / s }; }
            };
        }
        var kenar = Math.min(vg, vy) * 0.9;
        var S = Math.max(1, Math.round(Math.min(kenar, EGIK_KENAR)));
        var k = S / kenar;
        var aci = Math.PI / 4;
        var cx = vg / 2;
        var cy = vy / 2;
        if (t.width !== S) t.width = S;
        if (t.height !== S) t.height = S;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, S, S);
        ctx.translate(S / 2, S / 2);
        ctx.rotate(aci);
        ctx.scale(k, k);
        ctx.translate(-cx, -cy);
        ctx.drawImage(v, 0, 0, vg, vy);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        var cos = Math.cos(-aci);
        var sin = Math.sin(-aci);
        return {
            g: S, y: S,
            donustur: function (p) {
                var ux = (p.x - S / 2) / k;
                var uy = (p.y - S / 2) / k;
                return { x: ux * cos - uy * sin + cx, y: ux * sin + uy * cos + cy };
            }
        };
    };

    Motor.prototype._kare = function () {
        var self = this;
        if (!this.calisiyor || this.mesgul) return;
        if (document.hidden) return; // görünür olunca _gorunurlukDegisti sürdürür
        var v = this.video;
        if (!v || (v.readyState !== undefined && v.readyState < 2)) { this._planla(120); return; }

        var adim = this.tur++ % 4;
        var egik = adim === 1 || adim === 3;
        var esik = adim < 2 ? 'LocalAverage' : 'FixedThreshold';
        var kare;
        var veri;
        try {
            kare = this._yakala(egik);
            if (!kare) { this._planla(120); return; }
            veri = this.ctx.getImageData(0, 0, kare.g, kare.y).data;
        } catch (e) {
            this._planla(200);
            return;
        }
        var basla = performance.now();
        this.mesgul = true;
        coz(kare.g, kare.y, veri, esik).then(function (d) {
            self.mesgul = false;
            if (!egik && esik === 'LocalAverage') self._olc(d.sure);
            if (!self.calisiyor) return;
            var bulunan = self._degerlendir(d.sonuc || [], kare);
            if (bulunan) {
                try { self.geriBildirim(bulunan.rawValue, bulunan); } catch (e) { console.error('Barkod motoru geri bildirim:', e); }
            }
            if (!self.calisiyor) return;
            self._planla(Math.max(0, EN_AZ_ARA_MS - (performance.now() - basla)));
        });
    };

    /* Yavaş telefonda kare küçülür, hızlıda büyür (uzaktaki barkod için) */
    Motor.prototype._olc = function (sure) {
        this.sureler.push(sure);
        if (this.sureler.length < 6) return;
        var ort = this.sureler.reduce(function (a, b) { return a + b; }, 0) / this.sureler.length;
        this.sureler.length = 0;
        if (ort > 140 && this.kademe < UZUN_KENAR.length - 1) this.kademe++;
        else if (ort < 55 && this.kademe > 0) this.kademe--;
    };

    Motor.prototype._degerlendir = function (sonuclar, kare) {
        var simdi = Date.now();
        for (var i = 0; i < sonuclar.length; i++) {
            var s = sonuclar[i];
            if (!kabulEdilirMi(s.metin, s.bicim)) continue;
            if (ONAY_GEREKEN[s.bicim]) {
                var a = this.sonAday;
                if (!a || a.metin !== s.metin || simdi - a.zaman > 1500) {
                    this.sonAday = { metin: s.metin, zaman: simdi };
                    continue;
                }
            }
            this.sonAday = null;
            var k = s.konum || {};
            var noktalar = [k.topLeft, k.topRight, k.bottomRight, k.bottomLeft]
                .filter(function (p) { return p && typeof p.x === 'number'; })
                .map(kare.donustur);
            var kutu = null;
            if (noktalar.length === 4) {
                var xs = noktalar.map(function (p) { return p.x; });
                var ys = noktalar.map(function (p) { return p.y; });
                var x0 = Math.min.apply(null, xs);
                var y0 = Math.min.apply(null, ys);
                kutu = { x: x0, y: y0, width: Math.max.apply(null, xs) - x0, height: Math.max.apply(null, ys) - y0 };
            }
            return { rawValue: s.metin, format: s.bicim, cornerPoints: noktalar, boundingBox: kutu, motor: 'zxing-wasm' };
        }
        return null;
    };

    global.JBBarkodMotoru = {
        destekleniyor: function () {
            return typeof WebAssembly === 'object' && typeof Worker === 'function';
        },
        hazirla: isciAl,
        olustur: function (video, geriBildirim) { return new Motor(video, geriBildirim); },
        _kabulEdilirMi: kabulEdilirMi
    };
})(window);
