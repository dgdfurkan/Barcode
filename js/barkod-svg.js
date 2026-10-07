/**
 * Barkod çizimi (SVG)
 * ============================================================================
 *
 * Siparişler sayfasının barkod penceresi eskiden süs çizgiler gösteriyordu:
 * desen koddan türetiliyordu ama gerçek bir barkod değildi, okuyucu
 * okumuyordu. Bu modül gerçek, okutulabilir barkod çiziyor:
 *
 *   EAN-13  13 hane, geçerli kontrol hanesi
 *   UPC-A   12 hane, önüne 0 konup EAN-13 olarak
 *   EAN-8   8 hane, geçerli kontrol hanesi
 *   Code128 geri kalan her şey (B kümesi, ASCII 32-126)
 *
 * Dış kütüphane yok. Çıktı tek bir <svg> dizgesi.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    var G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
    var R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
    var ESLIK = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

    /* Code128 genişlik tablosu: her değer çubuk-boşluk-çubuk... genişlikleri.
       103-105 başlangıç (A/B/C), 106 bitiş. */
    var C128 = [
        '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
        '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
        '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
        '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
        '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
        '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
        '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
        '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
        '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
        '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
        '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
    ];

    function eanKontrolu(govde) {
        // govde: kontrol hanesi hariç haneler. Sağdan başlayarak 3,1,3,1...
        var t = 0;
        for (var i = 0; i < govde.length; i++) {
            var n = govde.charCodeAt(govde.length - 1 - i) - 48;
            t += (i % 2 === 0) ? n * 3 : n;
        }
        return (10 - (t % 10)) % 10;
    }

    function gecerliEan(kod) {
        if (!/^\d+$/.test(kod) || (kod.length !== 13 && kod.length !== 8)) return false;
        return eanKontrolu(kod.slice(0, -1)) === Number(kod.slice(-1));
    }

    function ean13Desen(kod) {
        var ilk = Number(kod[0]);
        var es = ESLIK[ilk];
        var d = '101';
        for (var i = 1; i <= 6; i++) d += (es[i - 1] === 'L' ? L : G)[Number(kod[i])];
        d += '01010';
        for (var j = 7; j <= 12; j++) d += R[Number(kod[j])];
        return d + '101';
    }

    function ean8Desen(kod) {
        var d = '101';
        for (var i = 0; i < 4; i++) d += L[Number(kod[i])];
        d += '01010';
        for (var j = 4; j < 8; j++) d += R[Number(kod[j])];
        return d + '101';
    }

    function code128Desen(metin) {
        var degerler = [104];
        for (var i = 0; i < metin.length; i++) {
            var c = metin.charCodeAt(i);
            if (c < 32 || c > 126) return null;
            degerler.push(c - 32);
        }
        var toplam = degerler[0];
        for (var k = 1; k < degerler.length; k++) toplam += degerler[k] * k;
        degerler.push(toplam % 103);
        degerler.push(106);
        var d = '';
        degerler.forEach(function (v) {
            var g = C128[v];
            for (var m = 0; m < g.length; m++) {
                var bit = m % 2 === 0 ? '1' : '0';
                for (var r = 0; r < Number(g[m]); r++) d += bit;
            }
        });
        return d;
    }

    /** Kod için desen ve tür. Çizilemiyorsa null. */
    function desen(kod) {
        var k = String(kod == null ? '' : kod).trim();
        if (!k) return null;
        if (/^\d{12}$/.test(k) && gecerliEan('0' + k)) return { tur: 'UPC-A', bitler: ean13Desen('0' + k), ean: '0' + k, metin: k };
        if (/^\d{13}$/.test(k) && gecerliEan(k)) return { tur: 'EAN-13', bitler: ean13Desen(k), ean: k, metin: k };
        if (/^\d{8}$/.test(k) && gecerliEan(k)) return { tur: 'EAN-8', bitler: ean8Desen(k), ean: k, metin: k };
        var c = code128Desen(k);
        return c ? { tur: 'Code 128', bitler: c, metin: k } : null;
    }

    function kacir(t) {
        return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    /* Kılavuz çubukları (başlangıç, orta, bitiş) gerçek etiketlerdeki gibi
       rakamların arasına uzanıyor. Modül aralıkları standarttan. */
    function kilavuzMu(tur, i) {
        if (tur === 'EAN-13' || tur === 'UPC-A') return i < 3 || (i >= 45 && i < 50) || i >= 92;
        if (tur === 'EAN-8') return i < 3 || (i >= 31 && i < 36) || i >= 64;
        return false;
    }

    /**
     * ÇİZİM NEDEN TAM PİKSEL
     * Eski sürüm barkodu kutuya esnetiyordu (preserveAspectRatio="none").
     * Bir modül 2,5 piksel gibi kesirli bir genişliğe düşünce ekran bazı
     * çubukları 2, bazılarını 3 piksel çiziyordu: oranlar bozuluyor, barkod
     * kırık görünüyor ve okuyucu okumuyordu. Artık her modül tam sayı
     * piksel (sığan en büyük değer) ve SVG kendi boyunda, esnetilmiyor.
     *
     * Çubuklarda çizgi (stroke) asla olmamalı. Siparişler sayfasının ikon
     * kuralı pencere içindeki her SVG'ye 1,8 piksel çizgi veriyordu; çubuklar
     * kalınlaşıp aradaki boşlukları yiyordu. Gruplarda stroke="none" var.
     *
     * @param {string} kod
     * @param {{genislik?: number, cubuk?: number, etiket?: string}} [secenek]
     *   genislik  Sığması gereken alan (px). Varsayılan 300.
     *   cubuk     Veri çubuklarının boyu (px). Varsayılan 56.
     * @returns {{svg: string, tur: string, genislik: number, yukseklik: number}|null}
     */
    function ciz(kod, secenek) {
        secenek = secenek || {};
        var d = desen(kod);
        if (!d) return null;
        var bit = d.bitler;
        var ean = !!d.ean;
        var solSessiz = ean ? (d.tur === 'EAN-8' ? 7 : 11) : 10;
        var sagSessiz = ean ? 7 : 10;
        var modulSayisi = solSessiz + bit.length + sagSessiz;
        var alan = Math.max(120, secenek.genislik || 300);
        var px = Math.max(1, Math.min(4, Math.floor(alan / modulSayisi)));
        var cubuk = secenek.cubuk || 56;
        var uzama = ean ? Math.round(px * 3.5) : 0;
        var yaziBoy = px >= 2 ? 15 : 12;
        var yaziUst = cubuk + (ean ? 3 : 6);
        var W = modulSayisi * px;
        var H = yaziUst + yaziBoy + 2;

        var cubuklar = '';
        var i = 0;
        while (i < bit.length) {
            if (bit[i] !== '1') { i++; continue; }
            var bas = i;
            var uzun = kilavuzMu(d.tur, i);
            while (i < bit.length && bit[i] === '1' && kilavuzMu(d.tur, i) === uzun) i++;
            cubuklar += '<rect x="' + ((bas + solSessiz) * px) + '" y="0" width="' + ((i - bas) * px) +
                '" height="' + (cubuk + (uzun ? uzama : 0)) + '"/>';
        }

        var yazi = '';
        var y = yaziUst + yaziBoy - 3;
        var font = ' font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="' +
            yaziBoy + '" font-weight="600" fill="#111827" text-anchor="middle"';
        var hane = function (karakter, modulMerkez) {
            return '<text x="' + Math.round((modulMerkez + solSessiz) * px) + '" y="' + y + '"' + font + '>' + karakter + '</text>';
        };
        if (d.tur === 'EAN-13' || d.tur === 'UPC-A') {
            var e = d.ean;
            yazi += '<text x="' + Math.round((solSessiz - 4) * px) + '" y="' + y + '"' + font + '>' + e[0] + '</text>';
            for (var a = 1; a <= 6; a++) yazi += hane(e[a], 3 + 7 * (a - 1) + 3.5);
            for (var b = 7; b <= 12; b++) yazi += hane(e[b], 50 + 7 * (b - 7) + 3.5);
        } else if (d.tur === 'EAN-8') {
            for (var c1 = 0; c1 < 4; c1++) yazi += hane(d.ean[c1], 3 + 7 * c1 + 3.5);
            for (var c2 = 4; c2 < 8; c2++) yazi += hane(d.ean[c2], 36 + 7 * (c2 - 4) + 3.5);
        } else {
            yazi += '<text x="' + Math.round(W / 2) + '" y="' + y + '"' + font + '>' + kacir(d.metin) + '</text>';
        }

        var etiket = secenek.etiket || (d.tur + ' barkodu ' + d.metin);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
            '" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges" role="img" aria-label="' + kacir(etiket) + '">' +
            '<rect width="' + W + '" height="' + H + '" fill="#fff" stroke="none"/>' +
            '<g fill="#111827" stroke="none">' + cubuklar + '</g>' +
            '<g shape-rendering="auto" stroke="none">' + yazi + '</g></svg>';
        return { svg: svg, tur: d.tur, genislik: W, yukseklik: H };
    }

    global.JBBarkodSvg = { ciz: ciz, desen: desen, gecerliEan: gecerliEan };
})(window);
