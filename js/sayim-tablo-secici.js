/**
 * Sayım v2: "Sayım tablonu seç" çekmecesi için yeni seçici
 * ============================================================================
 *
 * Eski çekmece v1'in parçalarını taşıyordu: hap şeklinde sarmalanan tablo
 * adları, ayrı bir günlük liste, türe basınca tablonun kendiliğinden
 * değişmesi. 130 tablo arasında göz yoruluyordu.
 *
 * Yeni seçici:
 *  - Tek sütun satır listesi: durum noktası, ad, ürün sayısı, durum.
 *  - Arama kutusu en üstte, açılınca odak orada. Enter ilk sonucu seçer.
 *  - Genel / Günlük yalnız süzgeç: basınca açık tablo DEĞİŞMEZ.
 *  - Ok tuşlarıyla gezinme.
 *
 * Eski görünüm silinmedi. Çekmecenin başındaki "Klasik görünüm" düğmesi
 * eskisine döndürür, tercih bu cihazda saklanır.
 *
 * counting.js'e dokunmaz. Motorun genel yöntemlerini kullanır:
 * getTableList, switchTable, isDailyTableName, deleteDailyTableByName.
 * ============================================================================
 */
(function () {
    'use strict';

    var ANAHTAR = 'jb_sayim_v2_secici';
    var GOVDE_SINIFI = 'v2-secici-yeni';

    var DURUM = {
        'not-started': 'Başlanmadı',
        incomplete: 'Sürüyor',
        'complete-positive': 'Sorunsuz',
        'complete-balanced': 'Sorunsuz',
        'complete-negative': 'Zararda'
    };

    var ikon = {
        ara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
        temizle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        tik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        sil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>',
        arti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
    };

    function el(id) { return document.getElementById(id); }
    function sistem() { return window.countingSystem || null; }

    function kacir(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* Türkçe büyük/küçük harf duyarsız arama: "İ" ve "I" doğru eşleşsin */
    function sade(s) {
        return String(s || '').toLocaleLowerCase('tr-TR')
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function yeniMi() {
        try { return localStorage.getItem(ANAHTAR) !== 'klasik'; } catch (e) { return true; }
    }

    function yerelIso(t) {
        var d = new Date(t);
        var a = d.getMonth() + 1, g = d.getDate();
        return d.getFullYear() + '-' + (a < 10 ? '0' : '') + a + '-' + (g < 10 ? '0' : '') + g;
    }

    function cekmeceAcikMi() {
        return document.body.classList.contains('v2-drawer-open');
    }

    // ------------------------------------------------------------------
    // Durum
    // ------------------------------------------------------------------

    var d = {
        kok: null, ara: null, temizle: null, liste: null, turlar: null, gunEkle: null,
        tur: null,            // 'genel' | 'gunluk'
        tablolar: null,       // motordan son alınan liste (önbellek)
        kirli: true,
        bekleyen: null,       // seçilmekte olan tablo adı
        cizimIstendi: false
    };

    function tablolariAl() {
        if (!d.kirli && d.tablolar) return d.tablolar;
        var cs = sistem();
        var ham = [];
        try { ham = cs && typeof cs.getTableList === 'function' ? cs.getTableList() : []; } catch (e) { ham = []; }
        var bugun = yerelIso(Date.now());
        var dun = yerelIso(Date.now() - 864e5);
        d.tablolar = ham.map(function (t) {
            var gunluk = !!(cs && cs.isDailyTableName && cs.isDailyTableName(t.name));
            var etiket = t.name;
            var iso = null;
            var ek = '';
            if (gunluk) {
                try {
                    iso = cs.getIsoFromDailyTableName(t.name);
                    etiket = cs.formatDailyDateLabelFromIso(iso) || t.name;
                } catch (e) { etiket = t.name; }
                if (iso === bugun) ek = 'Bugün';
                else if (iso === dun) ek = 'Dün';
            }
            var sabit = false;
            try { sabit = !gunluk && !!(cs.isPresetSubcategoryTable && cs.isPresetSubcategoryTable(t.name)); } catch (e) {}
            return {
                ad: t.name,
                etiket: etiket,
                aranan: sade(etiket + ' ' + t.name),
                gunluk: gunluk,
                iso: iso,
                ek: ek,
                sabit: sabit,
                adet: t.productCount || 0,
                durum: t.status || 'not-started',
                acik: !!t.isCurrent
            };
        });
        // Günlükler tarihe göre yeniden eskiye; genel tablolar motorun sırasıyla (son hareket)
        d.tablolar.sort(function (a, b) {
            if (a.gunluk && b.gunluk) return String(b.iso || '').localeCompare(String(a.iso || ''));
            return 0;
        });
        d.kirli = false;
        return d.tablolar;
    }

    // ------------------------------------------------------------------
    // Kurulum
    // ------------------------------------------------------------------

    function kur() {
        var govde = el('v2DrawerBody');
        var bas = document.querySelector('#v2Drawer .v2-drawer__head');
        if (!govde || !bas || el('v2Secici')) return !!el('v2Secici');

        // Görünüm düğmesi: kapat düğmesinin soluna
        var gecis = document.createElement('button');
        gecis.type = 'button';
        gecis.id = 'v2SeciciGecis';
        gecis.className = 'v2s-gecis';
        var kapat = el('v2DrawerClose');
        bas.insertBefore(gecis, kapat || null);
        // Başlık bloğu esnesin, düğmeler sağda dursun
        if (bas.firstElementChild && bas.firstElementChild !== gecis) bas.firstElementChild.classList.add('v2s-bas-metin');
        gecis.addEventListener('click', function () { modUygula(!yeniMi(), true); });

        var kok = document.createElement('div');
        kok.id = 'v2Secici';
        kok.className = 'v2s';
        kok.innerHTML =
            '<div class="v2s-ara">' +
                '<span class="v2s-ara__ikon">' + ikon.ara + '</span>' +
                '<input type="search" id="v2SeciciAra" class="v2s-ara__giris" placeholder="Tablo ara" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Tablo ara" aria-controls="v2SeciciListe">' +
                '<button type="button" class="v2s-ara__temizle" aria-label="Aramayı temizle" hidden>' + ikon.temizle + '</button>' +
            '</div>' +
            '<div class="v2s-tur" role="tablist" aria-label="Tablo türü">' +
                '<button type="button" role="tab" data-tur="genel" aria-selected="true">Genel <span class="v2s-tur__say">0</span></button>' +
                '<button type="button" role="tab" data-tur="gunluk" aria-selected="false">Günlük <span class="v2s-tur__say">0</span></button>' +
            '</div>' +
            '<div class="v2s-liste" id="v2SeciciListe" role="listbox" aria-label="Sayım tabloları"></div>' +
            '<button type="button" class="v2s-gun-ekle" hidden>' + ikon.arti + '<span>Gün ekle</span></button>';

        // Aktif tablo kartının hemen altına
        var kart = el('sayimActiveTableHost');
        if (kart && kart.parentNode === govde) govde.insertBefore(kok, kart.nextSibling);
        else govde.insertBefore(kok, govde.firstChild);

        d.kok = kok;
        d.ara = kok.querySelector('.v2s-ara__giris');
        d.temizle = kok.querySelector('.v2s-ara__temizle');
        d.liste = kok.querySelector('.v2s-liste');
        d.turlar = kok.querySelectorAll('.v2s-tur button');
        d.gunEkle = kok.querySelector('.v2s-gun-ekle');

        d.ara.addEventListener('input', function () {
            d.temizle.hidden = !d.ara.value;
            ciz();
        });
        d.ara.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                var ilk = d.liste.querySelector('.v2s-satir__sec');
                if (ilk) { e.preventDefault(); ilk.focus(); }
            } else if (e.key === 'Enter') {
                var hedef = d.liste.querySelector('.v2s-satir__sec');
                if (hedef) { e.preventDefault(); sec(hedef.dataset.ad); }
            }
        });
        d.temizle.addEventListener('click', function () {
            d.ara.value = '';
            d.temizle.hidden = true;
            ciz();
            d.ara.focus();
        });

        Array.prototype.forEach.call(d.turlar, function (b) {
            b.addEventListener('click', function () { turSec(b.dataset.tur); });
        });

        d.liste.addEventListener('click', function (e) {
            var silBtn = e.target.closest('.v2s-satir__sil');
            if (silBtn) {
                e.preventDefault();
                var cs = sistem();
                if (cs && typeof cs.deleteDailyTableByName === 'function') {
                    // Onay penceresi çekmecenin altında kalmasın
                    if (window.CountingV2) window.CountingV2.cekmeceKapat();
                    cs.deleteDailyTableByName(silBtn.dataset.ad);
                }
                return;
            }
            var secBtn = e.target.closest('.v2s-satir__sec');
            if (secBtn) sec(secBtn.dataset.ad);
        });

        d.liste.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
            var hepsi = Array.prototype.slice.call(d.liste.querySelectorAll('.v2s-satir__sec'));
            if (!hepsi.length) return;
            var i = hepsi.indexOf(document.activeElement);
            e.preventDefault();
            if (e.key === 'Home') i = 0;
            else if (e.key === 'End') i = hepsi.length - 1;
            else if (e.key === 'ArrowDown') i = Math.min(hepsi.length - 1, i + 1);
            else if (i <= 0) { d.ara.focus(); return; }
            else i = i - 1;
            hepsi[i].focus();
        });

        d.gunEkle.addEventListener('click', function () {
            var btn = el('sayimDailyAddOpenBtn');
            if (!btn) return;
            if (window.CountingV2) window.CountingV2.cekmeceKapat();
            btn.click();
        });

        return true;
    }

    function modUygula(yeni, kullanici) {
        document.body.classList.toggle(GOVDE_SINIFI, yeni);
        var gecis = el('v2SeciciGecis');
        if (gecis) {
            gecis.textContent = yeni ? 'Klasik görünüm' : 'Yeni görünüm';
            gecis.title = yeni ? 'Eski tablo seçiciye dön' : 'Yeni tablo seçiciyi kullan';
        }
        if (kullanici) {
            try { localStorage.setItem(ANAHTAR, yeni ? 'yeni' : 'klasik'); } catch (e) {}
            if (yeni) {
                d.kirli = true;
                acilista();
            } else {
                // Klasik listede motorun kendi araması var; odak oraya
                var q = el('generalTableSearch');
                if (q && q.offsetParent !== null) q.focus();
            }
        }
    }

    function turSec(tur) {
        if (tur !== 'genel' && tur !== 'gunluk') return;
        d.tur = tur;
        Array.prototype.forEach.call(d.turlar, function (b) {
            b.setAttribute('aria-selected', b.dataset.tur === tur ? 'true' : 'false');
        });
        ciz();
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function satirHtml(t) {
        var aktif = t.acik;
        var bekliyor = d.bekleyen === t.ad;
        var alt = t.adet + ' ürün · ' + (DURUM[t.durum] || DURUM['not-started']);
        var rozet = '';
        if (t.ek) rozet += '<span class="v2s-rozet v2s-rozet--gun">' + t.ek + '</span>';
        if (t.sabit) rozet += '<span class="v2s-rozet">Sabit</span>';
        var sag = aktif
            ? '<span class="v2s-satir__tik" aria-hidden="true">' + ikon.tik + '</span>'
            : (bekliyor ? '<span class="v2s-cark" aria-hidden="true"></span>' : '');
        var h =
            '<div class="v2s-satir' + (aktif ? ' is-aktif' : '') + (bekliyor ? ' is-bekliyor' : '') + '">' +
                '<button type="button" class="v2s-satir__sec" role="option" aria-selected="' + (aktif ? 'true' : 'false') + '" data-ad="' + kacir(t.ad) + '"' + (bekliyor ? ' aria-busy="true"' : '') + '>' +
                    '<span class="v2s-nokta v2s-nokta--' + kacir(t.durum) + '" aria-hidden="true"></span>' +
                    '<span class="v2s-satir__metin">' +
                        '<span class="v2s-satir__ad">' + kacir(t.etiket) + rozet + '</span>' +
                        '<span class="v2s-satir__alt">' + (aktif ? 'Açık · ' : '') + kacir(alt) + '</span>' +
                    '</span>' +
                    sag +
                '</button>';
        if (t.gunluk && !aktif) {
            h += '<button type="button" class="v2s-satir__sil" data-ad="' + kacir(t.ad) + '" aria-label="' + kacir(t.etiket) + ' gününü sil" title="Bu günü sil">' + ikon.sil + '</button>';
        }
        return h + '</div>';
    }

    function ciz() {
        if (!d.kok) return;
        var hepsi = tablolariAl();
        var genel = hepsi.filter(function (t) { return !t.gunluk; });
        var gunluk = hepsi.filter(function (t) { return t.gunluk; });

        d.turlar[0].querySelector('.v2s-tur__say').textContent = genel.length;
        d.turlar[1].querySelector('.v2s-tur__say').textContent = gunluk.length;

        var kaynak = d.tur === 'gunluk' ? gunluk : genel;
        var diger = d.tur === 'gunluk' ? genel : gunluk;
        var q = sade(d.ara.value.trim());
        var sonuc = q ? kaynak.filter(function (t) { return t.aranan.indexOf(q) !== -1; }) : kaynak;

        d.gunEkle.hidden = d.tur !== 'gunluk' || !el('sayimDailyAddOpenBtn');

        if (!sonuc.length) {
            var mesaj, eylem = '';
            if (q) {
                var digerSay = diger.filter(function (t) { return t.aranan.indexOf(q) !== -1; }).length;
                mesaj = '"' + kacir(d.ara.value.trim()) + '" ile eşleşen tablo yok.';
                if (digerSay) {
                    eylem = '<button type="button" class="v2s-bos__eylem" data-tur="' + (d.tur === 'gunluk' ? 'genel' : 'gunluk') + '">' +
                        (d.tur === 'gunluk' ? 'Genel' : 'Günlük') + ' tablolarda ' + digerSay + ' sonuç var</button>';
                }
            } else {
                mesaj = d.tur === 'gunluk'
                    ? 'Henüz günlük sayım yok. Aşağıdan gün ekleyebilirsin.'
                    : 'Henüz genel tablo yok. Aşağıdan yeni tablo oluşturabilirsin.';
            }
            d.liste.innerHTML = '<div class="v2s-bos"><p>' + mesaj + '</p>' + eylem + '</div>';
            var eb = d.liste.querySelector('.v2s-bos__eylem');
            if (eb) eb.addEventListener('click', function () { turSec(eb.dataset.tur); });
            return;
        }

        var html = '';
        for (var i = 0; i < sonuc.length; i++) html += satirHtml(sonuc[i]);
        d.liste.innerHTML = html;
    }

    function cizimIste() {
        if (d.cizimIstendi) return;
        d.cizimIstendi = true;
        requestAnimationFrame(function () {
            d.cizimIstendi = false;
            if (cekmeceAcikMi() && document.body.classList.contains(GOVDE_SINIFI)) ciz();
        });
    }

    // ------------------------------------------------------------------
    // Seçim
    // ------------------------------------------------------------------

    async function sec(ad) {
        var cs = sistem();
        if (!cs || !ad || d.bekleyen) return;
        if (ad === cs.currentTableName) {
            if (window.CountingV2) window.CountingV2.cekmeceKapat();
            return;
        }
        d.bekleyen = ad;
        ciz();
        try {
            await cs.switchTable(ad);
            // Çekmeceyi counting-v2-ui kapatıyor (başlık değişimini izliyor)
        } catch (e) {
            console.error('Tablo açılamadı:', e);
            if (typeof cs.showToast === 'function') cs.showToast('Tablo açılamadı. Tekrar dene.', 'error', 3500);
        } finally {
            d.bekleyen = null;
            d.kirli = true;
            ciz();
        }
    }

    // ------------------------------------------------------------------
    // Motora ve çekmeceye bağlan
    // ------------------------------------------------------------------

    function motoraBaglan() {
        var cs = sistem();
        if (!cs || cs.__v2SeciciBagli || typeof cs.updateTableSelector !== 'function') return !!(cs && cs.__v2SeciciBagli);
        var orijinal = cs.updateTableSelector;
        cs.__v2SeciciBagli = true;
        cs.updateTableSelector = function () {
            var sonuc = orijinal.apply(this, arguments);
            d.kirli = true;
            cizimIste();
            return sonuc;
        };
        return true;
    }

    /* Çekmece her açıldığında: açık tablonun türüne geç, listeyi tazele,
       odağı aramaya ver, açık satırı görünür yap. */
    function acilista() {
        if (!document.body.classList.contains(GOVDE_SINIFI) || !d.kok) return;
        var cs = sistem();
        d.kirli = true;
        var gunluk = !!(cs && cs.isDailyTableName && cs.isDailyTableName(cs.currentTableName));
        d.ara.value = '';
        d.temizle.hidden = true;
        turSec(gunluk ? 'gunluk' : 'genel');
        var aktif = d.liste.querySelector('.v2s-satir.is-aktif');
        if (aktif) {
            var ust = aktif.offsetTop - d.liste.offsetTop;
            if (ust > d.liste.clientHeight - aktif.offsetHeight) d.liste.scrollTop = ust - 8;
            else d.liste.scrollTop = 0;
        } else {
            d.liste.scrollTop = 0;
        }
        // counting-v2-ui 260 ms sonra odağı kendi yerine veriyor; ondan sonra
        setTimeout(function () {
            if (cekmeceAcikMi() && d.ara && !d.ara.contains(document.activeElement)) {
                try { d.ara.focus({ preventScroll: true }); } catch (e) { d.ara.focus(); }
            }
        }, 280);
    }

    function cekmeceyiIzle() {
        var acikti = cekmeceAcikMi();
        new MutationObserver(function () {
            var acik = cekmeceAcikMi();
            if (acik && !acikti) acilista();
            acikti = acik;
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    function baslat() {
        var deneme = 0;
        var t = setInterval(function () {
            deneme++;
            var hazir = el('v2Drawer') && el('v2DrawerBody');
            if (hazir && kur()) {
                clearInterval(t);
                modUygula(yeniMi(), false);
                cekmeceyiIzle();
                // Motor geç gelirse kısa süre yokla
                var m = 0;
                var mt = setInterval(function () {
                    m++;
                    if (motoraBaglan() || m > 80) clearInterval(mt);
                }, 250);
                if (cekmeceAcikMi()) acilista();
            } else if (deneme > 80) {
                clearInterval(t);
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})();
