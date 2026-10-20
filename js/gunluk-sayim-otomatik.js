/**
 * Günlük sayım: Asistan'ın sabah eklediği listeden tabloyu kendiliğinden kurar
 * ============================================================================
 *
 * Jet Barkod Asistan her sabah 06:00'da depo panelinin 50'lik otomatik
 * sayımını Jet Barkod API'sine bırakıyor (/api/gunluk-sayim). Sayım sayfası
 * açılınca burası o günün `Günlük|YYYY-MM-DD` tablosunu sayım sayfasının
 * kendi yoluyla kurar (ensureDailyTableForDate + applyImportedRows): tablo
 * kilidi, sıra, toplu kayıt ve cihazlar arası eşitleme olduğu gibi çalışır.
 *
 *   - Birden çok cihaz açıksa sunucudaki kilit (al) tabloyu yalnız birine kurdurur.
 *   - Tablo zaten varsa (elle eklenmiş) dokunulmaz.
 *   - Kurulumdan sonra kullanıcı hangi tablodaysa ona geri dönülür; adreste
 *     `?gunluk=YYYY-MM-DD` varsa (kontrol panelindeki "Sayıma Başla") o tablo açılır.
 *   - Sayfa açıkken 10 dakikada bir yeniden bakılır (Asistan 06:xx'te ekler).
 * ============================================================================
 */
(function (global) {
    'use strict';

    var GUN = /^\d{4}-\d{2}-\d{2}$/;
    var YOKLAMA_MS = 10 * 60 * 1000;
    var calisiyor = false;
    var biten = {};

    /* Adreste ?gunluk=YYYY-MM-DD varsa sayım sayfası açılırken Günlük sekmesi ve
       o gün seçili başlasın: sayfanın kendi kurulumundan ÖNCE yazılır */
    (function () {
        try {
            var g = new URLSearchParams(location.search).get('gunluk');
            if (g && GUN.test(g)) {
                sessionStorage.setItem('sayimSubTab', 'daily');
                sessionStorage.setItem('sayimDailySelectedIso', g);
            }
        } catch (e) { /* gizli pencere */ }
    })();

    function bugun() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    }

    async function api(yol, govde) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return null;
        try {
            var r = await a.apiFetch('/api/gunluk-sayim' + yol, govde ? {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde)
            } : {});
            if (!r.ok) return null;
            return await r.json();
        } catch (e) {
            return null;
        }
    }

    /** Sayım sayfası verisini yükleyene kadar bekler (en çok 60 sn) */
    function hazirBekle() {
        return new Promise(function (coz) {
            var bitis = Date.now() + 60000;
            (function bak() {
                var cs = global.countingSystem;
                var hazir = cs && cs.currentUser && Array.isArray(cs.allProducts) && cs.allProducts.length && cs.cachedFullData;
                if (hazir) return coz(cs);
                if (Date.now() > bitis) return coz(null);
                setTimeout(bak, 500);
            })();
        });
    }

    /**
     * O günün tablosunu bu sayfada görünür yapar.
     *  - Sunucuda satırlar varsa (Asistan eklerken sunucu kurdu ama bu sayfa
     *    eski veriyle açık ya da tablo metası başka cihazca ezildi) tablo
     *    yeniden YAZILMAZ: boş tablo açılıp satırlar sunucudan okunur. Başka
     *    cihazda sayılmış adetler böylece korunur.
     *  - Sunucuda satır yoksa sayfanın kendi içe aktarma yoluyla kurulur.
     *  - Kullanıcı tabloyu liste eklendikten SONRA sildiyse kurulmaz; karttan
     *    (?gunluk=) gelindiyse kullanıcı açıkça istiyor, kurulur.
     */
    async function kur(cs, gun, acikKalsin) {
        if (biten[gun]) return 'var';
        if (cs.hasDailyTableForIso(gun)) { biten[gun] = true; return 'var'; }
        var c = await api('?gun=' + gun);
        var k = c && c.ok && c.kayit;
        if (!k || !Array.isArray(k.urunler) || !k.urunler.length) return 'yok';
        var ad = cs.DAILY_TABLE_PREFIX + gun;
        var silinme = Math.max(Number(cs._silinenler && cs._silinenler[ad]) || 0, Number(k.silinme) || 0);
        var eklendi = Date.parse(k.eklendi) || 0;
        if (silinme && silinme > eklendi && !acikKalsin) { biten[gun] = true; return 'silinmis'; }
        var kilit = await api('/al', { gun: gun, cihaz: cs.deviceId || null });
        if (!kilit || !kilit.alindi) return 'baskasi';
        // Kilidi aldık; o arada başka cihaz eşitlediyse tablo yine var olabilir
        if (cs.hasDailyTableForIso(gun)) {
            await api('/tamam', { gun: gun });
            biten[gun] = true;
            return 'var';
        }
        var urunler = (Array.isArray(kilit.urunler) && kilit.urunler.length ? kilit.urunler : k.urunler)
            .filter(function (u) { return u && /^[a-f0-9]{24}$/.test(String(u.id || '')); });
        var onceki = cs.currentTableName;
        var sonuc = { added: 0, skipped: 0 };
        var sunucudaVar = Number(k.satir) > 0;
        try {
            await cs.ensureDailyTableForDate(gun, { forImport: true });
            if (sunucudaVar) {
                // Sıra Asistan listesinin sırası; satırlar sunucudan
                var sira = urunler.map(function (u) { return u.id; });
                var slot = cs.cachedFullData && cs.cachedFullData._tables && cs.cachedFullData._tables[ad];
                if (slot) slot._productOrder = sira.slice();
                if (cs.currentTableName === ad && cs.countingData) cs.countingData._productOrder = sira.slice();
                await cs.refreshCurrentTableFromDb();
                if (typeof cs._scheduleMetaSave === 'function') cs._scheduleMetaSave(250);
                if (cs.currentTableName === ad) {
                    if (typeof cs.renderTable === 'function') cs.renderTable();
                    if (typeof cs.updateStatistics === 'function') cs.updateStatistics();
                }
                sonuc.added = Number(k.satir) || 0;
            } else {
                sonuc = await cs.applyImportedRows(urunler.map(function (u) {
                    return { productId: u.id, name: u.ad };
                })) || sonuc;
            }
        } finally {
            // Kullanıcı başka tablodaysa oraya dön
            if (!acikKalsin && onceki && onceki !== cs.currentTableName && !cs.isDailyTableName(onceki)) {
                try { await cs.switchTable(onceki); } catch (e) { /* tablo silinmiş olabilir */ }
            }
        }
        if (!sunucudaVar) await api('/tamam', { gun: gun, eklenen: sonuc.added || 0, atlanan: sonuc.skipped || 0 });
        else await api('/tamam', { gun: gun, eklenen: sonuc.added || 0, atlanan: 0 });
        biten[gun] = true;
        if (cs.showToast) cs.showToast('Günlük sayım eklendi · ' + (sonuc.added || 0) + ' ürün' + (sonuc.skipped ? ' · ' + sonuc.skipped + ' ürün katalogda yok' : ''), 'success', 5000);
        return 'kuruldu';
    }

    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    /* Kontrol panelindeki karttan gelindi: o günün tablosu seçili gelsin.
       Sayfa açılışta cihazın son tablosunu geri yükleyebiliyor; seçim
       2 saniye boyunca kararlı kalana kadar (en çok 15 sn) korunur. */
    async function tabloyuAc(cs, gun) {
        var ad = cs.DAILY_TABLE_PREFIX + gun;
        var kararli = 0;
        for (var i = 0; i < 30 && kararli < 4; i++) {
            if (cs.hasDailyTableForIso(gun)) {
                if (cs.currentTableName !== ad && !cs._importInProgress) {
                    try { await cs.switchTable(ad); } catch (e) { /* bir sonraki turda */ }
                }
                kararli = cs.currentTableName === ad ? kararli + 1 : 0;
            }
            if (kararli < 4) await bekle(500);
        }
        if (cs.currentTableName === ad) {
            try { global.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { /* eski tarayıcı */ }
        } else if (cs.showToast) {
            cs.showToast('O günün sayım tablosu bulunamadı.', 'warning', 4000);
        }
    }

    async function tur(istenen) {
        if (calisiyor) return;
        calisiyor = true;
        try {
            var cs = await hazirBekle();
            if (!cs) return;
            var gunler = [bugun()];
            if (istenen && gunler.indexOf(istenen) === -1) gunler.push(istenen);
            for (var i = 0; i < gunler.length; i++) {
                try { await kur(cs, gunler[i], gunler[i] === istenen); } catch (e) { /* bir sonraki turda tekrar */ }
            }
            if (istenen) await tabloyuAc(cs, istenen);
        } finally {
            calisiyor = false;
        }
    }

    function basla() {
        var istenen = null;
        try {
            var q = new URLSearchParams(location.search);
            var g = q.get('gunluk');
            if (g && GUN.test(g)) istenen = g;
            if (q.has('gunluk')) {
                q.delete('gunluk');
                var kalan = q.toString();
                history.replaceState(history.state, '', location.pathname + (kalan ? '?' + kalan : '') + location.hash);
            }
        } catch (e) { /* adres okunamadı */ }
        tur(istenen);
        setInterval(function () { if (document.visibilityState === 'visible') tur(null); }, YOKLAMA_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && !biten[bugun()]) tur(null);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
