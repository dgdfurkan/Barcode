/* global chrome */

function render() {
  chrome.storage.local.get(
    ['getirBarcodeCsv', 'getirBarcodeCount', 'getirBarcodeUpdated'],
    function (r) {
      const ta = document.getElementById('out');
      const meta = document.getElementById('meta');
      const csv = r.getirBarcodeCsv || '';
      ta.value = csv;

      const n = r.getirBarcodeCount;
      const ts = r.getirBarcodeUpdated;
      if (n && ts) {
        meta.textContent =
          n +
          ' barkod · ' +
          new Date(ts).toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
      } else {
        meta.textContent =
          'Liste henüz yakalanmadı. Stok sayfasında ürünler yüklensin veya filtre seç; ardından tekrar aç.';
      }
    }
  );
}

document.addEventListener('DOMContentLoaded', function () {
  render();

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes.getirBarcodeCsv || changes.getirBarcodeCount) render();
  });

  document.getElementById('copy').addEventListener('click', function () {
    const ta = document.getElementById('out');
    const text = ta.value || '';
    navigator.clipboard.writeText(text).then(
      function () {
        const btn = document.getElementById('copy');
        const prev = btn.textContent;
        btn.textContent = 'Kopyalandı';
        setTimeout(function () {
          btn.textContent = prev;
        }, 1500);
      },
      function () {
        ta.select();
        document.execCommand('copy');
      }
    );
  });
});
