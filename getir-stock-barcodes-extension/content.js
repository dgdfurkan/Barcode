(function () {
  'use strict';

  if ((window.location.hostname || '') !== 'franchise.getir.com') return;

  var BTN_ID = 'getir-franchise-cdn-url-copy-btn';
  var CDN_MARK = 'cdn-image.getir.com';

  /** Avatar sırası = liste sırası; aynı URL tekrar ederse de korunur. */
  function collectCdnImageUrls() {
    var out = [];
    var nodes = document.querySelectorAll('.ant-avatar-image img[src]');
    for (var i = 0; i < nodes.length; i++) {
      var src = (nodes[i].getAttribute('src') || '').trim();
      if (src.indexOf(CDN_MARK) !== -1) out.push(src);
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
    btn.title = n ? n + ' adet ' + CDN_MARK + ' görsel URL (DOM sırası)' : 'Sayfada liste/avatar yok veya henüz yüklenmedi';
  }

  function insertButton() {
    if (document.getElementById(BTN_ID)) return;

    var anchor =
      document.getElementById('BRING_BUTTON') ||
      document.querySelector('[class^="flexContainer-"] button.ant-btn-primary');
    if (!anchor || !anchor.parentNode) return;

    var wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px;vertical-align:middle;';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.textContent = "Görsel URL'leri kopyala";
    btn.setAttribute('aria-label', 'Ürün avatar görsellerinin CDN adreslerini virgülle kopyala');

    var meta = document.createElement('span');
    meta.id = 'getir-franchise-cdn-meta';
    meta.style.cssText = 'font-size:11px;opacity:.75;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    Object.assign(btn.style, {
      marginLeft: '8px',
      fontSize: '12px',
      lineHeight: '1.2',
      padding: '4px 10px',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.04)',
      color: 'inherit',
      verticalAlign: 'middle'
    });

    function refreshMeta() {
      var urls = collectCdnImageUrls();
      meta.textContent = urls.length ? urls.length + ' URL' : '';
      updateBtnMeta(btn);
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var urls = collectCdnImageUrls();
      if (!urls.length) {
        window.alert(
          'Hiç görsel URL bulunamadı.\n\n' +
            'Beklenen: .ant-avatar-image img[src*="cdn-image.getir.com"]\n' +
            'Liste yüklenene kadar bekle veya sayfayı kaydır.'
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
    });

    wrap.appendChild(btn);
    wrap.appendChild(meta);
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    refreshMeta();
    var obs = new MutationObserver(function () {
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
