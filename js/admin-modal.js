/**
 * Admin paneli: modal denetleyicisi
 * ============================================================================
 *
 * NEDEN VAR
 * Paneldeki on modal `hidden` sınıfı eklenip çıkarılarak açılıp kapanıyor ve
 * bunu yapan kırk ayrı çağrı `admin.js` içinde dağınık duruyor. Davranışı
 * tek tek o çağrılara yazmak yerine sınıf değişimi buradan izleniyor:
 * `admin.js` tarafında tek satır değişmeden bütün modallar aynı davranışı
 * kazanıyor.
 *
 * NE YAPIYOR
 * 1. GÖRÜNÜR YÜKSEKLİK. Telefonda klavye açılınca `100vh` küçülmüyor;
 *    odaklanılan alan klavyenin altında kalıyor ve "Oluştur" düğmesi
 *    görünmüyordu. `visualViewport` ölçülüp `--adm-gorunur-y` yazılıyor,
 *    modal o yüksekliğe oturuyor, ayak satırı klavyenin üstünde kalıyor.
 * 2. GÖVDE KİLİDİ. Modal açıkken arkadaki sayfa kaymıyor. Telefonda
 *    `overflow: hidden` yetmiyor (iOS gövdeyi yine kaydırıyor), bu yüzden
 *    gövde konumu dondurulup kapanışta kaldığı yere geri veriliyor.
 * 3. KAPATMA YOLLARI. Esc, zemine dokunuş, `data-adm-kapat` taşıyan her
 *    düğme. Üçü de aynı yoldan geçiyor.
 * 4. ODAK. Açılışta ilk alana, kapanışta modalı açan düğmeye dönüyor.
 *    Tab tuşu panelin dışına çıkmıyor.
 *
 * AYRICA
 * `admOnay()` tarayıcının `confirm()` kutusunun yerini alıyor: aynı modal
 * deseni, panelin kendi dili. `admBildir()` da `alert()` yerine kısa bir
 * bildirim düşürüyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ODAKLANABILIR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

    var yigin = [];            /* açık modallar, en üstteki sonda */
    var oncekiOdak = null;     /* modal açılmadan önce odakta olan öğe */
    var kilitliKaydirma = 0;   /* gövde dondurulduğundaki kaydırma konumu */

    function darMi() {
        return global.matchMedia && global.matchMedia('(max-width: 767px)').matches;
    }

    /* ── Görünür alan ─────────────────────────────────────────────────── */
    function gorunuruOlc() {
        var vv = global.visualViewport;
        var kok = document.documentElement;
        if (vv) {
            kok.style.setProperty('--adm-gorunur-y', vv.height + 'px');
        } else {
            kok.style.removeProperty('--adm-gorunur-y');
        }
        /* Klavye açılınca panel kısalıyor; `top` görünür alanın kaydığı
           kadar itilmezse panel klavyenin altına kayıyor. */
        for (var i = 0; i < yigin.length; i++) {
            yigin[i].style.top = (vv ? vv.offsetTop : 0) + 'px';
        }
    }

    if (global.visualViewport) {
        global.visualViewport.addEventListener('resize', gorunuruOlc);
        global.visualViewport.addEventListener('scroll', gorunuruOlc);
    }

    /* ── Gövde kilidi ─────────────────────────────────────────────────── */
    function govdeyiKilitle() {
        if (document.body.classList.contains('adm-modal-acik')) return;
        kilitliKaydirma = global.scrollY || global.pageYOffset || 0;
        document.body.classList.add('adm-modal-acik');
        if (darMi()) {
            document.body.style.position = 'fixed';
            document.body.style.top = (-kilitliKaydirma) + 'px';
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
        }
    }

    function govdeyiCoz() {
        if (yigin.length) return;
        if (!document.body.classList.contains('adm-modal-acik')) return;
        document.body.classList.remove('adm-modal-acik');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        /* `position: fixed` kalkınca tarayıcı en üste atlıyor; kullanıcı
           listede neredeyse oraya geri konuyor. */
        global.scrollTo(0, kilitliKaydirma);
    }

    /* ── Açılış / kapanış ─────────────────────────────────────────────── */
    function panel(modal) {
        return modal.querySelector('.adm-modal-panel');
    }

    function acildi(modal) {
        if (yigin.indexOf(modal) !== -1) return;
        if (!yigin.length) oncekiOdak = document.activeElement;
        yigin.push(modal);
        govdeyiKilitle();
        gorunuruOlc();

        var p = panel(modal);
        if (p) p.scrollTop = 0;
        var govde = modal.querySelector('.adm-modal-govde');
        if (govde) govde.scrollTop = 0;

        /* Odak tıklama görevinin içinde veriliyor: telefonda klavyenin
           açılması için tarayıcı kullanıcı hareketi arıyor, sonraya
           ertelenirse hareket bağı kopuyor. */
        var hedefKimlik = modal.getAttribute('data-odak');
        var hedef = hedefKimlik ? modal.querySelector('#' + hedefKimlik) : null;
        if (!hedef && p) {
            /* Salt okunur alan odak almasın, ilk gerçek giriş alanı alsın. */
            hedef = p.querySelector('.adm-modal-govde input:not([readonly]):not([type="hidden"]):not([hidden]), .adm-modal-govde textarea:not([readonly])');
        }
        if (!hedef && p) hedef = p.querySelector(ODAKLANABILIR);
        if (hedef) { try { hedef.focus({ preventScroll: true }); } catch (e) { hedef.focus(); } }
    }

    function kapandi(modal) {
        var yer = yigin.indexOf(modal);
        if (yer === -1) return;
        yigin.splice(yer, 1);
        modal.style.top = '';
        govdeyiCoz();
        if (!yigin.length && oncekiOdak && document.contains(oncekiOdak)) {
            try { oncekiOdak.focus({ preventScroll: true }); } catch (e) { /* odak verilemedi */ }
            oncekiOdak = null;
        }
    }

    function kapat(modal) {
        if (!modal) return;
        /* Kapatma yolu tek: sınıf. Gözlemci gerisini hallediyor, böylece
           `admin.js` içindeki doğrudan `classList.add('hidden')` çağrıları
           da aynı temizlikten geçiyor. */
        modal.classList.add('hidden');
    }

    /* ── Gözlemci: `hidden` sınıfı değişimini yakalıyor ───────────────── */
    var gozlemci = new MutationObserver(function (kayitlar) {
        for (var i = 0; i < kayitlar.length; i++) {
            var h = kayitlar[i].target;
            if (!h.classList || !h.classList.contains('adm-modal')) continue;
            if (h.classList.contains('hidden')) kapandi(h);
            else acildi(h);
        }
    });

    function modallariBagla() {
        var liste = document.querySelectorAll('.adm-modal');
        for (var i = 0; i < liste.length; i++) {
            gozlemci.observe(liste[i], { attributes: true, attributeFilter: ['class'] });
            if (!liste[i].classList.contains('hidden')) acildi(liste[i]);
        }
    }

    /* ── Kapatma yolları ──────────────────────────────────────────────── */
    document.addEventListener('click', function (e) {
        var kapatici = e.target.closest ? e.target.closest('[data-adm-kapat]') : null;
        if (!kapatici) return;
        var modal = kapatici.closest('.adm-modal');
        if (modal) kapat(modal);
    });

    document.addEventListener('keydown', function (e) {
        if (!yigin.length) return;
        var ustteki = yigin[yigin.length - 1];

        if (e.key === 'Escape') {
            e.preventDefault();
            kapat(ustteki);
            return;
        }

        if (e.key !== 'Tab') return;
        var p = panel(ustteki);
        if (!p) return;
        var alanlar = Array.prototype.filter.call(p.querySelectorAll(ODAKLANABILIR), function (el) {
            return el.offsetParent !== null || el === document.activeElement;
        });
        if (!alanlar.length) return;
        var ilk = alanlar[0];
        var son = alanlar[alanlar.length - 1];
        if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
        else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    });

    /* Klavye açıldığında odaklanılan alan görünür alanın ortasına gelsin:
       tarayıcının kendi kaydırması modalın içindeki kaba her zaman
       uymuyor, alan başlığın altında kalabiliyor. */
    document.addEventListener('focusin', function (e) {
        if (!yigin.length) return;
        var modal = e.target.closest ? e.target.closest('.adm-modal') : null;
        if (!modal) return;
        var alan = e.target;
        if (!alan.matches || !alan.matches('input, textarea, select')) return;
        setTimeout(function () {
            if (document.activeElement !== alan) return;
            try { alan.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { /* eski tarayıcı */ }
        }, 260);
    });

    /* ── Onay tabakası ────────────────────────────────────────────────── */
    var onayCozucu = null;

    function admOnay(secenekler) {
        var ayar = typeof secenekler === 'string' ? { metin: secenekler } : (secenekler || {});
        var modal = document.getElementById('admOnayModal');
        if (!modal) return Promise.resolve(global.confirm(ayar.metin || 'Emin misiniz?'));

        document.getElementById('admOnayBaslik').textContent = ayar.baslik || 'Emin misiniz?';
        document.getElementById('admOnayMetin').innerHTML = ayar.metin || '';

        var evet = document.getElementById('admOnayEvet');
        evet.textContent = ayar.onayla || 'Devam';
        evet.classList.toggle('adm-btn-danger', ayar.tehlike === true);
        evet.classList.toggle('adm-btn-primary', ayar.tehlike !== true);

        /* Odak "Vazgeç"te başlıyor (`data-odak`): yanlışlıkla Enter'a
           basmak yıkıcı eylemi tetiklemesin. */
        modal.classList.remove('hidden');

        return new Promise(function (coz) {
            onayCozucu = coz;
        });
    }

    function onayiBitir(sonuc) {
        var coz = onayCozucu;
        onayCozucu = null;
        if (coz) coz(sonuc);
    }

    /* Onay metni HTML olarak basılıyor (kalın yazı için). İçine giren
       kullanıcı adı veritabanından geliyor, işaret taşıyabilir. */
    function admKacis(metin) {
        var kap = document.createElement('span');
        kap.textContent = String(metin == null ? '' : metin);
        return kap.innerHTML;
    }

    /* ── Bildirim ─────────────────────────────────────────────────────── */
    function admBildir(metin, tip) {
        var yuva = document.getElementById('admBildirimYuva');
        if (!yuva) { global.alert(metin); return; }
        var kutu = document.createElement('div');
        kutu.className = 'adm-bildirim' + (tip ? ' adm-bildirim--' + tip : '');
        kutu.textContent = metin;
        yuva.appendChild(kutu);
        setTimeout(function () {
            kutu.classList.add('cikiyor');
            setTimeout(function () { kutu.remove(); }, 200);
        }, tip === 'hata' ? 5000 : 3200);
    }

    /* ── Parola göster/gizle ──────────────────────────────────────────── */
    var GOZ_ACIK = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
    var GOZ_KAPALI = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>';

    document.addEventListener('click', function (e) {
        var dugme = e.target.closest ? e.target.closest('.adm-alan-parola button') : null;
        if (!dugme) return;
        var alan = dugme.parentNode.querySelector('input');
        if (!alan) return;
        var gizli = alan.type === 'password';
        alan.type = gizli ? 'text' : 'password';
        dugme.innerHTML = gizli ? GOZ_KAPALI : GOZ_ACIK;
        dugme.setAttribute('aria-label', gizli ? 'Parolayı gizle' : 'Parolayı göster');
    });

    function baslat() {
        modallariBagla();
        gorunuruOlc();

        var evet = document.getElementById('admOnayEvet');
        if (evet) {
            evet.addEventListener('click', function () {
                kapat(document.getElementById('admOnayModal'));
                onayiBitir(true);
            });
        }
        var onayModal = document.getElementById('admOnayModal');
        if (onayModal) {
            /* Zemine dokunmak, Esc ve "Vazgeç" hepsi aynı sonuca çıkıyor:
               bekleyen söz `false` ile kapanmazsa çağıran taraf asılı
               kalır. */
            gozlemci.observe(onayModal, { attributes: true, attributeFilter: ['class'] });
            new MutationObserver(function () {
                if (onayModal.classList.contains('hidden')) onayiBitir(false);
            }).observe(onayModal, { attributes: true, attributeFilter: ['class'] });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
    else baslat();

    global.admOnay = admOnay;
    global.admKacis = admKacis;
    global.admBildir = admBildir;
    global.JBAdminModal = { kapat: kapat, bagla: modallariBagla };
})(window);
