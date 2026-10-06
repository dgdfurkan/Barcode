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
        if (/^\d{12}$/.test(k) && gecerliEan('0' + k)) return { tur: 'UPC-A', bitler: ean13Desen('0' + k), sessiz: 9 };
        if (/^\d{13}$/.test(k) && gecerliEan(k)) return { tur: 'EAN-13', bitler: ean13Desen(k), sessiz: 9 };
        if (/^\d{8}$/.test(k) && gecerliEan(k)) return { tur: 'EAN-8', bitler: ean8Desen(k), sessiz: 7 };
        var c = code128Desen(k);
        return c ? { tur: 'Code 128', bitler: c, sessiz: 10 } : null;
    }

    /**
     * @param {string} kod
     * @param {{yukseklik?: number, etiket?: string}} [secenek]
     * @returns {{svg: string, tur: string}|null}
     */
    function ciz(kod, secenek) {
        var d = desen(kod);
        if (!d) return null;
        var h = (secenek && secenek.yukseklik) || 56;
        var bit = d.bitler;
        var genislik = bit.length + d.sessiz * 2;
        var cubuklar = '';
        var i = 0;
        while (i < bit.length) {
            if (bit[i] !== '1') { i++; continue; }
            var bas = i;
            while (i < bit.length && bit[i] === '1') i++;
            cubuklar += '<rect x="' + (bas + d.sessiz) + '" y="0" width="' + (i - bas) + '" height="' + h + '"/>';
        }
        var etiket = (secenek && secenek.etiket) || (d.tur + ' barkodu');
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + genislik + ' ' + h + '"' +
            ' preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="' +
            etiket.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' +
            '<rect width="' + genislik + '" height="' + h + '" fill="#fff"/>' +
            '<g fill="#111827">' + cubuklar + '</g></svg>';
        return { svg: svg, tur: d.tur };
    }

    global.JBBarkodSvg = { ciz: ciz, desen: desen, gecerliEan: gecerliEan };
})(window);
