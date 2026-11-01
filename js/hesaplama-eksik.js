/**
 * Hesaplama > Eksik Ürünler: Excel okuma, Excel yazma, A4 çıktı.
 * ============================================================================
 *
 * Kütüphane yok. xlsx bir ZIP: okurken DecompressionStream('deflate-raw'),
 * yazarken sıkıştırmasız (STORE) ZIP. Dosya tarayıcıdan çıkmaz.
 *
 * OKUNAN DOSYALAR
 * 1. Franchise panelinin Reaktif Eksik Ürün raporu (3 sayfa):
 *      Bayi Kırılımı     bayi toplamı (kullanılmaz)
 *      Ürün Kırılımı     ürün başına satır: kurye, ürün, tarih, tutar
 *      Sipariş Kırılımı  aynı siparişlerin özeti (sipariş başına tek satır)
 *    Asıl liste Ürün Kırılımı. Sipariş Kırılımı yalnız orada olmayan
 *    siparişler için okunur; aynı sipariş iki kez sayılmaz. Ürün Kırılımı'nda
 *    aynı sipariş + ürün + tutar iki kez geçerse tek sayılır.
 * 2. Buradan indirilen Kurye Raporu (Kurye, Tarih, Ürün Adı, Tutar):
 *    Excel'de düzenlenip geri eklenebilsin diye. "… Toplamı" ve
 *    "Genel Toplam" satırları atlanır.
 *
 * window.JBEksik = { oku(File), excel(gruplar, ad), yazdir(gruplar, bilgi) }
 * gruplar: [{ ad, satirlar: [{ tarih: 'YYYY-MM-DD', urun, tutar }] }]
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ------------------------------------------------------------------
    // ZIP okuma
    // ------------------------------------------------------------------

    function hata(m) { var e = new Error(m); e.kullanici = true; return e; }

    async function zipAc(buf) {
        var v = new DataView(buf);
        var son = -1;
        for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
            if (v.getUint32(i, true) === 0x06054b50) { son = i; break; }
        }
        if (son < 0) throw hata('Bu bir Excel (.xlsx) dosyası değil.');
        var adet = v.getUint16(son + 10, true);
        var p = v.getUint32(son + 16, true);
        var dosyalar = {};
        var coz = new TextDecoder();
        for (var n = 0; n < adet; n++) {
            if (v.getUint32(p, true) !== 0x02014b50) break;
            var yontem = v.getUint16(p + 10, true);
            var boy = v.getUint32(p + 20, true);
            var adBoy = v.getUint16(p + 28, true);
            var ekBoy = v.getUint16(p + 30, true);
            var notBoy = v.getUint16(p + 32, true);
            var yer = v.getUint32(p + 42, true);
            var ad = coz.decode(new Uint8Array(buf, p + 46, adBoy));
            dosyalar[ad.replace(/^\//, '')] = { yontem: yontem, boy: boy, yer: yer };
            p += 46 + adBoy + ekBoy + notBoy;
        }
        return {
            var: function (ad) { return !!dosyalar[ad]; },
            metin: async function (ad) {
                var f = dosyalar[ad];
                if (!f) return null;
                var bas = f.yer + 30 + v.getUint16(f.yer + 26, true) + v.getUint16(f.yer + 28, true);
                var parca = new Uint8Array(buf, bas, f.boy);
                if (f.yontem === 0) return coz.decode(parca);
                if (f.yontem !== 8) throw hata('Excel dosyası okunamadı (sıkıştırma türü).');
                if (typeof DecompressionStream !== 'function') throw hata('Bu tarayıcı Excel okuyamıyor. Chrome ya da güncel Safari ile dene.');
                return new Response(new Blob([parca]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
            }
        };
    }

    // ------------------------------------------------------------------
    // xlsx → sayfa → satır dizisi
    // ------------------------------------------------------------------

    function xml(m) { return new DOMParser().parseFromString(m, 'application/xml'); }
    function etiket(d, ad) { return Array.prototype.slice.call(d.getElementsByTagName(ad)); }
    function metinAl(dugum) {
        /* Zengin metin: bütün <t>'ler birleşir, okunuş (<rPh>) atlanır */
        return etiket(dugum, 't').filter(function (t) { return !t.parentNode || t.parentNode.nodeName !== 'rPh'; })
            .map(function (t) { return t.textContent; }).join('');
    }
    function sutunNo(ref) {
        var h = String(ref || '').replace(/\d+/g, '');
        var n = 0;
        for (var i = 0; i < h.length; i++) n = n * 26 + (h.charCodeAt(i) - 64);
        return n - 1;
    }

    async function sayfalar(zip) {
        var kitap = await zip.metin('xl/workbook.xml');
        if (!kitap) throw hata('Bu bir Excel (.xlsx) dosyası değil.');
        var iliski = xml((await zip.metin('xl/_rels/workbook.xml.rels')) || '<r/>');
        var hedef = {};
        etiket(iliski, 'Relationship').forEach(function (r) {
            var t = r.getAttribute('Target') || '';
            hedef[r.getAttribute('Id')] = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
        });
        var ortak = [];
        var ss = await zip.metin('xl/sharedStrings.xml');
        if (ss) ortak = etiket(xml(ss), 'si').map(metinAl);

        var sonuc = [];
        var liste = etiket(xml(kitap), 'sheet');
        for (var i = 0; i < liste.length; i++) {
            var s = liste[i];
            var yol = hedef[s.getAttribute('r:id')] || 'xl/worksheets/sheet' + (i + 1) + '.xml';
            var m = await zip.metin(yol);
            if (!m) continue;
            var satirlar = [];
            etiket(xml(m), 'row').forEach(function (r) {
                var dizi = [];
                etiket(r, 'c').forEach(function (c, j) {
                    var ref = c.getAttribute('r');
                    var no = ref ? sutunNo(ref) : j;
                    var tur = c.getAttribute('t');
                    var vd = c.getElementsByTagName('v')[0];
                    var deger = null;
                    if (tur === 's') deger = vd ? ortak[+vd.textContent] : '';
                    else if (tur === 'inlineStr') deger = metinAl(c);
                    else if (tur === 'str' || tur === 'e') deger = vd ? vd.textContent : '';
                    else if (tur === 'b') deger = vd ? vd.textContent === '1' : null;
                    else if (vd) deger = Number(vd.textContent);
                    dizi[no] = deger;
                });
                satirlar[(+r.getAttribute('r') || satirlar.length + 1) - 1] = dizi;
            });
            sonuc.push({ ad: s.getAttribute('name') || '', satirlar: satirlar.filter(Boolean) });
        }
        return sonuc;
    }

    // ------------------------------------------------------------------
    // Sayfaları anlama
    // ------------------------------------------------------------------

    /* Türkçe küçültme "ID"yi "ıd" yapar; ı ve i aynı sayılır */
    function bas(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr').replace(/ı/g, 'i'); }

    /* Başlık satırı ilk 5 satırdan biri; aranan sütunların hepsi olmalı */
    function basliklar(sayfa, gerek) {
        for (var i = 0; i < Math.min(5, sayfa.satirlar.length); i++) {
            var r = sayfa.satirlar[i] || [];
            var yer = {};
            for (var j = 0; j < r.length; j++) { var b = bas(r[j]); if (b && yer[b] == null) yer[b] = j; }
            if (gerek.every(function (g) { return g.some(function (a) { return yer[bas(a)] != null; }); })) return { satir: i, yer: yer };
        }
        return null;
    }
    function sutun(b, adaylar) {
        for (var i = 0; i < adaylar.length; i++) if (b.yer[bas(adaylar[i])] != null) return b.yer[bas(adaylar[i])];
        return -1;
    }

    function ikiHane(n) { return (n < 10 ? '0' : '') + n; }
    function tarih(v) {
        if (typeof v === 'number' && v > 20000 && v < 80000) {
            /* Excel günü duvar saatidir; UTC'de çözünce gün kaymaz */
            return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 864e5)).toISOString().slice(0, 10);
        }
        var s = String(v == null ? '' : v).trim();
        var m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
        if (m) return m[3] + '-' + ikiHane(+m[2]) + '-' + ikiHane(+m[1]);
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? m[0] : '';
    }
    function tutar(v) {
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        var s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
        if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
        var n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
    }
    function yazi(v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f ]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function kurus(n) { return Math.round(n * 100) / 100; }

    function getirRaporu(liste) {
        var urunS = null, siparisS = null;
        liste.forEach(function (s) {
            if (!urunS) {
                var b = basliklar(s, [['kurye'], ['ürün', 'ürün adı'], ['tutar']]);
                if (b && sutun(b, ['sipariş id']) > -1) { urunS = { s: s, b: b }; return; }
            }
            if (!siparisS) {
                var b2 = basliklar(s, [['sipariş id'], ['kurye'], ['tutar']]);
                if (b2 && sutun(b2, ['ürün', 'ürün adı']) < 0) siparisS = { s: s, b: b2 };
            }
        });
        if (!urunS && !siparisS) return null;

        var satirlar = [];
        var gorulen = {};
        var siparisler = {};
        var cift = 0;
        if (urunS) {
            var b = urunS.b;
            var c = {
                sip: sutun(b, ['sipariş id']), kurye: sutun(b, ['kurye']), uid: sutun(b, ['ürün id']), urun: sutun(b, ['ürün', 'ürün adı']),
                tarih: sutun(b, ['sipariş tarihi', 'tarih']), tercih: sutun(b, ['müşteri tercihi']), tutar: sutun(b, ['tutar']),
                depo: sutun(b, ['depodan bildirilen eksik ürün'])
            };
            urunS.s.satirlar.slice(b.satir + 1).forEach(function (r) {
                var kurye = yazi(r[c.kurye]);
                var urun = yazi(r[c.urun]);
                if (!kurye && !urun) return;
                var sip = yazi(r[c.sip]);
                var t = kurus(tutar(r[c.tutar]));
                var anahtar = sip + '|' + (c.uid > -1 ? yazi(r[c.uid]) : urun) + '|' + t;
                if (sip && gorulen[anahtar]) { cift++; return; }
                gorulen[anahtar] = true;
                if (sip) siparisler[sip] = true;
                satirlar.push({
                    kurye: kurye || 'Kurye yok', tarih: tarih(r[c.tarih]), urun: urun || 'Ürün adı yok', tutar: t,
                    kupon: c.tercih > -1 && /kupon/i.test(yazi(r[c.tercih])),
                    depo: c.depo > -1 && (r[c.depo] === 1 || r[c.depo] === true || yazi(r[c.depo]) === '1')
                });
            });
        }
        var ekSiparis = 0;
        if (siparisS) {
            var b3 = siparisS.b;
            var c3 = {
                sip: sutun(b3, ['sipariş id']), kurye: sutun(b3, ['kurye']), tarih: sutun(b3, ['sipariş tarihi', 'tarih']),
                tercih: sutun(b3, ['müşteri tercihi']), tutar: sutun(b3, ['tutar']), depo: sutun(b3, ['depodan bildirilen eksik ürün'])
            };
            siparisS.s.satirlar.slice(b3.satir + 1).forEach(function (r) {
                var sip = yazi(r[c3.sip]);
                if (!sip || siparisler[sip]) return;
                siparisler[sip] = true;
                ekSiparis++;
                satirlar.push({
                    kurye: yazi(r[c3.kurye]) || 'Kurye yok', tarih: tarih(r[c3.tarih]), urun: 'Sipariş (ürün kırılımında yok)',
                    tutar: kurus(tutar(r[c3.tutar])),
                    kupon: c3.tercih > -1 && /kupon/i.test(yazi(r[c3.tercih])),
                    depo: c3.depo > -1 && (r[c3.depo] === 1 || r[c3.depo] === true || yazi(r[c3.depo]) === '1')
                });
            });
        }
        return { tur: 'getir', satirlar: satirlar, cift: cift, ekSiparis: ekSiparis };
    }

    function kuryeRaporu(liste) {
        for (var i = 0; i < liste.length; i++) {
            var s = liste[i];
            var b = basliklar(s, [['kurye'], ['ürün adı', 'ürün'], ['tutar']]);
            if (!b) continue;
            var c = { kurye: sutun(b, ['kurye']), tarih: sutun(b, ['tarih', 'sipariş tarihi']), urun: sutun(b, ['ürün adı', 'ürün']), tutar: sutun(b, ['tutar']) };
            var satirlar = [];
            s.satirlar.slice(b.satir + 1).forEach(function (r) {
                var kurye = yazi(r[c.kurye]);
                var urun = yazi(r[c.urun]);
                if (!kurye || !urun || / toplamı$/i.test(kurye) || bas(kurye) === 'genel toplam') return;
                var t = r[c.tutar];
                if (typeof t === 'string' && t.charAt(0) === '=') return;
                satirlar.push({ kurye: kurye, tarih: tarih(r[c.tarih]), urun: urun, tutar: kurus(tutar(t)), kupon: false, depo: false });
            });
            return { tur: 'rapor', satirlar: satirlar, cift: 0, ekSiparis: 0 };
        }
        return null;
    }

    /* Ay: dosya adındaki dönem, yoksa tarihlerin çoğunluğu */
    function ayBul(dosyaAdi, satirlar) {
        var m = String(dosyaAdi || '').match(/(\d{2})-(\d{2})-(\d{4})_(\d{2})-(\d{2})-(\d{4})/);
        if (m && m[2] === m[5] && m[3] === m[6]) return m[3] + '-' + m[2];
        var say = {};
        satirlar.forEach(function (s) { if (s.tarih) say[s.tarih.slice(0, 7)] = (say[s.tarih.slice(0, 7)] || 0) + 1; });
        var en = null;
        Object.keys(say).forEach(function (a) { if (!en || say[a] > say[en]) en = a; });
        return en;
    }

    async function oku(dosya) {
        if (!dosya) throw hata('Dosya seçilmedi.');
        if (dosya.size > 15 * 1024 * 1024) throw hata('Dosya çok büyük (15 MB üstü).');
        if (/\.xls$/i.test(dosya.name)) throw hata('Eski .xls biçimi okunmuyor. Excel\'de .xlsx olarak kaydedip ekle.');
        var zip = await zipAc(await dosya.arrayBuffer());
        var liste = await sayfalar(zip);
        var r = getirRaporu(liste) || kuryeRaporu(liste);
        if (!r) throw hata('Dosyada Kurye, Ürün ve Tutar sütunları bulunamadı. Franchise panelinin eksik ürün raporunu ekle.');
        if (!r.satirlar.length) throw hata('Dosyada eksik ürün satırı yok.');
        r.ay = ayBul(dosya.name, r.satirlar);
        r.sayfa = liste.length;
        return r;
    }

    // ------------------------------------------------------------------
    // Excel yazma (Kurye Raporu şablonu)
    // ------------------------------------------------------------------

    var CRC = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(b) {
        var c = 0xffffffff;
        for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function zipYaz(dosyalar) {
        var kod = new TextEncoder();
        var parcalar = [], merkez = [], yer = 0;
        dosyalar.forEach(function (f) {
            var ad = kod.encode(f.ad);
            var veri = kod.encode(f.metin);
            var crc = crc32(veri);
            var y = new DataView(new ArrayBuffer(30));
            y.setUint32(0, 0x04034b50, true); y.setUint16(4, 20, true); y.setUint16(6, 0x0800, true);
            y.setUint32(14, crc, true); y.setUint32(18, veri.length, true); y.setUint32(22, veri.length, true);
            y.setUint16(26, ad.length, true);
            parcalar.push(new Uint8Array(y.buffer), ad, veri);
            var m = new DataView(new ArrayBuffer(46));
            m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true); m.setUint16(8, 0x0800, true);
            m.setUint32(16, crc, true); m.setUint32(20, veri.length, true); m.setUint32(24, veri.length, true);
            m.setUint16(28, ad.length, true); m.setUint32(42, yer, true);
            merkez.push(new Uint8Array(m.buffer), ad);
            yer += 30 + ad.length + veri.length;
        });
        var mBoy = merkez.reduce(function (t, p) { return t + p.length; }, 0);
        var s = new DataView(new ArrayBuffer(22));
        s.setUint32(0, 0x06054b50, true); s.setUint16(8, dosyalar.length, true); s.setUint16(10, dosyalar.length, true);
        s.setUint32(12, mBoy, true); s.setUint32(16, yer, true);
        return new Blob(parcalar.concat(merkez, [new Uint8Array(s.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function trTarih(t) { return t ? t.slice(8, 10) + '.' + t.slice(5, 7) + '.' + t.slice(0, 4) : ''; }

    /* Biçimler şablondaki gibi: lacivert başlık, kuryeye göre sıralı açık
       zemin, "… Toplamı" satırı, en altta Genel Toplam. A4 dikey, tek sayfa genişliği. */
    var STIL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;₺&quot;#,##0.00"/></numFmts>' +
        '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F9FC"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/></patternFill></fill></fills>' +
        '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border><left style="thin"><color rgb="FFBFC8D6"/></left><right style="thin"><color rgb="FFBFC8D6"/></right><top style="thin"><color rgb="FFBFC8D6"/></top><bottom style="thin"><color rgb="FFBFC8D6"/></bottom><diagonal/></border>' +
        '<border><left style="medium"><color rgb="FF17365D"/></left><right style="medium"><color rgb="FF17365D"/></right><top style="medium"><color rgb="FF17365D"/></top><bottom style="medium"><color rgb="FF17365D"/></bottom><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="10">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="164" fontId="2" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="164" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
        '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

    function excelBlob(gruplar) {
        var satir = 1;
        var rows = [];
        var hucre = function (sut, s, deger) {
            var ref = sut + satir;
            if (deger == null || deger === '') return '<c r="' + ref + '" s="' + s + '"/>';
            if (typeof deger === 'number') return '<c r="' + ref + '" s="' + s + '"><v>' + deger + '</v></c>';
            if (deger.f) return '<c r="' + ref + '" s="' + s + '"><f>' + x(deger.f) + '</f><v>' + deger.v + '</v></c>';
            return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + x(deger) + '</t></is></c>';
        };
        var ekle = function (h) { rows.push('<row r="' + satir + '">' + h.join('') + '</row>'); satir++; };
        ekle([hucre('A', 1, 'Kurye'), hucre('B', 1, 'Tarih'), hucre('C', 1, 'Ürün Adı'), hucre('D', 1, 'Tutar')]);
        var araToplamlar = [], genel = 0;
        gruplar.forEach(function (g, i) {
            var yazi0 = i % 2 ? 4 : 2, para0 = i % 2 ? 5 : 3;
            var ilk = satir, toplam = 0;
            g.satirlar.forEach(function (s) {
                toplam += s.tutar;
                ekle([hucre('A', yazi0, g.ad), hucre('B', yazi0, trTarih(s.tarih)), hucre('C', yazi0, s.urun), hucre('D', para0, s.tutar)]);
            });
            toplam = kurus(toplam);
            genel += toplam;
            araToplamlar.push('D' + satir);
            ekle([hucre('A', 6, g.ad + ' Toplamı'), hucre('B', 6, ''), hucre('C', 6, ''), hucre('D', 7, { f: 'ROUND(SUM(D' + ilk + ':D' + (satir - 1) + '),2)', v: toplam })]);
            satir++;
        });
        ekle([hucre('A', 8, 'Genel Toplam'), hucre('B', 8, ''), hucre('C', 8, ''),
            hucre('D', 9, { f: araToplamlar.length ? 'ROUND(SUM(' + araToplamlar.join(',') + '),2)' : '0', v: kurus(genel) })]);

        var sayfa = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheetPr><tabColor rgb="FF17365D"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
            '<dimension ref="A1:D' + (satir - 1) + '"/>' +
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
            '<sheetFormatPr defaultRowHeight="15"/>' +
            '<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="11" customWidth="1"/>' +
            '<col min="3" max="3" width="48" customWidth="1"/><col min="4" max="4" width="12" customWidth="1"/></cols>' +
            '<sheetData>' + rows.join('') + '</sheetData>' +
            '<printOptions horizontalCentered="1"/>' +
            '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
            '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
            '</worksheet>';
        return zipYaz([
            { ad: '[Content_Types].xml', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
            { ad: '_rels/.rels', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
            { ad: 'xl/workbook.xml', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kurye Raporu" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">\'Kurye Raporu\'!$1:$1</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
            { ad: 'xl/_rels/workbook.xml.rels', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
            { ad: 'xl/styles.xml', metin: STIL },
            { ad: 'xl/worksheets/sheet1.xml', metin: sayfa }
        ]);
    }

    function excel(gruplar, ad) {
        var b = excelBlob(gruplar);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = ad;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }

    // ------------------------------------------------------------------
    // A4 çıktı (tarayıcının yazdır penceresi; "PDF olarak kaydet")
    // ------------------------------------------------------------------

    function paraYaz(n) { return '₺' + kurus(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function yazdir(gruplar, bilgi) {
        var eski = document.getElementById('hsYazdir');
        if (eski) eski.remove();
        var genel = 0, adet = 0;
        var govde = gruplar.map(function (g, i) {
            var toplam = 0;
            var satirlar = g.satirlar.map(function (s) {
                toplam += s.tutar; adet++;
                return '<tr class="' + (i % 2 ? 'is-cift' : '') + '"><td>' + x(g.ad) + '</td><td>' + trTarih(s.tarih) + '</td><td>' + x(s.urun) + '</td><td class="sag">' + paraYaz(s.tutar) + '</td></tr>';
            }).join('');
            genel += kurus(toplam);
            return '<tbody>' + satirlar + '<tr class="ara"><td colspan="3">' + x(g.ad) + ' Toplamı</td><td class="sag">' + paraYaz(toplam) + '</td></tr></tbody>';
        }).join('');
        var kap = document.createElement('div');
        kap.id = 'hsYazdir';
        kap.className = 'hs-yazdir';
        kap.innerHTML =
            '<header><h1>' + x(bilgi.baslik) + '</h1><p>' + x(bilgi.alt) + ' · ' + gruplar.length + ' kurye · ' + adet + ' ürün</p></header>' +
            '<table><colgroup><col style="width:27%"><col style="width:13%"><col style="width:46%"><col style="width:14%"></colgroup>' +
            '<thead><tr><th>Kurye</th><th>Tarih</th><th>Ürün Adı</th><th class="sag">Tutar</th></tr></thead>' + govde +
            /* tfoot her sayfada tekrar basılır; Genel Toplam yalnız sonda */
            '<tbody><tr class="genel"><td colspan="3">Genel Toplam</td><td class="sag">' + paraYaz(genel) + '</td></tr></tbody></table>';
        document.body.appendChild(kap);
        var eskiBaslik = document.title;
        document.title = bilgi.dosya || eskiBaslik;
        document.body.classList.add('hs-yazdiriliyor');
        var bitti = function () {
            document.body.classList.remove('hs-yazdiriliyor');
            document.title = eskiBaslik;
            removeEventListener('afterprint', bitti);
        };
        addEventListener('afterprint', bitti);
        setTimeout(function () { global.print(); }, 30);
    }

    global.JBEksik = { oku: oku, excel: excel, yazdir: yazdir, excelBlob: excelBlob };
})(window);
