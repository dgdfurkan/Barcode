/**
 * Ajanda hatırlatıcıları: ortak veri katmanı
 * ============================================================================
 *
 * Ajandaya eklenen bir kayıtta "Hatırlatıcı" açıksa o kayıt arama
 * sayfasındaki zilde ve Ajanda düğmesindeki kırmızı ünlemde görünür.
 * Kullanıcı ajandadan kapatana ya da kaydı silene kadar kalır.
 *
 * Saklama: dispatch_agenda_items.reminder (boolean) sütunu.
 * Sütun veritabanına eklenene kadar (sql_files/ajanda_hatirlatici.sql)
 * hatırlatıcılar bu cihazda tutulur; sütun gelince ilk açılışta
 * veritabanına taşınır. Böylece göç yapılmadan da hiçbir şey kırılmaz.
 *
 * Arama sayfası anında açılsın diye son liste yerelde önbellekte durur.
 * Ajanda sayfası her değişiklikte önbelleği yazar; aynı tarayıcıdaki açık
 * arama sekmesi bunu `storage` olayıyla anında görür.
 * ============================================================================
 */
(function () {
    'use strict';

    var TABLO = 'dispatch_agenda_items';
    var KOLONLAR = 'id,product_id,product_name,product_image,quantity,reason_preset,event_date,created_at';

    var kolonDurumu = null;      // true · false · null (bilinmiyor)
    var kolonSozu = null;
    var tasimaSozu = null;

    function kullanici() {
        try {
            var s = window.authUtils && window.authUtils.checkAuth();
            return s && s.username ? String(s.username) : null;
        } catch (e) { return null; }
    }

    async function db() {
        if (window.jbDb && window.jbDb.from) return window.jbDb;
        if (typeof window.jetbarkodWaitForDb === 'function') {
            try { await window.jetbarkodWaitForDb(8000); } catch (e) {}
        }
        return window.jbDb && window.jbDb.from ? window.jbDb : null;
    }

    // ------------------------------------------------------------------
    // Yerel yedek (sütun yokken)
    // ------------------------------------------------------------------

    function yerelAnahtar(u) { return 'jb_ajanda_hatirlatici_yerel:' + u; }
    function onbellekAnahtar(u) { return 'jb_ajanda_hatirlatici:' + u; }

    function yerelIdler(u) {
        try {
            var v = JSON.parse(localStorage.getItem(yerelAnahtar(u)) || '[]');
            return Array.isArray(v) ? v.map(String) : [];
        } catch (e) { return []; }
    }

    function yerelYaz(u, idler) {
        try {
            if (idler.length) localStorage.setItem(yerelAnahtar(u), JSON.stringify(idler));
            else localStorage.removeItem(yerelAnahtar(u));
        } catch (e) {}
    }

    function yerelAyarla(u, id, acik) {
        var idler = yerelIdler(u).filter(function (x) { return x !== String(id); });
        if (acik) idler.push(String(id));
        yerelYaz(u, idler);
    }

    // ------------------------------------------------------------------
    // Sütun var mı?
    // ------------------------------------------------------------------

    function kolonYokHatasi(hata) {
        if (!hata) return false;
        var kod = String(hata.code || '');
        var mesaj = String(hata.message || '') + ' ' + String(hata.details || '') + ' ' + String(hata.hint || '');
        // 42703: Postgres "sütun yok" · PGRST204: PostgREST şema önbelleğinde yok
        return kod === '42703' || kod === 'PGRST204' || /reminder/i.test(mesaj) && /column|sütun|kolon/i.test(mesaj);
    }

    /**
     * Sütunun varlığını bir kez yoklar. Ağ hatasında null döner ve
     * sonuç önbelleğe alınmaz, bir sonraki çağrı yeniden dener.
     */
    function kolonVarMi() {
        if (kolonDurumu === true) return yereldenTasi().then(function () { return true; });
        if (kolonDurumu === false) return Promise.resolve(false);
        if (kolonSozu) return kolonSozu;
        kolonSozu = (async function () {
            var u = kullanici();
            var d = await db();
            if (!u || !d) return null;
            var r = await d.from(TABLO).select('id,reminder').eq('username', u).limit(1);
            if (!r.error) {
                kolonDurumu = true;
                await yereldenTasi();
                return true;
            }
            if (kolonYokHatasi(r.error)) {
                kolonDurumu = false;
                return false;
            }
            return null;
        })().finally(function () { kolonSozu = null; });
        return kolonSozu;
    }

    /**
     * Sütun geldiyse bu cihazda bekleyen hatırlatıcıları veritabanına yaz.
     * Taşınan kimlikleri döner. Başarısız olursa yerel iz kalır, bir
     * sonraki açılışta yeniden denenir; o arada aciklarMi yerel izi de
     * saydığı için hatırlatıcı kaybolmaz.
     */
    function yereldenTasi() {
        if (tasimaSozu) return tasimaSozu;
        tasimaSozu = (async function () {
            var u = kullanici();
            if (!u || kolonDurumu !== true) return [];
            var idler = yerelIdler(u);
            if (!idler.length) return [];
            var d = await db();
            if (!d) return [];
            var r = await d.from(TABLO).update({ reminder: true }).eq('username', u).in('id', idler);
            if (r.error) return [];
            yerelYaz(u, []);
            return idler;
        })().finally(function () { tasimaSozu = null; });
        return tasimaSozu;
    }

    /** Ajanda satırı: `select('*')` sonucundan sütunun varlığı da öğrenilir. */
    function satirlardanOgren(satirlar) {
        if (kolonDurumu !== null || !Array.isArray(satirlar) || !satirlar.length) return;
        kolonDurumu = Object.prototype.hasOwnProperty.call(satirlar[0], 'reminder');
    }

    // ------------------------------------------------------------------
    // Okuma / yazma
    // ------------------------------------------------------------------

    function aciklarMi(satir, u) {
        if (!satir) return false;
        if (kolonDurumu === true && satir.reminder === true) return true;
        // Sütun yokken ya da taşıma henüz bitmemişken yerel iz geçerli
        return yerelIdler(u || kullanici() || '').indexOf(String(satir.id)) !== -1;
    }

    /**
     * Ajanda listesi yüklenince: sütunu öğren, bekleyenleri taşı, taşınan
     * satırları bellekte de işaretle ki ekran hemen doğru görünsün.
     */
    async function esitle(satirlar) {
        satirlardanOgren(satirlar);
        if (kolonDurumu === true) {
            var tasinan = await yereldenTasi();
            if (tasinan.length && Array.isArray(satirlar)) {
                var k = new Set(tasinan.map(String));
                satirlar.forEach(function (s) { if (k.has(String(s.id))) s.reminder = true; });
            }
            return true;
        }
        return kolonVarMi();
    }

    /** Açık hatırlatıcılar: yeniden eskiye. Hata olursa fırlatır. */
    async function listele() {
        var u = kullanici();
        if (!u) return [];
        var d = await db();
        if (!d) throw new Error('Bağlantı yok');
        var var_ = await kolonVarMi();
        var sorgu;
        if (var_ === true) {
            sorgu = d.from(TABLO).select(KOLONLAR).eq('username', u).eq('reminder', true);
        } else {
            var idler = yerelIdler(u);
            if (!idler.length) {
                if (var_ === null) throw new Error('Bağlantı yok');
                return [];
            }
            sorgu = d.from(TABLO).select(KOLONLAR).eq('username', u).in('id', idler);
        }
        var r = await sorgu.order('created_at', { ascending: false });
        if (r.error) throw r.error;
        var satirlar = Array.isArray(r.data) ? r.data : [];
        if (var_ === true) {
            var bekleyen = yerelIdler(u);
            if (bekleyen.length) {
                var r2 = await d.from(TABLO).select(KOLONLAR).eq('username', u).in('id', bekleyen);
                if (!r2.error && Array.isArray(r2.data)) {
                    var gorulen = new Set(satirlar.map(function (s) { return String(s.id); }));
                    r2.data.forEach(function (s) { if (!gorulen.has(String(s.id))) satirlar.push(s); });
                    satirlar.sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
                }
            }
        }
        // Silinmiş kayıtların yerel izini temizle
        if (var_ !== true) {
            var kalan = new Set(satirlar.map(function (s) { return String(s.id); }));
            yerelYaz(u, yerelIdler(u).filter(function (id) { return kalan.has(id); }));
        }
        onbellekYaz(satirlar, u);
        return satirlar;
    }

    /** Bir kaydın hatırlatıcısını açar ya da kapatır. */
    async function ayarla(id, acik) {
        var u = kullanici();
        if (!u || !id) throw new Error('Oturum yok');
        var var_ = await kolonVarMi();
        if (var_ === true) {
            var d = await db();
            var r = await d.from(TABLO).update({ reminder: !!acik }).eq('id', id).eq('username', u);
            if (r.error) throw r.error;
            if (!acik) yerelAyarla(u, id, false);
        } else if (var_ === false) {
            yerelAyarla(u, id, !!acik);
        } else {
            throw new Error('Bağlantı yok');
        }
    }

    /** Yeni kayda eklenecek alan: sütun varsa { reminder }, yoksa boş. */
    function eklemeAlani(acik) {
        return kolonDurumu === true ? { reminder: !!acik } : {};
    }

    /** Ekleme sonrası: sütun yoksa yerelde işaretle. */
    function eklendi(id, acik) {
        var u = kullanici();
        if (!u || !id || !acik || kolonDurumu === true) return;
        yerelAyarla(u, id, true);
    }

    function kaldirildi(id) {
        var u = kullanici();
        if (!u || !id) return;
        yerelAyarla(u, id, false);
    }

    // ------------------------------------------------------------------
    // Önbellek
    // ------------------------------------------------------------------

    function sadeSatir(s) {
        return {
            id: s.id,
            product_id: s.product_id,
            product_name: s.product_name,
            product_image: s.product_image,
            quantity: s.quantity,
            reason_preset: s.reason_preset,
            event_date: s.event_date,
            created_at: s.created_at
        };
    }

    function onbellekYaz(satirlar, u) {
        u = u || kullanici();
        if (!u) return;
        try {
            localStorage.setItem(onbellekAnahtar(u), JSON.stringify({
                t: Date.now(),
                ogeler: (satirlar || []).map(sadeSatir)
            }));
        } catch (e) {}
    }

    function onbellekOku() {
        var u = kullanici();
        if (!u) return null;
        try {
            var v = JSON.parse(localStorage.getItem(onbellekAnahtar(u)) || 'null');
            return v && Array.isArray(v.ogeler) ? v : null;
        } catch (e) { return null; }
    }

    function onbellekAnahtariMi(anahtar) {
        var u = kullanici();
        return !!u && anahtar === onbellekAnahtar(u);
    }

    window.JBAjandaHatirlatici = {
        kolonVarMi: kolonVarMi,
        esitle: esitle,
        satirlardanOgren: satirlardanOgren,
        aciklarMi: aciklarMi,
        listele: listele,
        ayarla: ayarla,
        eklemeAlani: eklemeAlani,
        eklendi: eklendi,
        kaldirildi: kaldirildi,
        onbellekYaz: onbellekYaz,
        onbellekOku: onbellekOku,
        onbellekAnahtariMi: onbellekAnahtariMi,
        kolonDurumu: function () { return kolonDurumu; }
    };
})();
