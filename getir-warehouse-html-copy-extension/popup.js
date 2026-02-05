document.getElementById('autoRedirect').addEventListener('change', (e) => {
    chrome.storage.local.set({ getirAutoRedirect: e.target.checked });
});

chrome.storage.local.get('getirAutoRedirect', (result) => {
    document.getElementById('autoRedirect').checked = result.getirAutoRedirect === true || result.getirAutoRedirect === 'true';
});
