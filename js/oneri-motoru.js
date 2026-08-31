/**
 * "Şunu mu demek istediniz?" motoru.
 * ============================================================================
 *
 * Depoda çalışan biri telefonla, aceleyle, çoğu zaman tek elle yazıyor. Yazım
 * hatası kural değil, normal. "eti popkke", "eit popkek", "eti ppokek", hatta
 * "eti kekpop" hepsi aynı ürünü arıyor. Sonuç boş dönünce kullanıcının
 * kendi hatasını bulması bekleniyordu; artık doğru sorgu öneriliyor.
 *
 * NASIL ÇALIŞIYOR
 * Katalogdaki bütün ürün adlarından, markalardan ve kategorilerden bir kelime
 * dağarcığı çıkarılıyor (yaklaşık on beş bin kelime, hangisinin kaç kez geçtiği
 * de tutuluyor). Yazılan her kelime için dağarcıktan aday toplanıyor ve en
 * yakını seçiliyor.
 *
 * ADAY TOPLAMA
 * On beş bin kelimeyi tek tek karşılaştırmak pahalı. Üç harfli parçalar
 * (trigram) üzerinden ters indeks kuruluyor: "popkek" -> pop, opk, pkk, kek.
 * Yalnızca bu parçaları paylaşan kelimeler aday oluyor, genelde birkaç yüz
 * tane. Ayrıca harfleri sıralanmış bir anahtar tutuluyor; "kekpop" ile
 * "popkek" farklı trigramlara sahip ama sıralanmış harfleri aynı, o yüzden
 * karışık yazılmış kelimeler de yakalanıyor.
 *
 * PUANLAMA
 * Damerau-Levenshtein (bitişik harf yer değiştirmesini de sayan sürüm) temel
 * alınıyor. Üstüne üç ayar:
 *   - Baştaki harfler tutuyorsa ödül. İnsan kelimenin başını genelde doğru
 *     yazar, sonunu karıştırır.
 *   - Katalogda çok geçen kelime tercih edilir. "sut" ile "sud" arasında
 *     kalındığında binlerce üründe geçen kazanır.
 *   - Uzunluk farkı büyükse aday elenir; "eti" ile "etiket" karıştırılmaz.
 *
 * SON KONTROL
 * Öneri, kullanıcıya gösterilmeden önce gerçekten aranıyor. Sonuç getirmeyen
 * bir öneri gösterilmiyor. Yanlış öneri, öneri yokluğundan daha kötüdür.
 *
 * MALİYET
 * İndeks bir kez kuruluyor ve parça parça, boşta zamanda. Öneri üretimi
 * kelime başına birkaç milisaniye. Yazarken çalışmıyor; yalnızca sonuç sıfır
 * dönünce çağrılıyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };

    function sadelestir(metin) {
        if (!metin) return '';
        return String(metin).toLocaleLowerCase('tr')
            .replace(/[ığüşöçâîû]/g, function (h) { return HARF[h] || h; })
            .replace(/[^a-z0-9 ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Harfleri sıralı anahtar: karışık yazılmış kelimeleri eşlemek için. */
    function karisikAnahtar(kelime) {
        return kelime.split('').sort().join('');
    }

    /*
     * Ses anahtarı. Türkçe yazan biri markayı kulağıyla yazıyor:
     * "Coca Cola" -> "koka kola", "Nescafe" -> "neskafe". Harf harf
     * bakıldığında bunlar uzak; kulakla bakıldığında aynı.
     *
     * k ve q, c'ye indiriliyor; w, v'ye; x, ks'ye. Arka arkaya gelen aynı
     * harf tekleniyor ("sütass" -> "sutas"). Sesli harflere dokunulmuyor,
     * çünkü Türkçede sesli harf değişimi anlamı da değiştiriyor.
     */
    function sesAnahtar(kelime) {
        return kelime
            .replace(/[kq]/g, 'c')
            .replace(/w/g, 'v')
            .replace(/x/g, 'ks')
            .replace(/(.)\1+/g, '$1');
    }

    function trigramlar(kelime) {
        var k = '  ' + kelime + ' ';
        var liste = [];
        for (var i = 0; i < k.length - 2; i++) liste.push(k.slice(i, i + 3));
        return liste;
    }

    /**
     * Damerau-Levenshtein (OSA). `sinir` aşılınca erken çıkıyor; uzak
     * adaylar için tam matris hesaplanmıyor.
     */
    function uzaklik(a, b, sinir) {
        var m = a.length, n = b.length;
        if (Math.abs(m - n) > sinir) return sinir + 1;
        if (m === 0) return n;
        if (n === 0) return m;

        var onceki = new Array(n + 1);
        var simdi = new Array(n + 1);
        var oncekiOnceki = new Array(n + 1);
        for (var j = 0; j <= n; j++) onceki[j] = j;

        for (var i = 1; i <= m; i++) {
            simdi[0] = i;
            var satirEnAz = simdi[0];
            for (var k = 1; k <= n; k++) {
                var bedel = a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1;
                var d = Math.min(simdi[k - 1] + 1, onceki[k] + 1, onceki[k - 1] + bedel);
                if (i > 1 && k > 1 &&
                    a.charCodeAt(i - 1) === b.charCodeAt(k - 2) &&
                    a.charCodeAt(i - 2) === b.charCodeAt(k - 1)) {
                    d = Math.min(d, oncekiOnceki[k - 2] + 1);   // bitişik yer değiştirme
                }
                simdi[k] = d;
                if (d < satirEnAz) satirEnAz = d;
            }
            if (satirEnAz > sinir) return sinir + 1;
            var gecici = oncekiOnceki; oncekiOnceki = onceki; onceki = simdi; simdi = gecici;
        }
        return onceki[n];
    }

    // ==================================================================
    // İndeks
    // ==================================================================

    var dagarcik = null;        // kelime -> kaç üründe geçtiği
    var kelimeler = null;       // dizi
    var trigramIndeks = null;   // trigram -> kelime indeksleri
    var karisikIndeks = null;   // sıralı harf anahtarı -> kelime indeksleri
    var sesIndeks = null;       // ses anahtarı -> kelime indeksleri
    var hazirMi = false;
    var kuruluyor = false;

    function bosta(fn) {
        if (global.requestIdleCallback) global.requestIdleCallback(fn, { timeout: 500 });
        else setTimeout(fn, 16);
    }

    /**
     * Katalogdan kelime dağarcığını çıkarır. Parça parça: tek karede
     * dokuz bin ürün gezmek düşük güçlü makinede sayfayı dondurur.
     */
    /**
     * @param urunler  Katalog.
     * @param bitince  İndeks hazır olunca çağrılır.
     * @param hemen    true ise parçalamadan, tek seferde kurar. Öneri
     *                 ısınma bitmeden gerekirse kullanılıyor; ~200 ms
     *                 sürüyor ve o an zaten kullanıcı beklemede.
     */
    function hazirla(urunler, bitince, hemen) {
        if (hazirMi || kuruluyor) { if (bitince) bitince(); return; }
        if (!urunler || !urunler.length) { if (bitince) bitince(); return; }
        kuruluyor = true;

        dagarcik = new Map();
        var i = 0;
        var DILIM = hemen ? urunler.length : 700;

        function dilim() {
            var son = Math.min(i + DILIM, urunler.length);
            for (; i < son; i++) {
                var u = urunler[i];
                if (!u) continue;
                var metin = sadelestir(
                    (u.name || '') + ' ' + (u.brand || '') + ' ' + (u.category || '')
                );
                if (!metin) continue;
                var parcalar = metin.split(' ');
                for (var j = 0; j < parcalar.length; j++) {
                    var p = parcalar[j];
                    // Tek harfler ve saf sayılar dağarcığa girmiyor
                    if (p.length < 3 || /^\d+$/.test(p)) continue;
                    dagarcik.set(p, (dagarcik.get(p) || 0) + 1);
                }
            }
            if (i < urunler.length) {
                if (hemen) { dilim(); return; }
                bosta(dilim);
                return;
            }
            indeksKur();
            kuruluyor = false;
            hazirMi = true;
            if (bitince) bitince();
        }

        if (hemen) dilim(); else bosta(dilim);
    }

    function indeksKur() {
        kelimeler = Array.from(dagarcik.keys());
        trigramIndeks = new Map();
        karisikIndeks = new Map();
        sesIndeks = new Map();

        for (var i = 0; i < kelimeler.length; i++) {
            var k = kelimeler[i];
            var tg = trigramlar(k);
            for (var j = 0; j < tg.length; j++) {
                var kova = trigramIndeks.get(tg[j]);
                if (!kova) { kova = []; trigramIndeks.set(tg[j], kova); }
                kova.push(i);
            }
            var ka = karisikAnahtar(k);
            var kk = karisikIndeks.get(ka);
            if (!kk) { kk = []; karisikIndeks.set(ka, kk); }
            kk.push(i);

            var sa = sesAnahtar(k);
            var sk = sesIndeks.get(sa);
            if (!sk) { sk = []; sesIndeks.set(sa, sk); }
            sk.push(i);
        }
    }

    // ==================================================================
    // Kelime düzeltme
    // ==================================================================

    function ortakOnEk(a, b) {
        var n = Math.min(a.length, b.length), i = 0;
        while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
        return i;
    }

    /** Tek bir kelime için en iyi adayı döndürür, yoksa null. */
    function kelimeDuzelt(kelime) {
        if (!hazirMi || !kelime || kelime.length < 3) return null;
        if (dagarcik.has(kelime)) return null;          // Zaten doğru

        /* Sınır kelime boyuna göre. Sekiz harften uzun kelimelerde de iki
           ile yetiniliyor; üçe çıkarıldığında alakasız kelimeler öneri
           olarak dönmeye başlıyor. */
        var sinir = kelime.length <= 4 ? 1 : 2;

        // Adaylar: aynı trigramı paylaşanlar + harfleri aynı olanlar
        var sayac = new Map();
        var tg = trigramlar(kelime);
        for (var t = 0; t < tg.length; t++) {
            var kova = trigramIndeks.get(tg[t]);
            if (!kova) continue;
            for (var c = 0; c < kova.length; c++) {
                sayac.set(kova[c], (sayac.get(kova[c]) || 0) + 1);
            }
        }

        /* Kısa kelimelerin zaten az parçası var. "syt" ile "sut" tek parça
           paylaşıyor; iki şartı korunsaydı hiç aday bulunamazdı. */
        var enAzOrtak = kelime.length <= 4 ? 1 : 2;

        var adaylar = [];
        sayac.forEach(function (ortak, idx) {
            if (ortak >= enAzOrtak) adaylar.push(idx);
        });

        var karisikAdaylar = karisikIndeks.get(karisikAnahtar(kelime));
        if (karisikAdaylar) {
            for (var m = 0; m < karisikAdaylar.length; m++) adaylar.push(karisikAdaylar[m]);
        }

        var kelimeSes = sesAnahtar(kelime);
        var sesAdaylar = sesIndeks.get(kelimeSes);
        if (sesAdaylar) {
            for (var v = 0; v < sesAdaylar.length; v++) adaylar.push(sesAdaylar[v]);
        }

        if (!adaylar.length) return null;

        var enIyi = null, enIyiPuan = Infinity;
        var gorulen = new Set();

        for (var a = 0; a < adaylar.length; a++) {
            var idx = adaylar[a];
            if (gorulen.has(idx)) continue;
            gorulen.add(idx);

            var aday = kelimeler[idx];
            if (Math.abs(aday.length - kelime.length) > sinir &&
                sesAnahtar(aday) !== kelimeSes) continue;

            var karisik = karisikAnahtar(aday) === karisikAnahtar(kelime) ||
                          sesAnahtar(aday) === kelimeSes;
            var d;
            if (karisik) {
                // Aynı harfler, farklı sıra: yazım değil karıştırma hatası
                d = 1;
            } else {
                d = uzaklik(kelime, aday, sinir);
                if (d > sinir) continue;
            }

            var onEk = ortakOnEk(kelime, aday);

            /*
             * İKİ HARF BOZUKSA BAŞ TARAFI TUTMALI
             * "furkan" ile "fersan" arasındaki uzaklık iki; sınırın içinde.
             * Ama biri isim, diğeri marka. İnsan kelimenin başını genellikle
             * doğru yazar, sonunu karıştırır. İki harf birden bozuksa ve baş
             * taraf da tutmuyorsa bu bir yazım hatası değil, başka bir
             * kelimedir. Bu kural olmadan panoda duran "Furkan" için
             * "Fersan" öneriliyordu.
             */
            if (!karisik && d >= 2 && onEk < 2) continue;

            var siklik = dagarcik.get(aday) || 1;
            var boyFarki = Math.abs(aday.length - kelime.length);
            var puan = d
                     - Math.min(onEk, 3) * 0.12
                     - Math.min(Math.log10(siklik), 3) * 0.08
                     + boyFarki * 0.15;   // Aynı boydaki aday tercih edilir

            if (puan < enIyiPuan) { enIyiPuan = puan; enIyi = aday; }
        }

        return enIyi;
    }

    // ==================================================================
    // Sorgu önerisi
    // ==================================================================

    /** Bir kelime için sıralı seçenek listesi: en olası önce. */
    function kelimeSecenekleri(kelime) {
        var secenekler = [];
        var varMi = dagarcik.has(kelime);
        if (varMi) secenekler.push(kelime);

        var duzeltme = kelimeDuzelt(kelime);
        if (duzeltme && secenekler.indexOf(duzeltme) === -1) secenekler.push(duzeltme);

        /*
         * Kelime katalogda GEÇSE BİLE ses karşılığı aranıyor. "kola" gerçek
         * bir kelime, katalogda var; ama "coka kola" yazan kişi Coca-Cola
         * arıyor ve doğru karşılık "cola". Yalnızca hatalı kelimeler
         * düzeltilseydi bu sorgu çözülemezdi.
         */
        var ses = sesAnahtar(kelime);
        var sesKova = sesIndeks.get(ses);
        if (sesKova) {
            var enIyiSes = null, enIyiSiklik = -1;
            for (var i = 0; i < sesKova.length; i++) {
                var aday = kelimeler[sesKova[i]];
                if (aday === kelime) continue;
                var f = dagarcik.get(aday) || 0;
                if (f > enIyiSiklik) { enIyiSiklik = f; enIyiSes = aday; }
            }
            if (enIyiSes && secenekler.indexOf(enIyiSes) === -1) secenekler.push(enIyiSes);
        }

        if (!secenekler.length) secenekler.push(kelime);
        return secenekler.slice(0, 3);
    }

    /**
     * @param sorgu    Kullanıcının yazdığı metin.
     * @param dogrula  (metin) => boolean. Önerinin gerçekten sonuç getirip
     *                 getirmediğini söyler. Verilmezse doğrulama yapılmaz.
     * @returns {{metin:string, degisen:Array}} ya da null
     *
     * Her kelime için birkaç seçenek üretiliyor ve bileşimler en olasıdan
     * başlayarak deneniyor. İlk sonuç getiren bileşim öneri oluyor. Deneme
     * sayısı sınırlı; tek bir sorgu için katalog defalarca taranmıyor.
     */
    function oner(sorgu, dogrula) {
        if (!hazirMi || !sorgu) return null;

        var sade = sadelestir(sorgu);
        if (!sade) return null;

        var parcalar = sade.split(' ').filter(function (p) { return p.length > 0; });
        if (!parcalar.length || parcalar.length > 6) return null;

        var secenekListesi = [];
        for (var i = 0; i < parcalar.length; i++) {
            secenekListesi.push(kelimeSecenekleri(parcalar[i]));
        }

        // Bileşimleri maliyete göre sırala: 0 = ilk seçenek, büyüdükçe uzaklaşır
        var bilesimler = [];
        function uret(sira, secim, maliyet) {
            if (bilesimler.length > 24) return;
            if (sira === secenekListesi.length) {
                bilesimler.push({ secim: secim.slice(), maliyet: maliyet });
                return;
            }
            var sec = secenekListesi[sira];
            for (var j = 0; j < sec.length; j++) {
                secim.push(sec[j]);
                uret(sira + 1, secim, maliyet + j);
                secim.pop();
            }
        }
        uret(0, [], 0);
        bilesimler.sort(function (a, b) { return a.maliyet - b.maliyet; });

        var DENEME_SINIRI = 10;
        var denenen = 0;

        for (var b = 0; b < bilesimler.length && denenen < DENEME_SINIRI; b++) {
            var metin = bilesimler[b].secim.join(' ');
            if (metin === sade) continue;              // Kullanıcının yazdığının aynısı
            denenen++;
            if (typeof dogrula === 'function' && !dogrula(metin)) continue;

            var degisen = [];
            for (var k = 0; k < parcalar.length; k++) {
                if (parcalar[k] !== bilesimler[b].secim[k]) {
                    degisen.push([parcalar[k], bilesimler[b].secim[k]]);
                }
            }
            if (!degisen.length) continue;
            return { metin: metin, degisen: degisen };
        }

        return null;
    }

    global.JBOneri = {
        hazirla: hazirla,
        oner: oner,
        kelimeDuzelt: kelimeDuzelt,
        sadelestir: sadelestir,
        hazirMi: function () { return hazirMi; },
        dagarcikBoyu: function () { return dagarcik ? dagarcik.size : 0; }
    };
})(window);
