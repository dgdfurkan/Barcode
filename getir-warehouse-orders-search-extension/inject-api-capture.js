(function () {
  'use strict';
  if (!window.location.pathname.includes('/dashboard/orders')) return;

  var script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject-page.js');
  script.onload = function () { script.remove(); };
  (document.head || document.documentElement).appendChild(script);
})();
