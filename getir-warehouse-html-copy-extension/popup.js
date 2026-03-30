(function () {
    var manifest = chrome.runtime.getManifest();
    var verEl = document.getElementById('verLine');
    if (verEl) {
        verEl.textContent = 'Getir Warehouse HTML v' + manifest.version;
    }

    document.getElementById('autoRedirect').addEventListener('change', function (e) {
        chrome.storage.local.set({ getirAutoRedirect: e.target.checked });
    });

    chrome.storage.local.get('getirAutoRedirect', function (result) {
        document.getElementById('autoRedirect').checked =
            result.getirAutoRedirect === true || result.getirAutoRedirect === 'true';
    });

    document.getElementById('testStorage').addEventListener('click', function () {
        chrome.storage.local.set({ getirOrderHtml: '<div>TEST</div>' }).then(function () {
            alert(
                'Test kaydedildi. Service worker konsolunda:\nchrome.storage.local.get("getirOrderHtml", r => console.log(r))'
            );
        });
    });
})();
