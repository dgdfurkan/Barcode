/**
 * Jet Barkod. Simülasyon sayfası: kaydırma sürücüsü.
 * ============================================================================
 *
 * TEK İŞİ VAR
 * Görünür her perdeye `--p` yazar: 0 perdenin başı, 1 sonu. Başka hiçbir
 * stil hesaplamaz. Neyin nasıl hareket edeceğine `css/simulasyon.css`
 * karar verir. Bu ayrım bilinçli: hareketi JS'e yazarsan her yeni sahne
 * için JS'e dokunmak gerekir, CSS'te durursa sahne eklemek stil yazmak
 * kadar kalır.
 *
 * NEDEN `scroll` DİNLEYİCİSİ VAR AMA KAYDIRMA ÇALINMIYOR
 * Kaydırmayı ele alıp sayfayı kendi hesabına süren sayfalar telefonda
 * kırılıyor: atalet bozuluyor, geri jesti takılıyor. Burada tarayıcının
 * kendi kaydırması olduğu gibi duruyor; yapıştırmayı `position: sticky`
 * yapıyor, biz yalnız nerede olduğumuzu ölçüyoruz.
 *
 * NEDEN GÖZLEMCİ + rAF
 * Her `scroll` olayında bütün perdeleri ölçmek sayfayı yorar. Hangi
 * perdenin ekranda olduğuna `IntersectionObserver` karar veriyor; ölçüm
 * yalnız o perdelere ve çizim karesi başına bir kez yapılıyor. Ekran
 * dışındaki perde hiç hesaplanmıyor.
 *
 * ÖLÇÜM SIRASI
 * Bir turda önce BÜTÜN okumalar (`getBoundingClientRect`), sonra bütün
 * yazmalar yapılıyor. Araya yazma girerse tarayıcı her okumada yerleşimi
 * yeniden hesaplar ve tur pahalıya patlar.
 *
 * JS YOKSA YA DA ÇÖKERSE
 * `sim-hazir` sınıfı eklenmezse CSS yapıştırmayı hiç açmıyor; perdeler
 * normal bölümler olarak, sahneler hareketsiz ama eksiksiz görünüyor.
 * Sayfa hiçbir koşulda boş kalmıyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var belge = global.document;

    var azHareket = global.matchMedia &&
                    global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==================================================================
    // Perde ilerlemesi
    // ==================================================================

    function Surucu(perdeler) {
        this.perdeler = perdeler;
        this.etkin = [];
        this.bekleyen = 0;
        this.olc = this.olc.bind(this);
        this.kaydir = this.kaydir.bind(this);
    }

    Surucu.prototype.ekle = function (perde) {
        if (this.etkin.indexOf(perde) === -1) this.etkin.push(perde);
    };

    Surucu.prototype.cikar = function (perde) {
        var i = this.etkin.indexOf(perde);
        if (i !== -1) this.etkin.splice(i, 1);
    };

    Surucu.prototype.olc = function () {
        this.bekleyen = 0;
        var gorunen = global.innerHeight || belge.documentElement.clientHeight;
        var i;

        /* Önce oku. */
        var okunan = [];
        for (i = 0; i < this.etkin.length; i++) {
            var kutu = this.etkin[i].getBoundingClientRect();
            /* Yol: perdenin yapışan sahnesi baştan sona kayana kadar geçen
               mesafe. Perde ekrandan kısaysa (azaltılmış hareket, ya da
               kısa perde) sıfıra bölme olmasın diye tabana çekiliyor. */
            var yol = kutu.height - gorunen;
            if (yol < 1) yol = 1;
            var p = -kutu.top / yol;
            if (p < 0) p = 0;
            else if (p > 1) p = 1;
            okunan.push(p);
        }

        /* Sonra yaz. */
        for (i = 0; i < this.etkin.length; i++) {
            /* Dört basamak yeter: daha fazlası aynı pikseli üretiyor ama
               her karede daha uzun bir dize kuruyor. */
            this.etkin[i].style.setProperty('--p', okunan[i].toFixed(4));
        }
    };

    Surucu.prototype.kaydir = function () {
        if (this.bekleyen || !this.etkin.length) return;
        this.bekleyen = global.requestAnimationFrame(this.olc);
    };

    Surucu.prototype.baslat = function () {
        var self = this;

        var gozlemci = new global.IntersectionObserver(function (kayitlar) {
            for (var i = 0; i < kayitlar.length; i++) {
                var perde = kayitlar[i].target;
                var icerde = kayitlar[i].isIntersecting;
                /* Sınıf hem `will-change` anahtarı hem de sahne içi
                   animasyonların tetikleyicisi. */
                perde.classList.toggle('gorunur', icerde);
                if (icerde) self.ekle(perde);
                else self.cikar(perde);
            }
            self.kaydir();
        }, { rootMargin: '10% 0px 10% 0px' });

        for (var i = 0; i < this.perdeler.length; i++) {
            gozlemci.observe(this.perdeler[i]);
        }

        /* İKİ AYRI HEDEFTE DİNLENİYOR, İKİSİ DE GEREKLİ.
           `css/hakkimizda.css` gövdeye `overflow-x: hidden` veriyor. Bu
           değer görünüm alanına taşınıyor ve tarayıcıya göre kaydırma
           kutusu `html` ya da `body` olabiliyor. Hangisi olduğuna bağlı
           olarak `scroll` olayı `window`'a ulaşmayabiliyor; kaydırma olayı
           da kabarmıyor. Yakalama fazındaki `document` dinleyicisi hangi
           öğe kayarsa kaysın olayı görüyor, `window` dinleyicisi de
           olağan durumu karşılıyor. İkisi aynı kareyi paylaşıyor:
           `kaydir` zaten bekleyen bir çizim karesi varsa yenisini
           açmıyor, yani çift dinleyici çift iş demek değil. */
        belge.addEventListener('scroll', this.kaydir, { passive: true, capture: true });
        global.addEventListener('scroll', this.kaydir, { passive: true });
        global.addEventListener('resize', this.kaydir, { passive: true });
        global.addEventListener('orientationchange', this.kaydir, { passive: true });
        this.olc();
    };

    // ==================================================================
    // Karşılaştırma sahneleri
    // ==================================================================

    /**
     * Sahne kaplarını motora bağlar.
     *
     * Senaryo dosyası yüklenmemişse kap boş kalmıyor: ne olduğunu söyleyen
     * bir satır yazılıyor. Sessizce boş bir kutu bırakmak, sayfayı gören
     * kişiye "burada bir şey olacaktı" bile dedirtmiyor.
     */
    function sahneleriKur() {
        if (!global.JBKarsilastirma) return;

        var kaplar = belge.querySelectorAll('[data-senaryo]');
        for (var i = 0; i < kaplar.length; i++) {
            var kap = kaplar[i];
            var tanim = global[kap.dataset.senaryo];
            if (tanim) {
                global.JBKarsilastirma.kur(kap, tanim);
            } else {
                kap.className = 'sim-eksik';
                kap.textContent = 'Bu sahne yüklenemedi. Sayfayı yenilemeyi deneyin.';
            }
        }
    }

    // ==================================================================
    // Başlat
    // ==================================================================

    function baslat() {
        sahneleriKur();

        /* Azaltılmış hareket açıksa yapışma da ilerleme de gereksiz:
           CSS zaten perdeleri düz bölüme çeviriyor. */
        if (azHareket || !('IntersectionObserver' in global)) return;

        var perdeler = belge.querySelectorAll('.sim-perde');
        if (!perdeler.length) return;

        belge.documentElement.classList.add('sim-hazir');
        new Surucu(perdeler).baslat();
    }

    if (belge.readyState === 'loading') {
        belge.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
