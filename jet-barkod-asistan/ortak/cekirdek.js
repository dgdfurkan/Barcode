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
 * SAYFADA İZ BIRAKMAMA
 * Eklenti sayfaya kendiliğinden HİÇBİR ŞEY koymuyor. Gölge kök ancak bir
 * bildirim ya da diyalog gerçekten gerektiğinde oluşuyor, o da işi bitince
 * boş kalıyor. Modüllerin kendi düğmeleri zaten yalnız ilgili sayfada ve
 * ilgili tablonun içinde.
 *
 * Önceki sürümde sağ altta sürekli duran bir "Jet Barkod" düğmesi vardı.
 * Her sayfada yer kaplıyor, gözü yoruyor ve eklentiyi olduğundan daha
 * müdahaleci gösteriyordu. Kaldırıldı; durum ve eylemler artık Chrome
 * araç çubuğundaki eklenti simgesine tıklayınca açılıyor (`arayuz/`).
 *
 * ARAYÜZ ÇAKIŞMASI
 * Bildirim ve diyalog gölge DOM içinde. Getir panelleri Ant Design
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
        '  .bildirim { animation: none; transition: none; } }',


        /* Diyalog. Her modül kendi modalını yazmasın diye ortak. */
        '.perde { position: fixed; inset: 0; display: flex; align-items: center;',
        '  justify-content: center; padding: 16px; background: rgb(15 23 42 / 0.45);',
        "  font-family: Inter, -apple-system, 'Segoe UI', sans-serif; }",
        '.diyalog { width: 100%; max-width: 400px; max-height: 84vh; overflow: auto;',
        '  padding: 18px; border-radius: 14px; background: #fff;',
        '  box-shadow: 0 24px 60px rgb(15 23 42 / 0.32); }',
        '.diyalog__baslik { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #0f172a; }',
        '.diyalog__aciklama { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; color: #64748b; }',
        '.diyalog__secim { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 10px;',
        '  font-size: 13px; line-height: 1.4; color: #0f172a; cursor: pointer; }',
        '.diyalog__secim input { margin-top: 2px; flex: none; }',
        '.diyalog__metin { width: 100%; height: 190px; padding: 9px; border: 1px solid #e2e8f0;',
        '  border-radius: 8px; font-family: ui-monospace, monospace; font-size: 11px;',
        '  line-height: 1.5; resize: vertical; }',
        '.diyalog__alt { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }',
        '.diyalog__btn { padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px;',
        '  background: #fff; color: #475569; font-family: inherit; font-size: 13px;',
        '  font-weight: 600; cursor: pointer; }',
        '.diyalog__btn:hover { background: #f1f5f9; }',
        '.diyalog__btn--ana { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }',
        '.diyalog__btn--ana:hover { background: #1e40af; }'
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
    // Diyalog
    // ==================================================================

    var acikPerde = null;

    function perdeKapat() {
        if (acikPerde) { acikPerde.remove(); acikPerde = null; }
    }

    /**
     * Gölge DOM içinde diyalog açar. Modüller kendi modalını yazmasın:
     * eski eklentilerde her biri sayfaya kendi kutusunu enjekte ediyordu,
     * Ant Design modalıyla z-index yarışına giriyorlardı.
     *
     * Seçenek: { kimlik, etiket, varsayilan }
     * Sonuç:   onay(secimler) çağrılır, secimler[kimlik] = true/false
     */
    function diyalog(a) {
        korumali('diyalog', function () {
            perdeKapat();
            var k = golgeKok();

            var perde = document.createElement('div');
            perde.className = 'perde';

            var kutu = document.createElement('div');
            kutu.className = 'diyalog';
            kutu.innerHTML =
                '<h3 class="diyalog__baslik"></h3>' +
                (a.aciklama ? '<p class="diyalog__aciklama"></p>' : '');
            kutu.querySelector('.diyalog__baslik').textContent = a.baslik || '';
            if (a.aciklama) kutu.querySelector('.diyalog__aciklama').textContent = a.aciklama;

            var girdiler = {};
            (a.secenekler || []).forEach(function (s) {
                var etiket = document.createElement('label');
                etiket.className = 'diyalog__secim';
                var kutucuk = document.createElement('input');
                kutucuk.type = 'checkbox';
                kutucuk.checked = s.varsayilan !== false;
                var yazi = document.createElement('span');
                yazi.textContent = s.etiket;
                etiket.appendChild(kutucuk);
                etiket.appendChild(yazi);
                kutu.appendChild(etiket);
                girdiler[s.kimlik] = kutucuk;
            });

            var metinAlani = null;
            if (a.metin != null) {
                metinAlani = document.createElement('textarea');
                metinAlani.className = 'diyalog__metin';
                metinAlani.value = a.metin;
                metinAlani.readOnly = true;
                kutu.appendChild(metinAlani);
            }

            var alt = document.createElement('div');
            alt.className = 'diyalog__alt';

            if (a.onay) {
                var iptal = document.createElement('button');
                iptal.type = 'button';
                iptal.className = 'diyalog__btn';
                iptal.textContent = a.iptalEtiketi || 'İptal';
                iptal.addEventListener('click', perdeKapat);
                alt.appendChild(iptal);
            }

            var ana = document.createElement('button');
            ana.type = 'button';
            ana.className = 'diyalog__btn diyalog__btn--ana';
            ana.textContent = a.onayEtiketi || (a.onay ? 'Tamam' : 'Kapat');
            ana.addEventListener('click', function () {
                var secimler = {};
                Object.keys(girdiler).forEach(function (kk) { secimler[kk] = girdiler[kk].checked; });
                perdeKapat();
                if (a.onay) korumali('diyalog onayı', function () { a.onay(secimler); });
            });
            alt.appendChild(ana);

            kutu.appendChild(alt);
            perde.appendChild(kutu);
            perde.addEventListener('click', function (e) { if (e.target === perde) perdeKapat(); });
            k.appendChild(perde);
            acikPerde = perde;

            if (metinAlani) { metinAlani.focus(); metinAlani.select(); }
        });
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
        diyalog: diyalog,
        perdeKapat: perdeKapat,
        korumali: korumali,
        golgeKok: golgeKok,
        arayuzKabi: arayuzKabi,
        log: log,
        hata: hata
    };
})(window);
