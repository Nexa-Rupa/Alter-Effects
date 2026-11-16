/* Live review page boot: reads the inert JSON the server embedded (no inline script, strict CSP) and hands it to
   runtime.js, which then runs in live mode (media from source files, window.live player API). */
(function () {
  'use strict';
  const d = JSON.parse(document.getElementById('doc').textContent);
  window.__DOC = d.doc;
  window.__FRAMES = {};
  window.__LIVE = d.live;
})();
