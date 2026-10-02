/**
 * Arama sayfası: ajanda hatırlatıcı zili
 * ============================================================================
 *
 *  - Ayarlar düğmesinin soluna zil (telefonda menü düğmesinin soluna).
 *  - Zile basınca aşağı doğru küçük bir liste açılır: ürün görseli, adı,
 *    eksik adet, tarihe göre gruplu.
 *  - Ajanda düğmesinin köşesinde kırmızı ünlem, mobil menüde sayı.
 *  - Bir satıra basınca ajandada o kayıt açılır. Hatırlatıcı oradan kapatılır.
 *
 * Yalnız Ürün Ajandası hakkı olan kullanıcıda görünür. Hak bilgisi arama
 * sayfasındaki updatePremiumNavVisibility'den gelir: JBAjandaZil.hakGuncelle().
 *
 * Veri: js/ajanda-hatirlatici.js. Önce önbellekten anında çizilir, sonra
 * arka planda tazelenir; sayfa açılışını bekletmez.
 * ============================================================================
 */
(function () {
    'use strict';

    var TAZELEME_ARALIGI = 3 * 60 * 1000;
    var EN_AZ_ARALIK = 20 * 1000;

    var hak = false;
    var ogeler = null;          // null: henüz bilinmiyor
    var durum = 'bos';          // 'yukleniyor' | 'hata' | 'hazir'
    var sonTazeleme = 0;
    var tazeleniyor = null;
    var zamanlayici = null;
    var acik = false;
    var dom = null;
    var oncekiOdak = null;

    function H() { return window.JBAjandaHatirlatici || null; }

    function kacir(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* Görsel yalnız http(s) ya da sitenin kendi yolu olabilir */
    function guvenliGorsel(u) {
        var s = String(u || '').trim();
        if (/^https?:\/\//i.test(s) || /^\.\.?\//.test(s) || /^\/(?!\/)/.test(s)) return s;
        return '../assets/logo.png';
    }

    var ZIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>';
    var OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

    // ------------------------------------------------------------------
    // Tarih
    // ------------------------------------------------------------------

    function gunAnahtari(o) {
        var ham = o && (o.event_date || o.created_at);
        if (!ham) return '0000-00-00';
        var s = String(ham);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        var d = new Date(ham);
        if (isNaN(d.getTime())) return s.slice(0, 10);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function yerelGun(t) {
        var d = new Date(t);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function gunEtiketi(anahtar) {
        var bugun = yerelGun(Date.now());
        if (anahtar === bugun) return 'Bugün';
        if (anahtar === yerelGun(Date.now() - 864e5)) return 'Dün';
        var d = new Date(anahtar + 'T12:00:00');
        if (isNaN(d.getTime())) return anahtar;
        var ayni = d.getFullYear() === new Date().getFullYear();
        return d.toLocaleDateString('tr-TR', ayni
            ? { day: 'numeric', month: 'long', weekday: 'long' }
            : { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function gunFarki(anahtar) {
        var a = new Date(anahtar + 'T12:00:00').getTime();
        var b = new Date(yerelGun(Date.now()) + 'T12:00:00').getTime();
        if (isNaN(a)) return 0;
        return Math.max(0, Math.round((b - a) / 864e5));
    }

    // ------------------------------------------------------------------
    // Kurulum
    // ------------------------------------------------------------------

    function kur() {
        if (dom) return dom;
        var ayarlar = document.getElementById('settingsBtn');
        var menu = document.getElementById('hamburgerMenuBtn');
        if (!ayarlar && !menu) return null;

        var masaustu = null;
        if (ayarlar && ayarlar.parentNode) {
            masaustu = document.createElement('button');
            masaustu.type = 'button';
            masaustu.id = 'ajandaZilBtn';
            masaustu.className = 'header-icon-btn az-zil';
            masaustu.hidden = true;
            masaustu.innerHTML = ZIL + '<span class="az-zil__sayi" hidden></span>';
            ayarlar.parentNode.insertBefore(masaustu, ayarlar);
        }

        var mobil = null;
        if (menu && menu.parentNode) {
            mobil = document.createElement('button');
            mobil.type = 'button';
            mobil.id = 'ajandaZilMobilBtn';
            mobil.className = 'az-zil az-zil--mobil';
            mobil.hidden = true;
            mobil.innerHTML = ZIL + '<span class="az-zil__sayi" hidden></span>';
            menu.parentNode.insertBefore(mobil, menu);
        }

        var panel = document.createElement('div');
        panel.id = 'ajandaZilPanel';
        panel.className = 'az-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'ajandaZilBaslik');
        panel.innerHTML =
            '<div class="az-panel__bas">' +
                '<div class="az-panel__bas-metin">' +
                    '<h2 class="az-panel__baslik" id="ajandaZilBaslik">Hatırlatıcılar</h2>' +
                    '<p class="az-panel__ozet"></p>' +
                '</div>' +
            '</div>' +
            '<div class="az-panel__govde"></div>' +
            '<div class="az-panel__alt">' +
                '<p class="az-panel__ipucu">Kapatmak için ürüne bas, ajandadan kapat.</p>' +
                '<button type="button" class="az-panel__git">Ajandaya git</button>' +
            '</div>';
        document.body.appendChild(panel);

        dom = {
            dugmeler: [masaustu, mobil].filter(Boolean),
            panel: panel,
            ozet: panel.querySelector('.az-panel__ozet'),
            govde: panel.querySelector('.az-panel__govde'),
            git: panel.querySelector('.az-panel__git')
        };

        dom.dugmeler.forEach(function (b) {
            b.setAttribute('aria-haspopup', 'dialog');
            b.setAttribute('aria-expanded', 'false');
            b.setAttribute('aria-controls', 'ajandaZilPanel');
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                if (acik) kapat(); else ac(b);
            });
        });

        dom.git.addEventListener('click', function () { git(null); });

        dom.govde.addEventListener('click', function (e) {
            var satir = e.target.closest('[data-kayit]');
            if (satir) { git(satir.getAttribute('data-kayit')); return; }
            if (e.target.closest('[data-az="tekrar"]')) tazele(true);
        });

        dom.govde.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            var hepsi = Array.prototype.slice.call(dom.govde.querySelectorAll('[data-kayit]'));
            var i = hepsi.indexOf(document.activeElement);
            if (i === -1) return;
            e.preventDefault();
            var j = e.key === 'ArrowDown' ? Math.min(hepsi.length - 1, i + 1) : Math.max(0, i - 1);
            hepsi[j].focus();
        });

        document.addEventListener('click', function (e) {
            if (!acik) return;
            if (dom.panel.contains(e.target)) return;
            if (dom.dugmeler.some(function (b) { return b.contains(e.target); })) return;
            kapat(true);
        });

        document.addEventListener('keydown', function (e) {
            if (acik && e.key === 'Escape') {
                e.stopPropagation();
                kapat();
            }
        }, true);

        window.addEventListener('resize', function () { if (acik) konumla(); });

        return dom;
    }

    // ------------------------------------------------------------------
    // Görünüm
    // ------------------------------------------------------------------

    function rozetleriYaz() {
        var n = Array.isArray(ogeler) ? ogeler.length : 0;
        var goster = hak && n > 0;

        if (dom) {
            dom.dugmeler.forEach(function (b) {
                b.hidden = !hak;
                var s = b.querySelector('.az-zil__sayi');
                s.hidden = !goster;
                s.textContent = n > 99 ? '99+' : String(n);
                var etiket = goster ? 'Hatırlatıcılar, ' + n + ' açık' : 'Hatırlatıcılar';
                b.setAttribute('aria-label', etiket);
                b.title = etiket;
                b.classList.toggle('is-dolu', goster);
            });
        }

        var cip = document.getElementById('headerAgendaPageBtn');
        if (cip) {
            var unlem = cip.querySelector('.az-unlem');
            if (goster && !unlem) {
                unlem = document.createElement('span');
                unlem.className = 'az-unlem';
                unlem.setAttribute('aria-hidden', 'true');
                unlem.textContent = '!';
                cip.appendChild(unlem);
            } else if (!goster && unlem) {
                unlem.remove();
            }
            cip.classList.toggle('az-cip', true);
            cip.setAttribute('aria-label', goster ? 'Ürün Ajandası, ' + n + ' hatırlatıcı' : 'Ürün Ajandası');
        }

        var mobil = document.getElementById('mobileAgendaPageBtn');
        if (mobil) {
            var sayi = mobil.querySelector('.az-menu-sayi');
            if (goster) {
                if (!sayi) {
                    sayi = document.createElement('span');
                    sayi.className = 'az-menu-sayi';
                    mobil.appendChild(sayi);
                }
                sayi.textContent = n > 99 ? '99+' : String(n);
                sayi.setAttribute('aria-label', n + ' hatırlatıcı');
            } else if (sayi) {
                sayi.remove();
            }
        }
    }

    function iskelet() {
        var h = '';
        for (var i = 0; i < 3; i++) {
            h += '<div class="az-satir az-satir--iskelet" aria-hidden="true">' +
                '<span class="az-iskelet az-iskelet--gorsel"></span>' +
                '<span class="az-satir__metin"><span class="az-iskelet az-iskelet--ad"></span><span class="az-iskelet az-iskelet--alt"></span></span>' +
                '</div>';
        }
        return h;
    }

    function panelYaz() {
        if (!dom) return;
        var liste = Array.isArray(ogeler) ? ogeler : [];

        if (!liste.length) {
            dom.ozet.textContent = '';
            if (ogeler === null && durum === 'yukleniyor') {
                dom.govde.innerHTML = iskelet();
                dom.govde.setAttribute('aria-busy', 'true');
                return;
            }
            dom.govde.removeAttribute('aria-busy');
            if (durum === 'hata' && ogeler === null) {
                dom.govde.innerHTML =
                    '<div class="az-bos"><p class="az-bos__baslik">Hatırlatıcılar yüklenemedi</p>' +
                    '<p class="az-bos__metin">Bağlantını kontrol et.</p>' +
                    '<button type="button" class="az-bos__eylem" data-az="tekrar">Tekrar dene</button></div>';
                return;
            }
            dom.govde.innerHTML =
                '<div class="az-bos"><span class="az-bos__ikon">' + ZIL + '</span>' +
                '<p class="az-bos__baslik">Açık hatırlatıcı yok</p>' +
                '<p class="az-bos__metin">Ajandaya ürün eklerken "Hatırlatıcı kur"u açarsan burada görünür.</p></div>';
            return;
        }

        dom.govde.removeAttribute('aria-busy');
        var toplam = liste.reduce(function (t, o) { return t + (Number(o.quantity) || 1); }, 0);
        dom.ozet.textContent = liste.length + ' ürün · toplam ' + toplam + ' adet eksik';

        // Tarihe göre grupla (yeniden eskiye)
        var gruplar = new Map();
        liste.slice().sort(function (a, b) {
            var ka = gunAnahtari(a), kb = gunAnahtari(b);
            if (ka !== kb) return kb.localeCompare(ka);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }).forEach(function (o) {
            var k = gunAnahtari(o);
            if (!gruplar.has(k)) gruplar.set(k, []);
            gruplar.get(k).push(o);
        });

        var h = '';
        gruplar.forEach(function (grup, k) {
            var fark = gunFarki(k);
            h += '<section class="az-grup"><h3 class="az-grup__baslik">' + kacir(gunEtiketi(k)) +
                (fark >= 2 ? '<span class="az-grup__fark">' + fark + ' gündür bekliyor</span>' : '') + '</h3>';
            grup.forEach(function (o) {
                var adet = Number(o.quantity) || 1;
                h += '<button type="button" class="az-satir" data-kayit="' + kacir(o.id) + '">' +
                    '<img class="az-satir__gorsel" src="' + kacir(guvenliGorsel(o.product_image)) + '" alt="" loading="lazy" decoding="async">' +
                    '<span class="az-satir__metin">' +
                        '<span class="az-satir__ad">' + kacir(o.product_name || 'Ürün') + '</span>' +
                        '<span class="az-satir__alt">' + kacir(o.reason_preset || 'Eksik ürün') + '</span>' +
                    '</span>' +
                    '<span class="az-satir__adet">−' + adet + ' adet</span>' +
                    '<span class="az-satir__ok">' + OK + '</span>' +
                '</button>';
            });
            h += '</section>';
        });
        dom.govde.innerHTML = h;
    }

    function konumla() {
        if (!dom || !dom.acan) return;
        var p = dom.panel;
        var r = dom.acan.getBoundingClientRect();
        var genislik = document.documentElement.clientWidth;
        var dar = genislik <= 768;
        var ust = r.bottom + window.scrollY + 8;
        if (dar) {
            p.style.left = '12px';
            p.style.right = '12px';
            p.style.width = 'auto';
        } else {
            var w = Math.min(380, genislik - 24);
            var sol = Math.min(Math.max(12, r.right - w), genislik - w - 12);
            p.style.left = (sol + window.scrollX) + 'px';
            p.style.right = 'auto';
            p.style.width = w + 'px';
        }
        p.style.top = ust + 'px';
    }

    function ac(dugme) {
        if (!dom || !hak) return;
        acik = true;
        oncekiOdak = document.activeElement;
        dom.acan = dugme;
        panelYaz();
        dom.panel.hidden = false;
        konumla();
        requestAnimationFrame(function () { dom.panel.classList.add('is-acik'); });
        dom.dugmeler.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
        // Açınca taze veri iste (yakın zamanda alınmadıysa)
        tazele(false);
        var ilk = dom.govde.querySelector('[data-kayit]') || dom.git;
        try { ilk.focus({ preventScroll: true }); } catch (e) {}
    }

    function kapat(disaridan) {
        if (!dom || !acik) return;
        acik = false;
        dom.panel.classList.remove('is-acik');
        dom.panel.hidden = true;
        dom.dugmeler.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        // Dışarı tıklanarak kapandıysa odağı zorla geri alma
        if (!disaridan && oncekiOdak && document.contains(oncekiOdak)) {
            try { oncekiOdak.focus({ preventScroll: true }); } catch (e) {}
        }
        oncekiOdak = null;
    }

    function git(id) {
        var url = '../ajanda/' + (id ? '?kayit=' + encodeURIComponent(id) : '');
        kapat(true);
        window.location.replace(url);
    }

    // ------------------------------------------------------------------
    // Veri
    // ------------------------------------------------------------------

    function onbellektenAl() {
        var h = H();
        var v = h && h.onbellekOku();
        if (v) ogeler = v.ogeler;
    }

    function tazele(zorla) {
        var h = H();
        if (!hak || !h) return Promise.resolve();
        if (tazeleniyor) return tazeleniyor;
        if (!zorla && Date.now() - sonTazeleme < EN_AZ_ARALIK) return Promise.resolve();
        if (ogeler === null) {
            durum = 'yukleniyor';
            if (acik) panelYaz();
        }
        tazeleniyor = h.listele().then(function (liste) {
            ogeler = liste;
            durum = 'hazir';
            sonTazeleme = Date.now();
        }, function (e) {
            console.warn('Hatırlatıcılar alınamadı:', e && e.message ? e.message : e);
            durum = 'hata';
        }).then(function () {
            tazeleniyor = null;
            rozetleriYaz();
            if (acik) { panelYaz(); konumla(); }
        });
        return tazeleniyor;
    }

    function zamanlayiciKur() {
        if (zamanlayici) clearInterval(zamanlayici);
        zamanlayici = setInterval(function () {
            if (document.visibilityState === 'visible') tazele(false);
        }, TAZELEME_ARALIGI);
    }

    function hakGuncelle(yeni) {
        yeni = !!yeni;
        if (!kur()) { hak = yeni; return; }
        var degisti = yeni !== hak;
        hak = yeni;
        if (!hak) {
            if (acik) kapat(true);
            if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
            rozetleriYaz();
            return;
        }
        if (ogeler === null) onbellektenAl();
        rozetleriYaz();
        if (degisti || !zamanlayici) {
            zamanlayiciKur();
            tazele(true);
        }
    }

    function baslat() {
        kur();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') tazele(false);
        });
        // Aynı tarayıcıda ajanda sekmesi değişiklik yaptıysa anında yansıt
        window.addEventListener('storage', function (e) {
            var h = H();
            if (!h || !e.key || !h.onbellekAnahtariMi(e.key)) return;
            onbellektenAl();
            durum = 'hazir';
            rozetleriYaz();
            if (acik) { panelYaz(); konumla(); }
        });
        // Arama sayfası hakkı bizden önce bildirdiyse
        if (typeof window.__jbAjandaHak === 'boolean') hakGuncelle(window.__jbAjandaHak);
    }

    window.JBAjandaZil = {
        hakGuncelle: hakGuncelle,
        tazele: function () { return tazele(true); },
        ac: function () {
            if (!dom) return;
            var gorunen = dom.dugmeler.filter(function (b) { return b.offsetParent !== null; })[0];
            if (gorunen) ac(gorunen);
        },
        kapat: function () { kapat(); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})();
