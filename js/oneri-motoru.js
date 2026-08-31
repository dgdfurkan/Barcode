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

    /*
     * İki kelimenin harf KÜMESİ ne kadar farklı? Sıra hiç bakılmıyor.
     *
     * "sütşia" ile "sütaş" arasında sıradan yazım uzaklığı üç: iki harf
     * yer değiştirmiş, bir de fazladan harf var. Sınırın dışında kalıyor
     * ve öneri üretilemiyordu. Oysa harflere bakınca fark tek bir "i".
     * Bu ölçü, karışık yazılmış kelimeyi yakalamak için.
     */
    function harfFarki(a, b) {
        var sa = a.split('').sort();
        var sb = b.split('').sort();
        var i = 0, j = 0, fark = 0;
        while (i < sa.length && j < sb.length) {
            if (sa[i] === sb[j]) { i++; j++; }
            else if (sa[i] < sb[j]) { fark++; i++; }
            else { fark++; j++; }
        }
        return fark + (sa.length - i) + (sb.length - j);
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

    var dagarcik = null;        // sade kelime -> kaç üründe geçtiği
    var orijinal = null;        // sade kelime -> katalogdaki Türkçe yazımı
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
        orijinal = new Map();
        var i = 0;
        var DILIM = hemen ? urunler.length : 700;

        function dilim() {
            var son = Math.min(i + DILIM, urunler.length);
            for (; i < son; i++) {
                var u = urunler[i];
                if (!u) continue;
                var ham = (u.name || '') + ' ' + (u.brand || '') + ' ' + (u.category || '');
                /*
                 * Öneri kullanıcıya KATALOGDAKİ yazımıyla gösteriliyor.
                 * Eşleştirme sadeleştirilmiş metin üzerinden yapılıyor
                 * ("sütaş" -> "sutas") ama ekranda "Sütaş" yazmalı. Önceden
                 * sadeleştirilmiş hâli gösteriliyordu; kullanıcı "sutas
                 * yarim yagli" görüyor ve haklı olarak yadırgıyordu.
                 */
                var hamParcalar = ham.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/);
                for (var j = 0; j < hamParcalar.length; j++) {
                    var hamKelime = hamParcalar[j];
                    if (!hamKelime) continue;
                    var p = sadelestir(hamKelime);
                    // Tek harfler ve saf sayılar dağarcığa girmiyor
                    if (!p || p.length < 3 || /^\d+$/.test(p)) continue;
                    dagarcik.set(p, (dagarcik.get(p) || 0) + 1);
                    /* Aynı kelimenin katalogda birden çok yazımı olabiliyor
                       ("Su", "su", "SU"). En sık geçeni gösteriliyor. */
                    var sayimlar = orijinal.get(p);
                    if (!sayimlar) { sayimlar = new Map(); orijinal.set(p, sayimlar); }
                    sayimlar.set(hamKelime, (sayimlar.get(hamKelime) || 0) + 1);
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

    /**
     * Tek bir kelime için sıralı aday listesi döndürür.
     *
     * NEDEN TEK ADAY YETMİYOR
     * "sütşia" için harflere bakıldığında iki aday var: "ustası" (harfleri
     * birebir aynı) ve "sütaş" (bir harf fazla). Tek aday döndürülünce
     * "ustası" seçiliyor, "sütşia yarım yağlı" sorgusu çözülemiyordu.
     * Birden fazla aday dönünce üst kat bileşimleri deneyip gerçekten sonuç
     * getireni seçiyor: "sütaş yarım yağlı".
     */
    function kelimeAdaylari(kelime, kacTane) {
        if (!hazirMi || !kelime || kelime.length < 3) return [];
        if (dagarcik.has(kelime)) return [];            // Zaten doğru

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

        if (!adaylar.length) return [];

        var siralama = [];
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
                if (d > sinir) {
                    /* Sıradan uzaklık tutmadı. Harfler neredeyse aynı mı?
                       "sütşia" -> "sütaş" burada yakalanıyor. Boy farkı bir
                       harfi geçmemeli, yoksa alakasız kelimeler girer. */
                    if (kelime.length >= 4 &&
                        Math.abs(aday.length - kelime.length) <= 1 &&
                        harfFarki(kelime, aday) <= 1) {
                        d = 2;
                        karisik = true;
                    } else {
                        continue;
                    }
                }
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
            if (d >= 2 && onEk < 2) continue;

            var siklik = dagarcik.get(aday) || 1;
            var boyFarki = Math.abs(aday.length - kelime.length);
            var puan = d
                     - Math.min(onEk, 3) * 0.12
                     - Math.min(Math.log10(siklik), 3) * 0.08
                     + boyFarki * 0.15;   // Aynı boydaki aday tercih edilir

            siralama.push({ kelime: aday, puan: puan });
        }

        siralama.sort(function (x, y) { return x.puan - y.puan; });
        var cikti = [];
        for (var z = 0; z < siralama.length && cikti.length < (kacTane || 1); z++) {
            cikti.push(siralama[z].kelime);
        }
        return cikti;
    }

    /** Geriye dönük uyum: tek aday isteyenler için. */
    function kelimeDuzelt(kelime) {
        var liste = kelimeAdaylari(kelime, 1);
        return liste.length ? liste[0] : null;
    }

    // ==================================================================
    // Sorgu önerisi
    // ==================================================================

    /**
     * Sade kelimeleri katalogdaki Türkçe yazımına çevirir.
     * "sutas yarim yagli" -> "Sütaş Yarım Yağlı"
     */
    function turkceYaz(sadeKelimeler) {
        var cikti = [];
        for (var i = 0; i < sadeKelimeler.length; i++) {
            var k = sadeKelimeler[i];
            var sayimlar = orijinal && orijinal.get(k);
            if (!sayimlar) { cikti.push(k); continue; }
            var enIyi = k, enCok = -1;
            sayimlar.forEach(function (adet, yazim) {
                /* Eşitlikte baş harfi büyük olan kazanıyor: "Su", "su"
                   arasında kalındığında ürün adı gibi duran seçiliyor. */
                var buyukBasli = yazim[0] !== yazim[0].toLocaleLowerCase('tr');
                var puan = adet * 2 + (buyukBasli ? 1 : 0);
                if (puan > enCok) { enCok = puan; enIyi = yazim; }
            });
            cikti.push(enIyi);
        }
        return cikti.join(' ');
    }

    /** Bir kelime için sıralı seçenek listesi: en olası önce. */
    function kelimeSecenekleri(kelime) {
        var secenekler = [];
        var varMi = dagarcik.has(kelime);
        if (varMi) secenekler.push(kelime);

        /*
         * Kelime katalogda GEÇSE BİLE ses karşılığı aranıyor. "kola" gerçek
         * bir kelime, katalogda var; ama "koka kola" yazan kişi Coca-Cola
         * arıyor ve doğru karşılık "cola".
         *
         * Ses karşılığı listenin BAŞINA konuyor. Türkçe yazan biri markayı
         * kulağıyla yazıyor; harf harf yakın bir kelimeden ("koka" -> "kola")
         * daha güçlü bir işaret bu. Sona konduğunda "koka kola" için
         * "kola cola" gibi saçma bir öneri çıkıyordu.
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

        var duzeltmeler = kelimeAdaylari(kelime, 3);
        for (var d = 0; d < duzeltmeler.length; d++) {
            if (secenekler.indexOf(duzeltmeler[d]) === -1) secenekler.push(duzeltmeler[d]);
        }

        if (!secenekler.length) secenekler.push(kelime);
        return secenekler.slice(0, 4);
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
            if (bilesimler.length > 48) return;
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

        var DENEME_SINIRI = 14;
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

            /* "koka kola" için "kola kola" öneriliyordu: aynı kelime iki
               kez. Kullanıcı iki farklı kelime yazdıysa öneri de iki farklı
               kelime olmalı. Bu eleme sayesinde döngü devam ediyor ve
               "coca cola" bulunuyor. */
            var tekrarVar = false;
            for (var t2 = 1; t2 < bilesimler[b].secim.length; t2++) {
                if (bilesimler[b].secim[t2] === bilesimler[b].secim[t2 - 1] &&
                    parcalar[t2] !== parcalar[t2 - 1]) { tekrarVar = true; break; }
            }
            if (tekrarVar) continue;

            /*
             * Üç harflik bir kelime düzeltiliyorsa karşılığın katalogda
             * gerçekten yaygın olması şart. "mehmet ali" için "Mehmet Âlâ"
             * öneriliyordu: "âlâ" katalogda birkaç kez geçen tuhaf bir
             * kelime. "pinar syt" -> "Pınar Süt" ise geçerli, çünkü "süt"
             * yüzlerce üründe var. Uzunluk değil yaygınlık ölçüt.
             */
            var kisaTahmin = false;
            for (var t3 = 0; t3 < degisen.length; t3++) {
                if (degisen[t3][0].length <= 3 && (dagarcik.get(degisen[t3][1]) || 0) < 5) {
                    kisaTahmin = true; break;
                }
            }
            if (kisaTahmin) continue;

            return {
                metin: metin,                       // aramaya gidecek sade hâli
                gosterim: turkceYaz(bilesimler[b].secim),  // ekranda görünecek hâli
                degisen: degisen
            };
        }

        return null;
    }

    global.JBOneri = {
        hazirla: hazirla,
        oner: oner,
        kelimeDuzelt: kelimeDuzelt,
        kelimeAdaylari: kelimeAdaylari,
        sadelestir: sadelestir,
        turkceYaz: turkceYaz,
        hazirMi: function () { return hazirMi; },
        dagarcikBoyu: function () { return dagarcik ? dagarcik.size : 0; }
    };
})(window);
