(function () {
  'use strict';

  if ((window.location.hostname || '') !== 'franchise.getir.com') return;

  var BTN_ID = 'getir-franchise-cdn-url-copy-btn';
  var CDN_MARK = 'cdn-image.getir.com';

  /**
   * .ant-table-tbody içindeki her veri satırı (tr) için bir ürün görseli — liste sırası = satır sırası.
   */
  function collectCdnImageUrls() {
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
        img =
          rows[r].querySelector('.ant-avatar-image img[src*="' + CDN_MARK + '"]') ||
          rows[r].querySelector('img[src*="' + CDN_MARK + '"]');
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

  function updateBtnMeta(btn) {
    var n = collectCdnImageUrls().length;
    btn.title = n
      ? n + ' satır — tablo gövdesi sırası (cdn görsel URL)'
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
      'display:inline-flex;align-items:center;gap:4px;margin-left:6px;vertical-align:middle;' +
      'position:relative;z-index:50;pointer-events:auto;';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.textContent = 'Barkodları kopyala';
    btn.setAttribute('aria-label', 'Tablodaki ürün görsel CDN adreslerini virgülle kopyala');

    var meta = document.createElement('span');
    meta.id = 'getir-franchise-cdn-meta';
    meta.style.cssText =
      'font-size:10px;opacity:.55;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    Object.assign(btn.style, {
      margin: '0',
      padding: '1px 6px',
      fontSize: '10px',
      lineHeight: '1.35',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.14)',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.85)',
      color: 'inherit',
      verticalAlign: 'middle',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      WebkitAppearance: 'none',
      appearance: 'none',
      position: 'relative',
      zIndex: '51',
      whiteSpace: 'nowrap'
    });

    function refreshMeta() {
      var urls = collectCdnImageUrls();
      meta.textContent = urls.length ? urls.length + ' URL' : '';
      updateBtnMeta(btn);
    }

    btn.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        var urls = collectCdnImageUrls();
      if (!urls.length) {
        window.alert(
          'Tabloda görsel URL bulunamadı.\n\n' +
            'Beklenen: sayfada .ant-table-tbody içinde ürün görseli (cdn-image.getir.com).\n' +
            'Liste yüklenene kadar bekle; çok sayfalı listede her sayfa için ayrı kopyala.'
        );
        return;
      }
      var csv = urls.join(', ');
      var label = btn.textContent;

      copyText(csv).then(
        function () {
          btn.textContent = 'Kopyalandı';
          toast(urls.length + ' URL panoda');
          setTimeout(function () {
            btn.textContent = label;
          }, 1600);
        },
        function () {
          if (copyExec(csv)) {
            btn.textContent = 'Kopyalandı';
            toast(urls.length + ' URL panoda');
            setTimeout(function () {
              btn.textContent = label;
            }, 1600);
          } else {
            showModal(csv);
            toast('Pano engelli — kutudan Cmd+C');
          }
        }
      );
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

    refreshMeta();
    var obs = new MutationObserver(function () {
      if (!document.getElementById(BTN_ID)) {
        insertButton();
        return;
      }
      refreshMeta();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function tryIns() {
      insertButton();
      if (!document.getElementById(BTN_ID)) {
        var o = new MutationObserver(function () {
          insertButton();
          if (document.getElementById(BTN_ID)) o.disconnect();
        });
        o.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function () {
          o.disconnect();
        }, 60000);
      }
    });
  } else {
    insertButton();
    if (!document.getElementById(BTN_ID)) {
      var o2 = new MutationObserver(function () {
        insertButton();
        if (document.getElementById(BTN_ID)) o2.disconnect();
      });
      o2.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
})();
