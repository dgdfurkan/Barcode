/**
 * Jet Barkod — açılış (boot) denetleyicisi
 *
 * Giriş sonrası uygulama açılırken markalı perdeyi yönetir ve header
 * elemanlarını sıralı biçimde ortaya çıkarır.
 *
 * İlerleme çubuğu SAHTE DEĞİLDİR: gerçek yükleme aşamalarına bağlıdır.
 * Bir aşama beklenenden geç gelirse çubuk o aralıkta çok yavaş ilerler
 * (kullanıcı donmuş sanmasın), ama aşama gelmeden bir sonrakine geçmez.
 *
 * GÜVENLİK AĞI: perde hiçbir koşulda kalıcı takılamaz —
 *  1) sayfaya gömülü inline script belirli süre sonra kaldırır,
 *  2) buradaki sert zaman aşımı kaldırır,
 *  3) dismiss() birden çok kez çağrılabilir (idempotent).
 */
(function (global) {
    'use strict';

    /**
     * Bilinen yükleme aşamaları. Her sayfa hangilerini kullandığını
     * #appBoot üzerindeki data-boot-steps ile bildirir; bildirilmezse
     * ürün arama sayfasının varsayılan seti kullanılır.
     *
     * Sayfa kendi kullanmadığı bir aşamayı listelemezse o aşama beklenmez —
     * aksi hâlde perde boşuna zaman aşımına kadar açık kalırdı.
     */
    var ASAMA_TANIMLARI = {
        auth: 'Oturum doğrulanıyor',
        catalog: 'Ürün kataloğu hazırlanıyor',
        premium: 'Özellikler yükleniyor',
        data: 'Veriler getiriliyor',
        ui: 'Neredeyse hazır',
    };

    var VARSAYILAN_ASAMALAR = ['auth', 'catalog', 'premium', 'ui'];

    var ASAMALAR = [];

    function asamalariKur(perde) {
        var liste = VARSAYILAN_ASAMALAR;
        var attr = perde && perde.getAttribute('data-boot-steps');
        if (attr) {
            var parcalar = attr.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
            if (parcalar.length) liste = parcalar;
        }
        // Yüzdeler aşama sayısına göre eşit dağıtılır; son aşama daima %100.
        ASAMALAR = liste.map(function (ad, i) {
            return {
                ad: ad,
                yuzde: Math.round(((i + 1) / liste.length) * 100),
                metin: ASAMA_TANIMLARI[ad] || 'Yükleniyor',
            };
        });
    }

    var SERT_ZAMAN_ASIMI_MS = 8000;
    var MIN_GOSTERIM_MS = 550; // göz kırpması gibi görünmesin

    var durum = {
        el: null,
        bar: null,
        status: null,
        baslangic: 0,
        yuzde: 0,
        tamamlanan: {},
        kapandi: false,
        timer: null,
        sizmaTimer: null,
    };

    function el(id) {
        return document.getElementById(id);
    }

    function init() {
        durum.el = el('appBoot');
        if (!durum.el) return;

        asamalariKur(durum.el);
        durum.bar = durum.el.querySelector('.app-boot__bar');
        durum.status = durum.el.querySelector('.app-boot__status');
        durum.baslangic = Date.now();

        yuzdeYaz(6);
        durumYaz('Başlatılıyor');

        // Güvenlik ağı: ne olursa olsun perde kalkar
        durum.timer = setTimeout(function () {
            dismiss('zaman-asimi');
        }, SERT_ZAMAN_ASIMI_MS);

        // Bir aşama uzun sürerse çubuk çok yavaş ilerlesin — donmuş görünmesin
        durum.sizmaTimer = setInterval(function () {
            var hedef = sonrakiHedef();
            if (durum.yuzde < hedef - 4) {
                yuzdeYaz(durum.yuzde + 0.6);
            }
        }, 400);
    }

    function sonrakiHedef() {
        for (var i = 0; i < ASAMALAR.length; i++) {
            if (!durum.tamamlanan[ASAMALAR[i].ad]) return ASAMALAR[i].yuzde;
        }
        return 100;
    }

    function yuzdeYaz(v) {
        durum.yuzde = Math.max(durum.yuzde, Math.min(100, v));
        if (durum.bar) {
            durum.bar.style.transform = 'scaleX(' + (durum.yuzde / 100) + ')';
        }
    }

    function durumYaz(metin) {
        if (!durum.status || durum.status.textContent === metin) return;
        durum.status.classList.add('is-swapping');
        setTimeout(function () {
            if (!durum.status) return;
            durum.status.textContent = metin;
            durum.status.classList.remove('is-swapping');
        }, 180);
    }

    /** Bir yükleme aşamasının bittiğini bildirir. */
    function step(ad) {
        if (durum.kapandi || durum.tamamlanan[ad]) return;
        // Bu sayfanın beklemediği bir aşama bildirildiyse yok say
        var taniniyor = ASAMALAR.some(function (a) { return a.ad === ad; });
        if (!taniniyor) return;
        durum.tamamlanan[ad] = true;

        for (var i = 0; i < ASAMALAR.length; i++) {
            if (ASAMALAR[i].ad === ad) {
                yuzdeYaz(ASAMALAR[i].yuzde);
                var sonraki = ASAMALAR[i + 1];
                durumYaz(sonraki ? sonraki.metin : 'Hazır');
                break;
            }
        }

        // Tüm aşamalar bitti mi?
        var hepsi = ASAMALAR.every(function (a) {
            return durum.tamamlanan[a.ad];
        });
        if (hepsi) {
            yuzdeYaz(100);
            dismiss('tamamlandi');
        }
    }

    /** Perdeyi kaldırır. Birden çok kez çağrılabilir. */
    function dismiss(sebep) {
        if (durum.kapandi) return;
        durum.kapandi = true;

        clearTimeout(durum.timer);
        clearInterval(durum.sizmaTimer);
        yuzdeYaz(100);

        // Çok hızlı biterse perde "çakmış" gibi görünmesin
        var gecen = Date.now() - durum.baslangic;
        var bekle = Math.max(0, MIN_GOSTERIM_MS - gecen);

        setTimeout(function () {
            var perde = durum.el || el('appBoot');
            if (perde) {
                perde.classList.remove('app-boot--active');
                perde.setAttribute('aria-hidden', 'true');
                // Geçiş bitince DOM'dan tamamen kaldır
                setTimeout(function () {
                    if (perde && perde.parentNode) perde.parentNode.removeChild(perde);
                }, 500);
            }
            document.documentElement.classList.remove('boot-locked');
            revealHeader();
            if (sebep === 'zaman-asimi') {
                console.warn('Açılış perdesi zaman aşımıyla kaldırıldı.');
            }
        }, bekle);
    }

    /**
     * Header elemanlarını sırayla ortaya çıkarır.
     *
     * Dinlenme hâli görünür: .boot-reveal (gizli) eklenip bir sonraki karede
     * .boot-reveal-ready ile açılıyor. Zamanlayıcı hiç çalışmazsa bile
     * eleman görünür kalır.
     */
    function revealHeader() {
        /*
         * Sayfa başına ortaya çıkma sırası. Var olmayan id'ler sessizce
         * atlanır, bu yüzden tek liste tüm sayfalarda güvenle kullanılabilir.
         * Sıra bilinçli: önce kimlik (kullanıcı/depo), sonra gezinme,
         * sonra sayaç, en son içerik blokları.
         */
        var sira = [
            // ürün arama
            { id: 'headerUserHost', gecikme: 0 },
            { id: 'headerPremiumNavHost', gecikme: 90 },
            { id: 'trialCountdownHost', gecikme: 170 },
            // sayım
            { id: 'countingHeaderUserHost', gecikme: 0 },
            { id: 'countingStatsHost', gecikme: 90 },
            { id: 'sayimActiveTableHost', gecikme: 150 },
            { id: 'sayimGeneralListHost', gecikme: 210 },
            { id: 'countingMainDataHost', gecikme: 260 },
            // ajanda
            { id: 'agendaHost', gecikme: 90 },
            // raftaki eksikler
            { id: 'shelfGridHost', gecikme: 90 },
            { id: 'basketHost', gecikme: 160 },
        ];

        sira.forEach(function (item) {
            var node = el(item.id);
            if (!node) return;
            node.classList.add('boot-reveal');
            setTimeout(function () {
                node.classList.add('boot-reveal-ready');
                setTimeout(function () {
                    node.classList.remove('boot-reveal', 'boot-reveal-ready');
                }, 600);
            }, item.gecikme);
        });

        var ana = document.querySelector('main');
        if (ana) {
            ana.classList.add('boot-content-enter');
            setTimeout(function () {
                ana.classList.remove('boot-content-enter');
            }, 700);
        }
    }

    global.AppBoot = {
        init: init,
        step: step,
        dismiss: dismiss,
        get kapandi() {
            return durum.kapandi;
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : globalThis);
