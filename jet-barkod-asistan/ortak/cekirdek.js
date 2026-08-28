/**
 * Jet Barkod Asistan. Çekirdek.
 * ============================================================================
 *
 * Bütün modüllerin ortak zemini. Modüller kendilerini buraya kaydeder,
 * yükleyici de buradan okuyup çalıştırır.
 *
 * NEDEN TEK EKLENTİ
 * Eskiden her araç ayrı bir eklentiydi. franchise.getir.com'da dört,
 * warehouse.getir.com'da üç tanesi aynı anda çalışıyordu: dört ayrı
 * service worker, dört ayrı DOM gözlemcisi, dört ayrı yüzen düğme ve
 * dört kez kopyalanmış aynı yardımcı kod. Burada hepsi tek yerde.
 *
 * BİR MODÜL PATLARSA
 * Diğerleri çalışmaya devam eder. Modülün `baslat` çağrısı da, gözlemci
 * aboneliği de kendi try/catch kabuğunda. Tek eklentiye geçmenin en büyük
 * riski buydu, en baştan kapatıldı.
 *
 * TEK GÖZLEMCİ
 * Her modül kendi MutationObserver'ını kurarsa aynı ağaç defalarca
 * taranır. Burada tek gözlemci var; değişiklikler bir çizim karesinde
 * toplanıp aboneler bir kez uyandırılıyor.
 *
 * ARAYÜZ ÇAKIŞMASI
 * Yüzen arayüzün tamamı gölge DOM içinde. Getir panelleri Ant Design
 * kullanıyor ve sayfaya global stil enjekte etmek er geç çakışıyor.
 * Gölge kökün içindeki stil dışarı sızmaz, dışarıdaki içeri giremez.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // Aynı sekmeye iki kez enjekte edilirse ikincisi sessizce çekilir.
    if (global.JBA) return;

    var ONEK = 'jba';
    var moduller = [];
    var calisanlar = [];

    // ==================================================================
    // Günlük
    // ==================================================================

    function log(m, veri) {
        if (veri !== undefined) console.log('[Jet Barkod] ' + m, veri);
        else console.log('[Jet Barkod] ' + m);
    }

    function hata(nerede, e) {
        console.error('[Jet Barkod] ' + nerede + ' hatası:', e);
    }

    /** Verilen işi yutarak çalıştırır. Modül patlasa da sayfa ayakta kalır. */
    function korumali(nerede, is) {
        try { return is(); } catch (e) { hata(nerede, e); return null; }
    }

    // ==================================================================
    // Tek gözlemci
    // ==================================================================

    var aboneler = [];
    var gozlemci = null;
    var bekleyenKare = 0;

    function uyandir() {
        if (bekleyenKare) return;
        bekleyenKare = requestAnimationFrame(function () {
            bekleyenKare = 0;
            for (var i = 0; i < aboneler.length; i++) {
                korumali('gözlemci abonesi', aboneler[i]);
            }
        });
    }

    /**
     * DOM değişince çağrılacak işi kaydeder. Getir panelleri tek sayfa
     * uygulaması; tablolar sonradan geliyor, modal açılıp kapanıyor.
     * Dönen fonksiyon aboneliği iptal eder.
     */
    function izle(is) {
        aboneler.push(is);
        if (!gozlemci) {
            gozlemci = new MutationObserver(uyandir);
            gozlemci.observe(document.body, { childList: true, subtree: true });
        }
        return function () {
            var i = aboneler.indexOf(is);
            if (i > -1) aboneler.splice(i, 1);
        };
    }

    // ==================================================================
    // Pano
    // ==================================================================

    /**
     * Panoya yazar. Modern yol izin isteyebiliyor ya da sekme odakta
     * değilse reddediyor; o yüzden eski execCommand yolu yedekte duruyor.
     */
    function panoyaYaz(metin) {
        return new Promise(function (coz) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(metin).then(
                    function () { coz(true); },
                    function () { coz(yedekPano(metin)); }
                );
            } else {
                coz(yedekPano(metin));
            }
        });
    }

    function yedekPano(metin) {
        var alan = document.createElement('textarea');
        alan.value = metin;
        alan.setAttribute('readonly', '');
        alan.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(alan);
        var oldu = false;
        try {
            alan.select();
            alan.setSelectionRange(0, alan.value.length);
            oldu = document.execCommand('copy');
        } catch (e) {
            hata('pano yedeği', e);
        }
        alan.remove();
        return oldu;
    }

    // ==================================================================
    // Gölge kök: yüzen arayüzün tamamı burada yaşar
    // ==================================================================

    var kok = null;

    function golgeKok() {
        if (kok) return kok;
        var kap = document.createElement('div');
        kap.id = ONEK + '-kok';
        // Sayfanın kendi yerleşimine hiç karışmasın.
        kap.style.cssText = 'all:initial;position:fixed;z-index:2147483000;inset:auto 0 0 auto;';
        (document.body || document.documentElement).appendChild(kap);
        kok = kap.attachShadow({ mode: 'open' });

        var stil = document.createElement('style');
        stil.textContent = STIL;
        kok.appendChild(stil);
        return kok;
    }

    var STIL = [
        ':host, * { box-sizing: border-box; }',
        '.kap { position: fixed; right: 16px; bottom: 16px; display: flex;',
        '  flex-direction: column; align-items: flex-end; gap: 8px;',
        "  font-family: Inter, -apple-system, 'Segoe UI', sans-serif; }",

        /* Bildirim */
        '.bildirimler { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }',
        /* Dinlenme hâli animasyona bağlı değil: opaklık zaten 1. Animasyon
           hiç çalışmazsa (arka plandaki sekme, hareket tercihi) bildirim
           yine de görünür. Görünürlüğü bir kareye emanet etme. */
        '.bildirim { display: flex; align-items: center; gap: 8px; max-width: 320px;',
        '  padding: 9px 13px; border-radius: 10px; background: #0f172a; color: #fff;',
        '  font-size: 13px; line-height: 1.35; opacity: 1; transform: none;',
        '  box-shadow: 0 8px 24px rgb(15 23 42 / 0.28);',
        '  animation: gir 200ms cubic-bezier(0.22, 1, 0.36, 1); }',
        '.bildirim.olumlu { background: #047857; }',
        '.bildirim.olumsuz { background: #b91c1c; }',
        '.bildirim.cikis { animation: cik 180ms ease-in forwards; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(8px); }',
        '                 to { opacity: 1; transform: none; } }',
        '@keyframes cik { from { opacity: 1; } to { opacity: 0; transform: translateY(6px); } }',
        '@media (prefers-reduced-motion: reduce) {',
        '  .bildirim, .panel, .dugme { animation: none; transition: none; } }',

        /* Açma düğmesi */
        '.dugme { display: inline-flex; align-items: center; gap: 8px; height: 38px;',
        '  padding: 0 14px 0 11px; border: none; border-radius: 999px; cursor: pointer;',
        '  background: #1d4ed8; color: #fff; font-size: 13px; font-weight: 600;',
        "  font-family: inherit; box-shadow: 0 6px 20px rgb(29 78 216 / 0.35);",
        '  transition: transform 140ms ease, background 140ms ease; }',
        '.dugme:hover { background: #1e40af; transform: translateY(-1px); }',
        '.dugme:active { transform: translateY(0); }',
        '.dugme__nokta { width: 7px; height: 7px; border-radius: 50%; background: #86efac; }',
        '.dugme__sayi { padding: 1px 6px; border-radius: 999px; background: rgb(255 255 255 / 0.2);',
        '  font-size: 11px; font-variant-numeric: tabular-nums; }',

        /* Panel */
        '.panel { width: 288px; padding: 12px; border-radius: 14px; background: #fff;',
        '  border: 1px solid #e2e8f0; box-shadow: 0 18px 44px rgb(15 23 42 / 0.2);',
        '  animation: gir 180ms cubic-bezier(0.22, 1, 0.36, 1); }',
        '.panel[hidden] { display: none; }',
        '.panel__bas { display: flex; align-items: baseline; justify-content: space-between;',
        '  margin-bottom: 10px; }',
        '.panel__ad { font-size: 13px; font-weight: 700; color: #0f172a; }',
        '.panel__yer { font-size: 10px; font-weight: 700; letter-spacing: 0.06em;',
        '  text-transform: uppercase; color: #94a3b8; }',
        '.modul { padding: 9px 0; border-top: 1px solid #f1f5f9; }',
        '.modul:first-of-type { border-top: none; padding-top: 0; }',
        '.modul__ust { display: flex; align-items: center; gap: 7px; }',
        '.modul__nokta { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex: none; }',
        '.modul__nokta.uyku { background: #cbd5e1; }',
        '.modul__nokta.bozuk { background: #ef4444; }',
        '.modul__ad { font-size: 12.5px; font-weight: 600; color: #0f172a; }',
        '.modul__ozet { margin: 3px 0 0 13px; font-size: 11.5px; line-height: 1.45; color: #64748b; }',
        '.eylemler { display: flex; flex-wrap: wrap; gap: 6px; margin: 7px 0 0 13px; }',
        '.eylem { padding: 5px 10px; border: 1px solid #dbeafe; border-radius: 7px;',
        '  background: #eff6ff; color: #1d4ed8; font-family: inherit; font-size: 11.5px;',
        '  font-weight: 600; cursor: pointer; transition: background 140ms ease; }',
        '.eylem:hover { background: #dbeafe; }',
        '.bos { font-size: 11.5px; line-height: 1.5; color: #94a3b8; }'
    ].join('\n');

    // ==================================================================
    // Bildirim
    // ==================================================================

    var bildirimKabi = null;

    function bildir(metin, tur) {
        korumali('bildirim', function () {
            var k = golgeKok();
            if (!bildirimKabi) {
                var kap = k.querySelector('.kap') || arayuzKabi(k);
                bildirimKabi = kap.querySelector('.bildirimler');
            }
            var b = document.createElement('div');
            b.className = 'bildirim' + (tur ? ' ' + tur : '');
            b.textContent = metin;
            bildirimKabi.appendChild(b);
            setTimeout(function () {
                b.classList.add('cikis');
                setTimeout(function () { b.remove(); }, 200);
            }, 2400);
        });
    }

    function arayuzKabi(k) {
        var kap = k.querySelector('.kap');
        if (kap) return kap;
        kap = document.createElement('div');
        kap.className = 'kap';
        kap.innerHTML = '<div class="bildirimler"></div>';
        k.appendChild(kap);
        return kap;
    }

    // ==================================================================
    // Modül kaydı
    // ==================================================================

    /**
     * Bir modülü kaydeder. Alanlar:
     *   kimlik   Benzersiz anahtar. Site tarafındaki premium kilidi bunu kullanır.
     *   ad       Panelde görünen ad.
     *   ozet     Bir cümlelik açıklama.
     *   hostlar  Hangi alan adlarında çalışır. ['warehouse.getir.com']
     *   yol      İsteğe bağlı. Yol dizesini alıp true/false döner.
     *   baslat   ctx alır. ctx.izle, ctx.bildir, ctx.panoyaYaz, ctx.korumali.
     *   durdur   İsteğe bağlı. Temizlik.
     *   eylemler İsteğe bağlı. Panelde düğme olarak çıkar.
     */
    function kayit(m) {
        if (!m || !m.kimlik) return;
        for (var i = 0; i < moduller.length; i++) {
            if (moduller[i].kimlik === m.kimlik) return;
        }
        moduller.push(m);
    }

    function buSayfayaUygun(m) {
        var host = location.hostname;
        var uyar = (m.hostlar || []).some(function (h) {
            return host === h || host.endsWith('.' + h);
        });
        if (!uyar) return false;
        if (typeof m.yol === 'function') return !!korumali(m.kimlik + ' yol', function () { return m.yol(location.pathname); });
        return true;
    }

    global.JBA = {
        ONEK: ONEK,
        moduller: moduller,
        calisanlar: calisanlar,
        kayit: kayit,
        buSayfayaUygun: buSayfayaUygun,
        izle: izle,
        panoyaYaz: panoyaYaz,
        bildir: bildir,
        korumali: korumali,
        golgeKok: golgeKok,
        arayuzKabi: arayuzKabi,
        log: log,
        hata: hata
    };
})(window);
