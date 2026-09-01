/**
 * Destek sohbeti: karşılama ve hazır sorular.
 * ============================================================================
 *
 * AMAÇ
 * Giriş sayfasına gelen kişinin hesabı yoksa gideceği tek yer bu panel. Boş
 * bir kutu ve yanıp sönen imleç, yazacak şeyi olmayan insanı geri çeviriyor.
 * Panel açılınca kısa bir karşılama ve dokunulacak birkaç soru çıkıyor.
 *
 * ADINA MESAJ GÖNDERİLMİYOR
 * Karşılama yalnızca ekranda duruyor; sunucuya gitmiyor, yöneticiye
 * bildirim düşmüyor. Hazır sorulara dokunmak da göndermiyor, metni kutuya
 * yazıyor. Gönderme kararı her zaman kullanıcıda kalıyor. Aksi hâlde her
 * ziyaretçi için yöneticiye sahte bir konuşma düşerdi.
 *
 * BİR KEZ
 * Karşılama sohbette hiç mesaj yokken çıkıyor. Konuşma başladıysa
 * gösterilmiyor; kullanıcı geri döndüğünde kendi geçmişini görüyor.
 *
 * SAAT
 * Selam saate göre değişiyor. Küçük bir ayrıntı ama kutunun otomatik değil
 * biri tarafından yazılmış gibi durmasını sağlıyor.
 * ============================================================================
 */
(function () {
    'use strict';

    var panel = document.getElementById('chatInterface');
    var alan = document.getElementById('chatMessages');
    var giris = document.getElementById('messageInput');
    if (!panel || !alan || !giris) return;

    var HAZIR = [
        'Deponuz için fiyat nedir?',
        'Deneme süresi var mı?',
        'Kurulum ne kadar sürüyor?',
        'Canlı demo görebilir miyim?'
    ];

    function selam() {
        var s = new Date().getHours();
        if (s < 6) return 'İyi geceler';
        if (s < 12) return 'Günaydın';
        if (s < 18) return 'İyi günler';
        return 'İyi akşamlar';
    }

    /** Sohbette gerçek bir mesaj var mı? */
    function konusmaVarMi() {
        // Tarih başlığı ve bizim eklediklerimiz sayılmıyor
        var mesajlar = alan.querySelectorAll('[data-message-timestamp]');
        return mesajlar.length > 0;
    }

    function karsilamaVarMi() {
        return !!alan.querySelector('[data-jb-karsilama]');
    }

    function karsilamaEkle() {
        if (konusmaVarMi() || karsilamaVarMi()) return;

        var kutu = document.createElement('div');
        kutu.setAttribute('data-jb-karsilama', '1');
        kutu.innerHTML =
            '<div class="flex mb-3">' +
                '<div class="max-w-xs">' +
                    '<div class="bg-white text-slate-700 px-3 py-2 text-sm">' +
                        selam() + '. Jet Barkod ekibinden ' +
                        '<b>yazıyoruz</b>. Deponu ve sorunu yaz, aynı gün dönelim.' +
                    '</div>' +
                    '<div class="text-xs text-gray-500 mt-1">Jet Barkod</div>' +
                '</div>' +
            '</div>';
        alan.appendChild(kutu);
        alan.scrollTop = alan.scrollHeight;

        hazirSorulariEkle();
    }

    function hazirSorulariEkle() {
        if (document.querySelector('.sh-hazir')) return;

        var serit = document.createElement('div');
        serit.className = 'sh-hazir';
        var ic = '';
        for (var i = 0; i < HAZIR.length; i++) {
            ic += '<button type="button" class="sh-hazir__oge" style="--s:' + i + '">' +
                  HAZIR[i] + '</button>';
        }
        serit.innerHTML = ic;

        // Yazma alanının hemen üstüne
        var yazmaAlani = panel.lastElementChild;
        panel.insertBefore(serit, yazmaAlani);

        serit.addEventListener('click', function (e) {
            var d = e.target.closest('.sh-hazir__oge');
            if (!d) return;

            /*
             * Dokunulan soru DOĞRUDAN gönderiliyor.
             *
             * Önce yalnızca kutuya yazılıyordu; kullanıcı hazır soruya
             * dokunduktan sonra bir de gönder düğmesini bulmak zorunda
             * kalıyordu. Hazır sorunun bütün amacı bu iki adımı bire
             * indirmek.
             *
             * Sayfanın kendi gönderme yolu kullanılıyor: kutuya yazıp
             * gönder düğmesine basıyoruz. Böylece doğrulama, kayıt ve
             * senkron aynen çalışıyor, ayrı bir gönderme yolu açılmıyor.
             */
            giris.value = d.textContent;
            giris.dispatchEvent(new Event('input', { bubbles: true }));

            var gonder = document.getElementById('sendMessage');
            if (gonder) gonder.click();
            else giris.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));

            hazirlariKaldir();
        });
    }

    function hazirlariKaldir() {
        var s = document.querySelector('.sh-hazir');
        if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    /* Panel her açıldığında bakılıyor: sohbet boşsa karşılama, doluysa yok. */
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () {
            if (panel.classList.contains('hidden')) return;
            setTimeout(karsilamaEkle, 260);
        }).observe(panel, { attributes: true, attributeFilter: ['class'] });

        /* Gerçek mesaj geldiği anda karşılama ve hazır sorular çekiliyor:
           konuşma başladıktan sonra ekranda durmalarının anlamı yok. */
        new MutationObserver(function () {
            if (!konusmaVarMi()) return;
            var k = alan.querySelector('[data-jb-karsilama]');
            if (k && k.parentNode) k.parentNode.removeChild(k);
            hazirlariKaldir();
        }).observe(alan, { childList: true });
    }

    if (!panel.classList.contains('hidden')) setTimeout(karsilamaEkle, 300);
})();
