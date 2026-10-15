/**
 * Barkod çözücü işçisi (Web Worker)
 * ============================================================================
 *
 * Kamera karesini ana iş parçacığından alıp ZXing-C++ (WebAssembly) ile
 * çözüyor. Ana sayfa kare yakalamakla meşgulken çözüm burada sürüyor;
 * arayüz takılmıyor.
 *
 * Kütüphane yerelde: js/vendor/zxing/ (zxing-wasm 3.1.4, MIT). Varsayılan
 * ayarı WASM dosyasını CDN'den çekiyor; `locateFile` ile yerel dosyaya
 * yönlendiriliyor. Dışarıya istek yok.
 *
 * Mesajlar
 *   → { tip: 'baslat' }                       ← { tip: 'hazir' } | { tip: 'hata' }
 *   → { tip: 'coz', no, g, y, veri, esik }    ← { tip: 'sonuc', no, sonuc[], sure }
 *     esik: 'LocalAverage' (düzensiz ışık, parlama) | 'FixedThreshold' (bulanık)
 *     veri: RGBA Uint8ClampedArray'in tamponu (aktarılıyor, kopyalanmıyor)
 * ============================================================================
 */
/* global ZXingWASM */
'use strict';

var SURUM = new URL(self.location.href).searchParams.get('v') || '';
var EK = SURUM ? '?v=' + encodeURIComponent(SURUM) : '';

importScripts('vendor/zxing/zxing-reader.js' + EK);

var WASM_ADRESI = new URL('vendor/zxing/zxing_reader.wasm' + EK, self.location.href).href;

/* Raftaki ürünlerin barkodları. QR ve DataMatrix de okunuyor ama motor
   yalnız barkod gibi görünen içeriği kabul ediyor (link taşıyan QR'lar elenir).
   tryRotate: 90/180/270 derece; motor ayrıca 45 derece döndürülmüş kare
   gönderiyor, böylece yamuk tutulan barkod da yakalanıyor. */
var SECENEK = {
    // UPC-E yok: 8 hanelik zayıf kontrolüyle eğik taranan EAN-13'ün bir
    // parçasını başka bir kod diye okuyabiliyor (ölçüldü: 30° EAN-13 → UPC-E).
    formats: ['EAN13', 'EAN8', 'UPCA', 'Code128', 'Code39', 'ITF', 'QRCode', 'DataMatrix'],
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    tryDownscale: true,
    // 1 olursa karede reklam QR'ı varken barkod hiç aranmıyordu (ölçüldü);
    // birkaç kod bulunuyor, barkod olmayanı motor eliyor
    maxNumberOfSymbols: 4
};

/* Eşikleme kare kare değişiyor (motor seçiyor). Ölçüm: 1,5 px bulanık
   EAN-13'te LocalAverage 0/3, FixedThreshold 3/3; düzensiz ışıkta tersi. */
var SECENEK_SABIT = Object.assign({}, SECENEK, { binarizer: 'FixedThreshold' });

var hazir = null;

function hazirla() {
    if (!hazir) {
        hazir = ZXingWASM.prepareZXingModule({
            overrides: {
                locateFile: function (yol, onek) {
                    return /\.wasm$/.test(yol) ? WASM_ADRESI : onek + yol;
                }
            },
            fireImmediately: true
        });
    }
    return hazir;
}

self.onmessage = function (e) {
    var d = e.data || {};
    if (d.tip === 'baslat') {
        hazirla().then(function () {
            self.postMessage({ tip: 'hazir' });
        }, function (x) {
            hazir = null;
            self.postMessage({ tip: 'hata', mesaj: String(x && x.message || x) });
        });
        return;
    }
    if (d.tip !== 'coz') return;
    var t0 = performance.now();
    hazirla().then(function () {
        return ZXingWASM.readBarcodes({ data: new Uint8ClampedArray(d.veri), width: d.g, height: d.y },
            d.esik === 'FixedThreshold' ? SECENEK_SABIT : SECENEK);
    }).then(function (sonuclar) {
        var liste = [];
        for (var i = 0; i < sonuclar.length; i++) {
            var s = sonuclar[i];
            if (!s || !s.isValid || !s.text) continue;
            liste.push({ metin: s.text, bicim: s.format, konum: s.position });
        }
        self.postMessage({ tip: 'sonuc', no: d.no, sonuc: liste, sure: performance.now() - t0 });
    }, function () {
        self.postMessage({ tip: 'sonuc', no: d.no, sonuc: [], sure: performance.now() - t0 });
    });
};
