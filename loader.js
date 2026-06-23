(function () {
  'use strict';

  var MAX_MS = 2000;
  var hidden = false;

  var css =
    'body.site-loading{overflow:hidden}' +
    '.site-loader{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#030814;transition:opacity .35s ease,visibility .35s ease}' +
    '.site-loader.is-hidden{opacity:0;visibility:hidden;pointer-events:none}' +
    '.site-loader__inner{text-align:center;padding:24px}' +
    '.site-loader__rings{position:relative;width:72px;height:72px;margin:0 auto 18px}' +
    '.site-loader__rings span{position:absolute;inset:0;border-radius:50%;border:2px solid transparent}' +
    '.site-loader__rings span:nth-child(1){border-top-color:#0ea5e9;border-right-color:rgba(14,165,233,.35);animation:siteLoaderSpin .9s linear infinite}' +
    '.site-loader__rings span:nth-child(2){inset:10px;border-top-color:#6366f1;border-left-color:rgba(99,102,241,.35);animation:siteLoaderSpin 1.2s linear infinite reverse}' +
    '.site-loader__rings span:nth-child(3){inset:20px;border-bottom-color:#38bdf8;animation:siteLoaderSpin .75s linear infinite}' +
    '.site-loader__brand{font-family:Outfit,system-ui,sans-serif;font-size:1.35rem;font-weight:800;letter-spacing:.08em;background:linear-gradient(135deg,#7dd3fc,#a5b4fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:14px}' +
    '.site-loader__bar{width:160px;height:3px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:0 auto}' +
    '.site-loader__bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#0ea5e9,#6366f1);border-radius:999px;animation:siteLoaderBar 1.6s ease-out forwards}' +
    '@keyframes siteLoaderSpin{to{transform:rotate(360deg)}}' +
    '@keyframes siteLoaderBar{0%{width:0}100%{width:100%}}';

  if (!document.getElementById('site-loader-styles')) {
    var style = document.createElement('style');
    style.id = 'site-loader-styles';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function insertLoader() {
    if (document.getElementById('site-loader')) return;

    var loader = document.createElement('div');
    loader.id = 'site-loader';
    loader.className = 'site-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.setAttribute('aria-label', 'Loading Stackly');
    loader.innerHTML =
      '<div class="site-loader__inner">' +
        '<div class="site-loader__rings"><span></span><span></span><span></span></div>' +
        '<div class="site-loader__brand">STACKLY</div>' +
        '<div class="site-loader__bar"><span></span></div>' +
      '</div>';

    document.body.insertBefore(loader, document.body.firstChild);
    document.body.classList.add('site-loading');
  }

  function hideLoader() {
    if (hidden) return;
    hidden = true;

    var loader = document.getElementById('site-loader');
    if (!loader) {
      document.body.classList.remove('site-loading');
      return;
    }

    loader.classList.add('is-hidden');
    loader.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('site-loading');

    setTimeout(function () {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 380);
  }

  function boot() {
    insertLoader();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
    } else {
      requestAnimationFrame(hideLoader);
    }

    setTimeout(hideLoader, MAX_MS);
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
