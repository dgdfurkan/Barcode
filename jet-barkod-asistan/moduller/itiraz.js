/**
 * Modül: İtiraz Taslağı (franchise-v2, Depo Değerlendirme kayıt detayı)
 * ============================================================================
 *
 * Jet Barkod'daki İtiraz Yazıcı'da "Panelde Doldur"a basılınca arka plan
 * (arka-plan/itiraz.js) taslağı `jbaItirazTaslak`a yazar ve bu kaydın detay
 * sayfasını açar. Burası sayfanın sağ üstüne küçük bir kart koyar:
 *   - "Forma Yerleştir": panelin kendi "İtiraz Et" düğmesine basar, açılan
 *     formda sebebi seçer, metni yazar. KAYDET'E BASMAZ; son kontrol ve
 *     gönderme kullanıcıda.
 *   - "Kopyala": metni panoya alır.
 * Getir'e hiçbir istek atmaz; yalnız sayfadaki düğme ve formu kullanır.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var ANAHTAR = 'jbaItirazTaslak';
    var OMUR_MS = 2 * 60 * 60 * 1000;
    var YOL = /^\/dys\/dds100\/log\/detail\/([a-f0-9]{24})\/?$/;

    var etkin = false;
    var kap = null;
    var kok = null;
    var taslak = null;
    var mesgul = false;
    var izci = null;

    var STIL = [
        ':host { all: initial; }',
        '.kart { position: fixed; top: 80px; right: 24px; z-index: 2147483000; width: 380px; max-width: calc(100vw - 32px);',
        '  box-sizing: border-box; padding: 16px; border-radius: 16px; background: #fff; color: #111827;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px;',
        '  box-shadow: 0 24px 60px rgba(16,24,40,.18), 0 0 0 1px rgba(17,24,39,.08);',
        '  animation: gir 220ms cubic-bezier(.22,1,.36,1); display: flex; flex-direction: column; gap: 12px; }',
        '.kart *, .kart *::before { box-sizing: border-box; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }',
        '@media (prefers-reduced-motion: reduce) { .kart { animation: none; } }',
        'button { font-family: inherit; cursor: pointer; }',
        'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
        '.ust { display: flex; align-items: center; gap: 12px; }',
        '.ikon { flex: none; width: 36px; height: 36px; border-radius: 12px; background: #eef4ff; color: #2563eb; display: grid; place-items: center; }',
        'svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.baslik { flex: 1; min-width: 0; margin: 0; font-size: 15px; font-weight: 700; line-height: 20px; }',
        '.baslik small { display: block; font-size: 11px; font-weight: 500; color: #667085; line-height: 16px; }',
        '.kapat { flex: none; width: 32px; height: 32px; margin: -4px -4px 0 0; border: 0; border-radius: 999px; background: transparent; color: #667085; display: grid; place-items: center; }',
        '.kapat:hover { background: rgba(17,24,39,.06); color: #111827; }',
        '.sebep { align-self: flex-start; padding: 4px 8px; border-radius: 6px; background: #f2f4f7; color: #344054; font-size: 11px; font-weight: 600; line-height: 16px; }',
        '.metin { margin: 0; max-height: 160px; overflow-y: auto; padding: 12px; border-radius: 12px; background: #f9fafb; border: 1px solid #eaecf0;',
        '  font-size: 13px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; }',
        '.dugmeler { display: flex; gap: 8px; }',
        '.dugme { flex: 1; height: 44px; padding: 0 16px; border-radius: 9px; border: 1px solid #d0d5dd; background: #fff; color: #344054;',
        '  font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }',
        '.dugme:hover { background: #f9fafb; }',
        '.dugme.ana { flex: 1.4; border-color: #2563eb; background: #2563eb; color: #fff; }',
        '.dugme.ana:hover { background: #1d4ed8; }',
        '.dugme[disabled] { opacity: .6; cursor: progress; }',
        '.durum { margin: 0; min-height: 18px; font-size: 12px; color: #667085; }',
        '.durum.iyi { color: #067647; }',
        '.durum.kotu { color: #b42318; }'
    ].join('\n');

    var IKON_X = '<svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg>';

    function kacir(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    async function bulBekle(bul, sure) {
        var bitis = Date.now() + sure;
        while (Date.now() < bitis) {
            var x = bul();
            if (x) return x;
            await bekle(100);
        }
        return null;
    }

    function sade(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr'); }

    function kayitKimligi() {
        var m = YOL.exec(location.pathname);
        return m ? m[1] : null;
    }

    function durumYaz(metin, tur) {
        if (!kok) return;
        var d = kok.querySelector('.durum');
        d.textContent = metin || '';
        d.className = 'durum' + (tur ? ' ' + tur : '');
    }

    function kaldir() {
        if (kap) kap.remove();
        kap = null;
        kok = null;
    }

    function ciz() {
        kaldir();
        if (!etkin || !taslak || taslak.kayitId !== kayitKimligi()) return;
        kap = document.createElement('div');
        kap.id = 'jba-itiraz-taslak';
        kok = kap.attachShadow({ mode: 'closed' });
        document.documentElement.appendChild(kap);
        kok.innerHTML = '<style>' + STIL + '</style>' +
            '<div class="kart" role="dialog" aria-label="İtiraz taslağı">' +
                '<div class="ust">' +
                    '<span class="ikon"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg></span>' +
                    '<p class="baslik">İtiraz Taslağı<small>Jet Barkod · Kaydet\'e sen basarsın</small></p>' +
                    '<button type="button" class="kapat" data-is="kapat" aria-label="Taslağı kapat">' + IKON_X + '</button>' +
                '</div>' +
                (taslak.sebep ? '<span class="sebep">' + kacir(taslak.sebep) + '</span>' : '') +
                '<p class="metin">' + kacir(taslak.metin) + '</p>' +
                '<div class="dugmeler">' +
                    '<button type="button" class="dugme" data-is="kopyala">Kopyala</button>' +
                    '<button type="button" class="dugme ana" data-is="yerlestir">Forma Yerleştir</button>' +
                '</div>' +
                '<p class="durum" aria-live="polite"></p>' +
            '</div>';
        kok.querySelector('.kart').addEventListener('click', tiklama);
    }

    function tiklama(e) {
        var b = e.target.closest('[data-is]');
        if (!b) return;
        var is = b.getAttribute('data-is');
        if (is === 'kapat') {
            taslak = null;
            try { chrome.storage.local.remove(ANAHTAR); } catch (x) { /* yetim bağlam */ }
            kaldir();
        } else if (is === 'kopyala') {
            JBA.panoyaYaz(taslak.metin).then(function (ok) {
                durumYaz(ok ? 'Metin kopyalandı.' : 'Kopyalanamadı; metni seçip kopyala.', ok ? 'iyi' : 'kotu');
            });
        } else if (is === 'yerlestir') {
            yerlestir(b);
        }
    }

    /* Panelin kendi formu: İtiraz Et → sebep seçimi (Ant Design) → metin. */
    async function yerlestir(dugme) {
        if (mesgul || !taslak) return;
        mesgul = true;
        dugme.disabled = true;
        durumYaz('Form açılıyor…');
        try {
            var modal = document.querySelector('.ant-modal textarea') ? document.querySelector('.ant-modal') : null;
            if (!modal) {
                var ac = Array.prototype.find.call(document.querySelectorAll('button'), function (x) {
                    return sade(x.textContent) === 'itiraz et' && !x.disabled;
                });
                if (!ac) {
                    durumYaz('Bu kayıtta "İtiraz Et" düğmesi yok. Süre dolmuş ya da itiraz edilmiş olabilir.', 'kotu');
                    return;
                }
                ac.click();
                var ta0 = await bulBekle(function () { return document.querySelector('.ant-modal textarea'); }, 5000);
                if (!ta0) { durumYaz('Form açılmadı. "İtiraz Et"e basıp tekrar dene.', 'kotu'); return; }
                modal = ta0.closest('.ant-modal');
            }

            var sebepTamam = !taslak.sebep;
            if (taslak.sebep) {
                var secici = modal.querySelector('.ant-select-selector');
                if (secici) {
                    secici.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    var hedef = await bulBekle(function () {
                        var ops = document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
                        return Array.prototype.find.call(ops, function (o) {
                            return sade(o.getAttribute('title') || o.textContent) === sade(taslak.sebep);
                        }) || null;
                    }, 2500);
                    if (hedef) {
                        hedef.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        hedef.click();
                        await bekle(200);
                        var secili = modal.querySelector('.ant-select-selection-item');
                        sebepTamam = !!secili && sade(secili.textContent) === sade(taslak.sebep);
                    } else {
                        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    }
                }
            }

            var ta = modal.querySelector('textarea');
            var ayar = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            ayar.call(ta, taslak.metin);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            ta.focus();

            durumYaz(sebepTamam
                ? 'Yerleştirildi. Kontrol edip panelde Kaydet\'e bas.'
                : 'Metin yerleştirildi. Sebebi listeden sen seç, sonra Kaydet\'e bas.', sebepTamam ? 'iyi' : '');
        } catch (x) {
            durumYaz('Form doldurulamadı. Metni kopyalayıp yapıştırabilirsin.', 'kotu');
        } finally {
            mesgul = false;
            dugme.disabled = false;
        }
    }

    function taslakOku() {
        try {
            chrome.storage.local.get(ANAHTAR, function (r) {
                var t = r && r[ANAHTAR];
                taslak = t && t.kayitId && t.metin && Date.now() - (t.zaman || 0) < OMUR_MS ? t : null;
                ciz();
            });
        } catch (x) { /* yetim bağlam */ }
    }

    try {
        chrome.storage.onChanged.addListener(function (d, alan) {
            if (alan === 'local' && d[ANAHTAR] && etkin) taslakOku();
        });
    } catch (x) { /* yetim bağlam */ }

    JBA.kayit({
        kimlik: 'itiraz',
        ad: 'İtiraz Taslağı',
        ozet: 'Jet Barkod\'da hazırlanan itiraz metnini Depo Değerlendirme kaydının formuna yerleştirir; Kaydet\'e sen basarsın.',
        hostlar: ['franchise-v2.getir.com'],
        yol: function (yol) { return YOL.test(yol); },
        baslat: function () {
            etkin = true;
            taslakOku();
            // Detaydan detaya geçişte modül yeniden başlamıyor; kart doğru kayıtta mı
            var son = location.pathname;
            izci = setInterval(function () {
                if (location.pathname === son) return;
                son = location.pathname;
                ciz();
            }, 800);
        },
        durdur: function () { etkin = false; clearInterval(izci); kaldir(); }
    });
})(window);
