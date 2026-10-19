/**
 * Sayım geçmişi: depo panelindeki tamamlanmış sayımların ürün başına sonucu.
 * ============================================================================
 *
 * Jet Barkod'daki "Sayım Geçmişi" penceresi bir tarih aralığı veriyor. Buradan
 * o aralıkta depo panelinde yapılmış her sayımın her ürünü için sistem adedi
 * ile sayılan adet dönüyor. Fark bunların farkı; sıfırlanan ürün de böylece
 * görünüyor.
 *
 * NASIL
 * SKT'deki yöntemin aynısı. Panelin oturumunu ve isteklerini taklit etmiyoruz.
 * Öne çıkmayan bir sekmede panelin sayım listesi açılıyor; adres panelin kendi
 * yönlendiricisiyle değiştirilip panel isteği kendisi atıyor. Sayfa köprüsü
 * (sayfa-koprusu.js) yanıtı GETIR_DATA_RECEIVED olarak duyuruyor, burada
 * okunuyor. Görev listesi panelde adresle değil sayfa düğmesiyle ilerliyor,
 * orada panelin "sonraki sayfa" düğmesine basılıyor.
 *
 * Panelin sırası: sayım listesi (20'şer) → sayım → görev listesi (10'ar) →
 * her görevin detayı. Adetler yalnız görev detayında var.
 *
 * KORUMA
 *   - İstekler sırayla, aralarında bekleme var; aynı anda tek iş.
 *   - Depo kimliği çağırandan gelir ve biçimi denetlenir; sabit kimlik yok.
 *   - Kişi adları (toplayıcı, oluşturan, görevli) hiç aktarılmaz.
 *   - Üst üste 4 istek cevapsız kalırsa (oturum düştü, panel değişti) iş durur.
 *   - Daha önce eksiksiz alınmış sayımlar tekrar istenmez.
 *   - İş bitince ya da durdurulunca sekme kapanır.
 * ============================================================================
 */

const LISTE_BOYU = 20;
const LISTE_ARASI_MS = 600;
const GOREV_SAYFA_ARASI_MS = 450;
const GOREV_ARASI_MS = 300;
const YANIT_BEKLEME_MS = 12000;
const UST_USTE_HATA_SINIRI = 4;
const EN_FAZLA_GUN = 93;
const TAMAMLANDI = 600;

const KIMLIK = /^[0-9a-f]{24}$/;
// Alışveriş poşetleri (Nonwoven, atlet, depozitolu): sayım geçmişine girmez.
// "Poşet Çay", "Buzdolabı Poşeti", "Poşet Ton Balığı" gibi ürünler etkilenmez.
const POSET = /nonwoven|atlet[^,()]*po[sş]et|depozitolu po[sş]et|çevre günü po[sş]et/i;
const TARIH = /^\d{4}-\d{2}-\d{2}$/;

let calisan = null; // { durdur: boolean, cagiran: tabId }

function bekle(ms) { return new Promise((r) => setTimeout(r, ms)); }

function listeYolu(depo, bas, bit, sayfa) {
  return `/r/${depo}/stock/gstore-inventory-check/list?offset=${sayfa}&endDate=${bit}&startDate=${bas}&warehouseIds=${depo}`;
}
function sayimYolu(depo, sayimId) {
  return `/r/${depo}/stock/gstore-inventory-check/${sayimId}`;
}
function gorevYolu(depo, sayimId, isId, gorevId) {
  return `/r/${depo}/stock/gstore-inventory-check/${sayimId}/job/${isId}/task/${gorevId}`;
}

function olay(cagiran, veri) {
  if (!cagiran) return;
  // Arka plandaki gece işi (gunluk-sayim.js) olayları doğrudan toplar
  if (typeof cagiran === 'function') { try { cagiran(veri); } catch (e) { /* sessiz */ } return; }
  try {
    chrome.tabs.sendMessage(cagiran, { type: 'JBA_SAYIM_GECMISI_OLAY', ...veri }).catch(() => {});
  } catch (e) { /* çağıran sekme gitmiş */ }
}

/** Panel sekmesi açılıp sayım listesinde hazır olana kadar bekler. */
async function sekmeHazirBekle(tabId, zamanAsimiMs = 30000) {
  const bitis = Date.now() + zamanAsimiMs;
  while (Date.now() < bitis) {
    let tab = null;
    try { tab = await chrome.tabs.get(tabId); } catch (e) { return { ok: false, hata: 'Depo paneli sekmesi kapandı.' }; }
    const url = tab.url || tab.pendingUrl || '';
    if (/stockid\.getirapi\.com/.test(url) && !/prompt=none/.test(url) && tab.status === 'complete') {
      return { ok: false, hata: 'Depo paneline giriş yapılmamış. warehouse.getir.com\'a bir kez giriş yapın.' };
    }
    if (tab.status === 'complete' && /\/gstore-inventory-check\/list/.test(url)) {
      try {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: () => !!(window.__jbSayfaKoprusu && /\/gstore-inventory-check\/list/.test(location.pathname) && document.querySelector('table')),
        });
        if (r && r.result) return { ok: true };
      } catch (e) { /* sayfa yükleniyor */ }
    }
    await bekle(400);
  }
  return { ok: false, hata: 'Depo paneli yanıt vermedi. Biraz sonra tekrar deneyin.' };
}

/**
 * Panelin kendi isteğini attırır: ya adresi panelin yönlendiricisiyle
 * değiştirir ya da verilen düğmeye basar. Adresi `desen`e uyan ilk panel
 * yanıtını döndürür.
 */
async function panelIstegi(tabId, { adres = null, tikla = null, desen, sure = YANIT_BEKLEME_MS }) {
  let sonuc;
  try {
    [sonuc] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [adres, tikla, desen, sure],
      func: (adresP, tiklaP, desenP, sureP) => new Promise((coz) => {
        const kalip = new RegExp(desenP);
        let bitti = false;
        const son = (v) => {
          if (bitti) return;
          bitti = true;
          window.removeEventListener('message', dinle);
          clearTimeout(zaman);
          coz(v);
        };
        const dinle = (e) => {
          const d = e.data;
          if (!d || d.type !== 'GETIR_DATA_RECEIVED' || !kalip.test(d.url || '')) return;
          son({ ok: true, url: d.url, veri: d.payload });
        };
        window.addEventListener('message', dinle);
        const zaman = setTimeout(() => son({ ok: false, hata: 'zaman-asimi' }), sureP);
        try {
          if (adresP) {
            history.pushState({}, '', adresP);
            dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          } else if (tiklaP) {
            // Tablo yeni sayfayı çizene kadar düğme olmayabilir ya da pasif kalabilir; 5 sn bekle
            const sinir = Date.now() + 5000;
            const dene = () => {
              if (bitti) return;
              const el = document.querySelector(tiklaP);
              if (el) el.click();
              else if (Date.now() < sinir) setTimeout(dene, 150);
              else son({ ok: false, hata: 'dugme-yok' });
            };
            dene();
          }
        } catch (err) {
          son({ ok: false, hata: 'adres-degismedi' });
        }
      }),
    });
  } catch (e) {
    return { ok: false, hata: 'betik-calismadi' };
  }
  return (sonuc && sonuc.result) || { ok: false, hata: 'betik-calismadi' };
}

/** Bir kez daha dener; panel ilk açılışta oturumunu tazeliyor olabilir. */
async function israrla(tabId, secenek) {
  let r = await panelIstegi(tabId, secenek);
  if (!r.ok && r.hata !== 'dugme-yok') {
    await bekle(1500);
    r = await panelIstegi(tabId, secenek);
  }
  return r;
}

function adetToplami(liste) {
  if (!Array.isArray(liste)) return 0;
  let t = 0;
  for (const x of liste) {
    const n = Number(x && x.count);
    if (Number.isFinite(n)) t += n;
  }
  return Math.round(t * 1000) / 1000;
}

function urunAdi(veri) {
  const ad = veri && veri.productFullName;
  const metin = typeof ad === 'string' ? ad : (ad && (ad.tr || ad.en)) || '';
  return String(metin).slice(0, 200) || null;
}

/** Görev detayından yalnız gereken alanlar. Kişi adı yok. */
function kayitYap(sayim, gorev, detay) {
  const v = detay && detay.data;
  if (!v || !KIMLIK.test(String(v.productId || ''))) return null;
  return {
    g: String(gorev.id),
    s: String(sayim.id),
    p: String(v.productId),
    ad: urunAdi(v),
    sis: adetToplami(v.systemStocks),
    fiz: adetToplami(v.physicalStocks),
    b: Number.isFinite(Number(v.stockUnitOfMeasurement)) ? Number(v.stockUnitOfMeasurement) : null,
    o: sayim.isAutoInventoryCheck === true,
    n: Number(sayim.totalTaskCount) || null,
    sa: sayim.createdAt || null,
    ta: detay.completedAt || null,
  };
}

async function sayimListesi(tabId, depo, bas, bit) {
  const sayimlar = [];
  const gorulen = new Set();
  for (let sayfa = 1; sayfa <= 60; sayfa++) {
    if (calisan && calisan.durdur) return { ok: false, durduruldu: true };
    const ofset = (sayfa - 1) * LISTE_BOYU;
    const r = await israrla(tabId, {
      adres: listeYolu(depo, bas, bit, sayfa),
      desen: `/gstore-inventory-checks/filter\\?(?:.*&)?offset=${ofset}(?:&|$)`,
    });
    if (!r.ok) return { ok: false, hata: 'Sayım listesi alınamadı.' };
    const govde = r.veri && r.veri.data;
    const parca = govde && Array.isArray(govde.data) ? govde.data : null;
    if (!parca) return { ok: false, hata: 'Sayım listesi okunamadı.' };
    for (const s of parca) {
      if (!s || !KIMLIK.test(String(s.id)) || gorulen.has(s.id)) continue;
      gorulen.add(s.id);
      sayimlar.push(s);
    }
    const toplam = Number(govde.total) || 0;
    if (parca.length < LISTE_BOYU || sayimlar.length >= toplam) break;
    await bekle(LISTE_ARASI_MS);
  }
  return { ok: true, sayimlar };
}

async function gorevListesi(tabId, depo, sayim) {
  const desen = (ofset) => `/gstore-inventory-checks/${sayim.id}/tasks/filter\\?(?:.*&)?offset=${ofset}(?:&|$)`;
  const herhangi = `/gstore-inventory-checks/${sayim.id}/tasks/filter`;

  let r = await israrla(tabId, { adres: sayimYolu(depo, sayim.id), desen: herhangi });
  if (!r.ok) return { ok: false };
  // Bileşen yeniden kurulmadıysa önceki sayfa numarası kalmış olabilir
  const ilkOfset = Number(new URL(r.url).searchParams.get('offset') || 0);
  if (ilkOfset !== 0) {
    await bekle(GOREV_SAYFA_ARASI_MS);
    r = await israrla(tabId, { tikla: '.ant-pagination .ant-pagination-item-1', desen: desen(0) });
    if (!r.ok) return { ok: false };
  }

  const gorevler = [];
  let govde = r.veri && r.veri.data;
  const toplam = Number(govde && govde.total) || 0;
  for (let tur = 0; tur < 600; tur++) {
    const parca = govde && Array.isArray(govde.tasks) ? govde.tasks : [];
    gorevler.push(...parca.filter((g) => g && KIMLIK.test(String(g.id))));
    if (!parca.length || gorevler.length >= toplam) break;
    if (calisan && calisan.durdur) break;
    await bekle(GOREV_SAYFA_ARASI_MS);
    r = await israrla(tabId, {
      tikla: '.ant-pagination .ant-pagination-next:not(.ant-pagination-disabled) .ant-pagination-item-link',
      desen: desen(gorevler.length),
    });
    if (!r.ok) return { ok: false };
    govde = r.veri && r.veri.data;
  }
  return { ok: true, gorevler, toplam };
}

async function calistir(istek, cagiran) {
  const depo = String(istek.warehouseId || '');
  const bas = String(istek.baslangic || '');
  const bit = String(istek.bitis || '');
  const otomatik = istek.otomatik !== false;
  const bilinen = istek.bilinen && typeof istek.bilinen === 'object' ? istek.bilinen : {};

  if (!KIMLIK.test(depo)) return olay(cagiran, { tur: 'bitti', ok: false, hata: 'Depo bilgisi yok. Franchise stok sayfasını bir kez açın.' });
  if (!TARIH.test(bas) || !TARIH.test(bit) || bas > bit) return olay(cagiran, { tur: 'bitti', ok: false, hata: 'Tarih aralığı geçersiz.' });
  if ((Date.parse(bit) - Date.parse(bas)) / 86400000 > EN_FAZLA_GUN) {
    return olay(cagiran, { tur: 'bitti', ok: false, hata: 'En fazla 3 aylık aralık seçilebilir.' });
  }

  let tabId = null;
  let yapilan = 0;
  let kayitSayisi = 0;
  try {
    olay(cagiran, { tur: 'ilerleme', asama: 'acilis', mesaj: 'Depo paneli açılıyor' });
    let pencere = istek.pencere || null;
    if (!pencere && typeof cagiran === 'number') {
      try { pencere = (await chrome.tabs.get(cagiran)).windowId; } catch (e) { /* yok */ }
    }
    // Sekme süzgeçsiz listede açılır: ilk sayfa adresi farklı olsun ki panel isteği yeniden atsın
    const tab = await chrome.tabs.create({
      url: `https://warehouse.getir.com/r/${depo}/stock/gstore-inventory-check/list`,
      active: false,
      ...(pencere ? { windowId: pencere } : {}),
    });
    tabId = tab.id;

    const hazir = await sekmeHazirBekle(tabId);
    if (!hazir.ok) return olay(cagiran, { tur: 'bitti', ok: false, hata: hazir.hata });
    await bekle(800);

    olay(cagiran, { tur: 'ilerleme', asama: 'liste', mesaj: 'Sayım listesi okunuyor' });
    const liste = await sayimListesi(tabId, depo, bas, bit);
    if (!liste.ok) {
      return olay(cagiran, { tur: 'bitti', ok: !!liste.durduruldu, durduruldu: !!liste.durduruldu, hata: liste.hata });
    }

    const tamamlanan = liste.sayimlar.filter((s) => s.status === TAMAMLANDI);
    // Daha önce eksiksiz alınmış sayımlar (bilinen[id] === true) atlanır
    const hedefler = tamamlanan.filter((s) =>
      (otomatik || s.isAutoInventoryCheck !== true) && bilinen[s.id] !== true
    );
    const toplamGorev = hedefler.reduce((t, s) => t + (Number(s.totalTaskCount) || 0), 0);
    olay(cagiran, {
      tur: 'ilerleme', asama: 'gorev', yapilan: 0, toplam: toplamGorev,
      sayimSayisi: tamamlanan.length, yeniSayim: hedefler.length,
      mesaj: hedefler.length ? 'Sayım sonuçları okunuyor' : 'Yeni sayım yok',
    });

    // Bir sayım okunamazsa sessizce atlanmaz: sona bırakılır, ikinci turda yeniden
    // denenir; yine olmazsa kullanıcıya kaç sayımın eksik kaldığı söylenir.
    const okunan = new Set();      // okunmuş görev kimlikleri (ikinci turda tekrar istenmez)
    const durumSay = { ustUsteHata: 0 };

    async function sayimiOku(sayim) {
      const gl = await gorevListesi(tabId, depo, sayim);
      if (!gl.ok) {
        durumSay.ustUsteHata++;
        if (durumSay.ustUsteHata >= UST_USTE_HATA_SINIRI) throw new Error('Depo paneli yanıt vermiyor. Oturum düşmüş olabilir.');
        return { ok: false, kayitlar: [] };
      }
      durumSay.ustUsteHata = 0;
      const kayitlar = [];
      let eksik = 0;
      for (const gorev of gl.gorevler) {
        if (calisan.durdur) { eksik++; continue; }
        if (okunan.has(gorev.id)) continue;
        if (gorev.status !== TAMAMLANDI) { okunan.add(gorev.id); yapilan++; continue; }
        // Alışveriş poşetleri sayım geçmişinde istenmiyor; istek de atılmaz
        if (POSET.test(urunAdi(gorev.data) || '')) { okunan.add(gorev.id); yapilan++; continue; }
        await bekle(GOREV_ARASI_MS);
        const r = await israrla(tabId, {
          adres: gorevYolu(depo, sayim.id, sayim.job, gorev.id),
          // Panel görev detayını iş kimliğiyle istiyor (/<iş>/tasks/<görev>); görev kimliği tek başına yeter
          desen: `/tasks/${gorev.id}(?:\\?|$)`,
        });
        if (!r.ok) {
          eksik++;
          durumSay.ustUsteHata++;
          if (durumSay.ustUsteHata >= UST_USTE_HATA_SINIRI) throw new Error('Depo paneli yanıt vermiyor. Oturum düşmüş olabilir.');
          continue;
        }
        durumSay.ustUsteHata = 0;
        const k = kayitYap(sayim, gorev, r.veri && r.veri.data);
        okunan.add(gorev.id);
        yapilan++;
        if (k && !POSET.test(k.ad || '')) kayitlar.push(k);
        if (yapilan % 3 === 0) olay(cagiran, { tur: 'ilerleme', asama: 'gorev', yapilan, toplam: toplamGorev });
      }
      return { ok: eksik === 0, kayitlar };
    }

    const tekrar = [];
    for (const sayim of hedefler) {
      if (calisan.durdur) break;
      if (!KIMLIK.test(String(sayim.job || ''))) { tekrar.push(sayim); continue; }
      const r = await sayimiOku(sayim);
      kayitSayisi += r.kayitlar.length;
      olay(cagiran, { tur: 'parca', sayimId: sayim.id, tam: r.ok, kayitlar: r.kayitlar });
      if (!r.ok) tekrar.push(sayim);
      olay(cagiran, { tur: 'ilerleme', asama: 'gorev', yapilan, toplam: toplamGorev });
    }

    // İkinci tur: listeye dönüp okunamayanları yeniden dene (panel durumu sıfırlanır)
    let eksikSayim = 0;
    if (tekrar.length && !calisan.durdur) {
      olay(cagiran, { tur: 'ilerleme', asama: 'gorev', yapilan, toplam: toplamGorev, mesaj: tekrar.length + ' sayım yeniden deneniyor' });
      await bekle(1500);
      await israrla(tabId, {
        adres: listeYolu(depo, bas, bit, 1) + '&jb=' + Date.now(),
        desen: '/gstore-inventory-checks/filter',
      });
      for (const sayim of tekrar) {
        if (calisan.durdur) { eksikSayim++; continue; }
        if (!KIMLIK.test(String(sayim.job || ''))) { eksikSayim++; continue; }
        await bekle(LISTE_ARASI_MS);
        const r = await sayimiOku(sayim);
        kayitSayisi += r.kayitlar.length;
        olay(cagiran, { tur: 'parca', sayimId: sayim.id, tam: r.ok, kayitlar: r.kayitlar });
        if (!r.ok) eksikSayim++;
      }
    }

    olay(cagiran, {
      tur: 'bitti', ok: true, durduruldu: !!calisan.durdur,
      sayimSayisi: tamamlanan.length, yeniSayim: hedefler.length, kayitSayisi, eksikSayim,
    });
  } catch (e) {
    olay(cagiran, { tur: 'bitti', ok: false, hata: (e && e.message) || 'Sayım geçmişi alınamadı.', kayitSayisi });
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (e) { /* zaten kapalı */ } }
  }
}

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
  if (!istek || typeof istek.type !== 'string') return false;

  if (istek.type === 'JBA_SAYIM_GECMISI_DURDUR') {
    if (calisan) calisan.durdur = true;
    cevapla({ ok: true });
    return false;
  }

  if (istek.type !== 'JBA_SAYIM_GECMISI') return false;
  const cagiran = gonderen && gonderen.tab && gonderen.tab.id;
  if (!cagiran) { cevapla({ ok: false, hata: 'Çağıran sekme bulunamadı.' }); return false; }
  if (calisan) { cevapla({ ok: false, hata: 'Sayım geçmişi zaten alınıyor.' }); return false; }

  calisan = { durdur: false, cagiran };
  cevapla({ ok: true });
  calistir(istek, cagiran).finally(() => { calisan = null; });
  return false;
});

/* Günlük sayım (arka-plan/gunluk-sayim.js) panel okuma yardımcılarını ortak kullanır.
   Aynı anda tek iş: Sayım Geçmişi çalışıyorsa günlük sayım bekler. */
/** Gece işi: aralıktaki tamamlanmış sayımların ürün sonuçlarını toplar. */
async function sayimSonuclariniTopla({ depo, bas, bit, pencere }) {
  if (calisan) return { ok: false, hata: 'Sayım geçmişi zaten alınıyor.' };
  const kayitlar = [];
  let son = null;
  const topla = (v) => {
    if (v.tur === 'parca' && Array.isArray(v.kayitlar)) kayitlar.push(...v.kayitlar);
    else if (v.tur === 'bitti') son = v;
  };
  calisan = { durdur: false, cagiran: topla };
  try {
    await calistir({ warehouseId: depo, baslangic: bas, bitis: bit, otomatik: true, bilinen: {}, pencere }, topla);
  } finally {
    calisan = null;
  }
  return { ok: !!(son && son.ok), hata: son && son.hata, kayitlar };
}

globalThis.jbaSayimPanel = {
  sonuclariTopla: sayimSonuclariniTopla,
  mesgulMu: () => !!calisan,
  sekmeHazirBekle,
  sayimListesi,
  gorevListesi,
  israrla,
  listeYolu,
  gorevYolu,
  urunAdi,
  bekle,
};
