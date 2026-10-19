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

    async function kur(cs, gun, acikKalsin) {
        if (biten[gun]) return 'var';
        if (cs.hasDailyTableForIso(gun)) { biten[gun] = true; return 'var'; }
        var c = await api('?gun=' + gun);
        var k = c && c.ok && c.kayit;
        if (!k || !Array.isArray(k.urunler) || !k.urunler.length) return 'yok';
        if (k.uygulandi) { biten[gun] = true; return 'var'; }
        var kilit = await api('/al', { gun: gun, cihaz: cs.deviceId || null });
        if (!kilit || !kilit.alindi) return 'baskasi';
        // Kilidi aldık; o arada başka cihaz eşitlediyse tablo yine var olabilir
        if (cs.hasDailyTableForIso(gun)) {
            await api('/tamam', { gun: gun });
            biten[gun] = true;
            return 'var';
        }
        var onceki = cs.currentTableName;
        var sonuc = { added: 0, skipped: 0 };
        try {
            await cs.ensureDailyTableForDate(gun, { forImport: true });
            sonuc = await cs.applyImportedRows(kilit.urunler.map(function (u) {
                return { productId: u.id, name: u.ad };
            })) || sonuc;
        } finally {
            // Kullanıcı başka tablodaysa oraya dön
            if (!acikKalsin && onceki && onceki !== cs.currentTableName && !cs.isDailyTableName(onceki)) {
                try { await cs.switchTable(onceki); } catch (e) { /* tablo silinmiş olabilir */ }
            }
        }
        await api('/tamam', { gun: gun, eklenen: sonuc.added || 0, atlanan: sonuc.skipped || 0 });
        biten[gun] = true;
        if (cs.showToast) cs.showToast('Günlük sayım eklendi · ' + (sonuc.added || 0) + ' ürün' + (sonuc.skipped ? ' · ' + sonuc.skipped + ' ürün katalogda yok' : ''), 'success', 5000);
        return 'kuruldu';
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
            if (istenen && cs.hasDailyTableForIso(istenen)) {
                var ad = cs.DAILY_TABLE_PREFIX + istenen;
                if (cs.currentTableName !== ad) await cs.switchTable(ad);
            }
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
