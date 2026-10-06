/**
 * Jet Barkod Asistan. Arka plan.
 *
 * Modüllerin arka plan gerektiren parçaları `arka-plan/` altında ayrı
 * dosyalarda duruyor ve buradan içeri alınıyor. Böylece bir modülün arka
 * plan kodu diğerininkiyle karışmıyor.
 */
import './arka-plan/dusuk-stok.js';
import './arka-plan/sayim-hazirligi.js';
import './arka-plan/raf-etiketi.js';
import './arka-plan/urun-cekici.js';
import './arka-plan/siparis-kopru.js';
import './arka-plan/siteye-git.js';

/**
 * Güncelleme sonrası açık panel sekmelerini tazele.
 *
 * NEDEN
 * Chrome eklentiyi güncellediğinde eski sekmelerdeki içerik betikleri
 * YETİM kalıyor: `chrome.runtime.id` tanımsız oluyor, `sendMessage`
 * sessizce düşüyor. Sayfa görsel olarak normal görünmeye devam ediyor,
 * ama veri akışı durmuş oluyor. Depoda açık duran panel bu yüzden
 * saatlerce ölü kalıp veritabanını donduruyordu.
 *
 * Yalnız sipariş panosu yenileniyor. Orası salt okunur bir ekran,
 * yenilemek veri kaybettirmiyor. Franchise sayfalarına dokunulmuyor;
 * orada sayım gibi yarım kalabilecek işler var, onlar için içerik
 * betiğindeki yetim bağlam uyarısı devrede.
 */
const PANO_ADRESI = 'https://warehouse.getir.com/r/*/dashboard/orders*';

chrome.runtime.onInstalled.addListener(function (ayrinti) {
    if (ayrinti.reason !== 'update' && ayrinti.reason !== 'install') return;
    try {
        chrome.tabs.query({ url: PANO_ADRESI }, function (sekmeler) {
            if (chrome.runtime.lastError) return;
            (sekmeler || []).forEach(function (t) {
                try { chrome.tabs.reload(t.id, { bypassCache: false }); } catch (e) { /* sekme gitmiş */ }
            });
        });
    } catch (e) { /* sessiz */ }
});

/* JETON TOPLAMA
   Eklenti kurulunca ya da güncellenince manifestteki içerik betikleri
   açık sekmelere kendiliğinden girmiyor. Jet Barkod sekmesi günlerdir
   açıksa site köprüsü orada yok, jeton da eklentiye hiç ulaşmıyordu:
   depo panelinden gelen siparişler, biri Jet Barkod'u yenileyene kadar
   yazılmıyordu. Köprü açık sekmelere elle sokuluyor; selam verir vermez
   site jetonu yeniden veriyor (js/asistan-koprusu.js). */
const SITE_ADRESLERI = ['https://jetbarkod.com.tr/*', 'https://www.jetbarkod.com.tr/*'];

function siteKoprusunuSok() {
    try {
        chrome.tabs.query({ url: SITE_ADRESLERI }, function (sekmeler) {
            if (chrome.runtime.lastError) return;
            (sekmeler || []).forEach(function (t) {
                chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['site-koprusu.js'] })
                    .catch(function () { /* sekme yükleniyor ya da kapanmış */ });
            });
        });
    } catch (e) { /* sessiz */ }
}

chrome.runtime.onInstalled.addListener(function (ayrinti) {
    if (ayrinti.reason === 'update' || ayrinti.reason === 'install') siteKoprusunuSok();
});

/* Depo panelindeki "Oturumu bağla" düğmesi. Açık Jet Barkod sekmelerine
   köprü sokuluyor; hiç sekme yoksa siparişler sayfası açılıyor. Kullanıcı
   girişliyse jeton saniyeler içinde geliyor, değilse giriş ekranı çıkıyor. */
chrome.runtime.onMessage.addListener(function (istek, gonderen, cevapla) {
    if (!istek || istek.type !== 'JBA_JETON_TOPLA') return;
    chrome.tabs.query({ url: SITE_ADRESLERI }, function (sekmeler) {
        if (chrome.runtime.lastError) { cevapla({ ok: false }); return; }
        /* Sayım sayfaları yenilenmiyor: orada yarım kalmış bir giriş
           olabilir. Köprü yine de onlara da sokuluyor. */
        var yenilenebilir = (sekmeler || []).filter(function (t) {
            return !/\/sayim/i.test(t.url || '');
        });
        if (sekmeler && sekmeler.length) siteKoprusunuSok();
        if (yenilenebilir.length) {
            /* Köprü sokulsa da sayfadaki eski betik jetonu yeniden vermeyebilir;
               en garantisi sekmeyi yenilemek. Bu sayfalar yenilenince veri
               kaybetmiyor. */
            yenilenebilir.forEach(function (t) {
                try { chrome.tabs.reload(t.id); } catch (e) { /* sekme gitmiş */ }
            });
            cevapla({ ok: true, sekme: yenilenebilir.length });
        } else {
            chrome.tabs.create({ url: 'https://jetbarkod.com.tr/siparisler/', active: true }, function () {
                cevapla({ ok: !chrome.runtime.lastError, sekme: 0 });
            });
        }
    });
    return true;
});
