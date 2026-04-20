(function () {
  'use strict';

  if ((window.location.hostname || '') !== 'franchise.getir.com') return;

  var BTN_ID = 'getir-franchise-cdn-url-copy-btn';
  var BTN_LABEL_DEFAULT = 'Barkodları kopyala';

  function isGetirProductImageSrc(src) {
    if (!src || src.indexOf('http') !== 0) return false;
    if (src.indexOf('cdn-image.getir.com/market/product') !== -1) return true;
    if (src.indexOf('cdn.getir.com/product') !== -1) return true;
    // Franchise tablosunda sık: depo/ERP’den yüklenen ürün görselleri (uuid’li dosya adı)
    if (src.indexOf('vsrm-cdn.erp.getirapi.com/docs/') !== -1) return true;
    return false;
  }

  /**
   * Satırdaki ürün görseli: market CDN, eski product CDN ve ERP (vsrm-cdn…) host’ları desteklenir.
   */
  function pickProductImgFromRow(tr) {
    if (!tr || tr.classList.contains('ant-table-measure-row')) return null;
    var imgs = tr.querySelectorAll('img[src]');
    var i;
    var src;
    for (i = 0; i < imgs.length; i++) {
      src = (imgs[i].getAttribute('src') || '').trim();
      if (isGetirProductImageSrc(src)) return imgs[i];
    }
    return null;
  }

  /** thead’den “Stok” ve “Statü” sütun indeksleri (satır filtreleri için). */
  function resolveStockAndStatusColumnIndexes() {
    var ths = document.querySelectorAll('.ant-table-thead th.ant-table-cell');
    var stockIdx = -1;
    var statIdx = -1;
    var i;
    var t;
    for (i = 0; i < ths.length; i++) {
      t = (ths[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t === 'Stok') stockIdx = i;
      if (t === 'Statü' || t === 'Statu') statIdx = i;
    }
    return { stockIdx: stockIdx, statIdx: statIdx };
  }

  function shouldSkipRowForFilters(tr, opts, colIdx) {
    if (!tr || tr.classList.contains('ant-table-measure-row')) return true;
    var cells = tr.querySelectorAll('td');
    if (!cells.length) return true;

    if (opts.skipInactive && colIdx.statIdx >= 0 && cells[colIdx.statIdx]) {
      var stText = (cells[colIdx.statIdx].textContent || '').trim();
      if (stText.indexOf('İnaktif') !== -1 || stText.indexOf('Inaktif') !== -1) {
        return true;
      }
    }

    if (opts.skipZeroStock && colIdx.stockIdx >= 0 && cells[colIdx.stockIdx]) {
      var raw = (cells[colIdx.stockIdx].textContent || '').trim();
      var numPart = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
      var n = parseFloat(numPart);
      if (raw === '' || raw === '-' || (numPart !== '' && !isNaN(n) && n === 0)) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {{ skipInactive?: boolean, skipZeroStock?: boolean }} opts
   */
  function collectCdnImageUrls(opts) {
    opts = opts || {};
    var skipInactive = opts.skipInactive === true;
    var skipZeroStock = opts.skipZeroStock === true;

    var colIdx = { stockIdx: -1, statIdx: -1 };
    if (skipInactive || skipZeroStock) {
      colIdx = resolveStockAndStatusColumnIndexes();
    }

    var out = [];
    var tbodies = document.querySelectorAll('.ant-table-tbody');
    var t;
    var r;
    var rows;
    var img;
    var src;

    for (t = 0; t < tbodies.length; t++) {
      rows = tbodies[t].querySelectorAll(':scope > tr');
      for (r = 0; r < rows.length; r++) {
        if (
          skipInactive ||
          skipZeroStock
        ) {
          if (
            shouldSkipRowForFilters(rows[r], { skipInactive: skipInactive, skipZeroStock: skipZeroStock }, colIdx)
          ) {
            continue;
          }
        } else if (rows[r].classList.contains('ant-table-measure-row')) {
          continue;
        }

        img = pickProductImgFromRow(rows[r]);
        if (!img) continue;
        src = (img.getAttribute('src') || '').trim();
        if (src) out.push(src);
      }
    }

    return out;
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui,sans-serif;max-width:360px;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  function showModal(text) {
    var old = document.getElementById('getir-cdn-url-modal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'getir-cdn-url-modal';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;';
    var box = document.createElement('div');
    box.style.cssText =
      'background:#fff;color:#111;border-radius:10px;max-width:94vw;width:600px;box-shadow:0 8px 32px rgba(0,0,0,.25);padding:16px;font:14px system-ui,sans-serif;';
    var p = document.createElement('p');
    p.style.margin = '0 0 8px';
    p.textContent = 'URL’ler (Cmd+C / Ctrl+C):';
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'width:100%;height:200px;font-size:11px;box-sizing:border-box;padding:8px;margin:0 0 12px;';
    var row = document.createElement('div');
    row.style.textAlign = 'right';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Kapat';
    closeBtn.style.cssText = 'padding:8px 18px;cursor:pointer;border-radius:6px;border:1px solid #ccc;background:#f5f5f5;';
    closeBtn.onclick = function () {
      wrap.remove();
    };
    row.appendChild(closeBtn);
    box.appendChild(p);
    box.appendChild(ta);
    box.appendChild(row);
    wrap.appendChild(box);
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) wrap.remove();
    });
    document.body.appendChild(wrap);
    setTimeout(function () {
      ta.focus();
      ta.select();
    }, 0);
  }

  /** Kopyalamadan önce: inaktif / sıfır stok satırlarını isteğe bağlı ele. */
  function showCopyOptionsModal(onConfirm) {
    var old = document.getElementById('getir-franchise-copy-options-modal');
    if (old) old.remove();

    var wrap = document.createElement('div');
    wrap.id = 'getir-franchise-copy-options-modal';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;';

    var box = document.createElement('div');
    box.style.cssText =
      'background:#fff;color:#111;border-radius:10px;max-width:92vw;width:380px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:16px 18px;font:14px system-ui,-apple-system,sans-serif;';

    var h = document.createElement('div');
    h.textContent = 'Kopyalama seçenekleri';
    h.style.cssText = 'font-weight:600;margin:0 0 12px;font-size:15px;';

    var hint = document.createElement('p');
    hint.textContent =
      'Aşağıdakileri işaretlersen ilgili satırlar panoya alınmaz. Varsayılan: tüm satırlar kopyalanır. Üstteki ürün sayısı tüm listeyi gösterebilir; kopyalama yalnızca şu an tabloda görünen sayfadaki satırlar içindir (diğer sayfalar için sayfa değiştirip tekrar kopyala).';
    hint.style.cssText = 'margin:0 0 14px;font-size:12px;line-height:1.45;opacity:.85;';

    function rowCheckbox(id, label) {
      var lab = document.createElement('label');
      lab.style.cssText =
        'display:flex;align-items:flex-start;gap:10px;margin:0 0 10px;cursor:pointer;font-size:13px;line-height:1.4;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = false;
      cb.style.marginTop = '2px';
      var span = document.createElement('span');
      span.textContent = label;
      lab.appendChild(cb);
      lab.appendChild(span);
      return { wrap: lab, input: cb };
    }

    var inactiveRow = rowCheckbox('getir-copy-opt-inactive', 'İnaktifleri kopyalama (Statü: İnaktif satırlar çıkarılır)');
    var stockRow = rowCheckbox('getir-copy-opt-zerostock', 'Stokta olmayanları kopyalama (Stok = 0 satırlar çıkarılır)');

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';

    var btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = 'İptal';
    btnCancel.style.cssText =
      'padding:8px 16px;cursor:pointer;border-radius:6px;border:1px solid #ccc;background:#f5f5f5;font-size:13px;';

    var btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.textContent = 'Kopyala';
    btnOk.style.cssText =
      'padding:8px 18px;cursor:pointer;border-radius:6px;border:none;background:#1677ff;color:#fff;font-size:13px;';

    function close() {
      wrap.remove();
    }

    btnCancel.onclick = close;
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) close();
    });

    btnOk.onclick = function () {
      onConfirm({
        skipInactive: inactiveRow.input.checked === true,
        skipZeroStock: stockRow.input.checked === true,
      });
      close();
    };

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);

    box.appendChild(h);
    box.appendChild(hint);
    box.appendChild(inactiveRow.wrap);
    box.appendChild(stockRow.wrap);
    box.appendChild(btnRow);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard'));
  }

  function copyExec(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:2px;height:2px;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    return ok;
  }

  function runCopyWithUrls(btn, urls) {
    if (!urls.length) {
      window.alert(
        'Seçeneklere göre kopyalanacak satır kalmadı veya tabloda ürün görseli yok.\n\n' +
          'Tablo yüklenene kadar bekle; çok sayfalı listede her sayfa için ayrı kopyala.'
      );
      return;
    }
    var csv = urls.join(', ');

    copyText(csv).then(
      function () {
        btn.textContent = 'Kopyalandı';
        toast(urls.length + ' URL panoda');
        setTimeout(function () {
          btn.textContent = BTN_LABEL_DEFAULT;
        }, 1600);
      },
      function () {
        if (copyExec(csv)) {
          btn.textContent = 'Kopyalandı';
          toast(urls.length + ' URL panoda');
          setTimeout(function () {
            btn.textContent = BTN_LABEL_DEFAULT;
          }, 1600);
        } else {
          showModal(csv);
          toast('Pano engelli — kutudan Cmd+C');
        }
      }
    );
  }

  function updateBtnMeta(btn, n) {
    btn.title = n
      ? n +
          ' URL — yalnızca şu an ekrandaki sayfa satırları (rozet “toplam ürün” tüm liste olabilir; sayfa 2 vb. için ayrı kopyala)'
      : 'Tabloda satır/görsel yok';
  }

  function findToolbarAnchor() {
    var badge = document.querySelector('[class*="totalBadge"]');
    if (badge && badge.parentNode) {
      return { parent: badge.parentNode, before: badge.nextSibling };
    }
    var left = document.querySelector('[class*="leftContainer"]');
    if (left) {
      return { parent: left, before: null };
    }
    var bring = document.getElementById('BRING_BUTTON');
    if (bring && bring.parentNode) {
      return { parent: bring.parentNode, before: bring.nextSibling };
    }
    var flex = document.querySelector('[class*="flexContainer-"] button.ant-btn-primary');
    if (flex && flex.parentNode) {
      return { parent: flex.parentNode, before: flex.nextSibling };
    }
    return null;
  }

  function insertButton() {
    if (document.getElementById(BTN_ID)) return;

    var place = findToolbarAnchor();
    if (!place) return;

    var wrap = document.createElement('span');
    wrap.id = 'getir-franchise-cdn-wrap';
    wrap.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle;';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.textContent = BTN_LABEL_DEFAULT;
    btn.setAttribute('aria-label', 'Tablodaki ürün görsel adreslerini virgülle kopyala');

    var meta = document.createElement('span');
    meta.id = 'getir-franchise-cdn-meta';
    meta.style.cssText =
      'font-size:10px;opacity:.55;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    Object.assign(btn.style, {
      margin: '0',
      padding: '1px 6px',
      fontSize: '10px',
      lineHeight: '1.35',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.14)',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.9)',
      color: 'inherit',
      verticalAlign: 'middle',
      boxSizing: 'border-box',
      WebkitAppearance: 'none',
      appearance: 'none',
      whiteSpace: 'nowrap',
    });

    function refreshMetaLight() {
      var urls = collectCdnImageUrls({});
      meta.textContent = urls.length ? urls.length + ' URL (sayfa)' : '';
      updateBtnMeta(btn, urls.length);
    }

    btn.addEventListener('mouseenter', refreshMetaLight, { passive: true });

    btn.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        refreshMetaLight();
        showCopyOptionsModal(function (opts) {
          var urls = collectCdnImageUrls(opts);
          if (!urls.length) {
            var totalAny = collectCdnImageUrls({}).length;
            if (totalAny > 0) {
              window.alert(
                'Seçeneklere göre kopyalanacak satır kalmadı (tüm satırlar filtrelendi).\n\n' +
                  'Filtreleri kapatıp tekrar dene.'
              );
            } else {
              window.alert(
                'Tabloda ürün görsel URL bulunamadı.\n\n' +
                  'Desteklenen host’lar: cdn-image.getir.com/market/product, cdn.getir.com/product, vsrm-cdn.erp.getirapi.com/docs.\n' +
                  'Liste yüklenene kadar bekle; çok sayfalı listede her sayfa için ayrı kopyala.'
              );
            }
            return;
          }
          runCopyWithUrls(btn, urls);
        });
      },
      false
    );

    wrap.appendChild(btn);
    wrap.appendChild(meta);
    if (place.before) {
      place.parent.insertBefore(wrap, place.before);
    } else {
      place.parent.appendChild(wrap);
    }

    refreshMetaLight();
  }

  /** Ağır MutationObserver yok — sadece seyrek deneme (SPA geç yüklenirse). */
  function tryInsertUntilFound() {
    var n = 0;
    var id = setInterval(function () {
      n++;
      insertButton();
      if (document.getElementById(BTN_ID) || n >= 40) {
        clearInterval(id);
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      insertButton();
      if (!document.getElementById(BTN_ID)) tryInsertUntilFound();
    });
  } else {
    insertButton();
    if (!document.getElementById(BTN_ID)) tryInsertUntilFound();
  }
})();
