// Google Analytics 4 (visitor counts and a few actions). Only runs on the live site, so local dev and tests never send data.
// GA_ID lives in js/config.js; leave it empty to switch analytics off. window.track(name, params) is always safe to call.
(function () {
  const id = (window.MYBTO_CONFIG || {}).GA_ID;
  window.dataLayer = window.dataLayer || [];
  const live = id && location.hostname === 'mybto.web.app';
  window.gtag = function () { if (live) window.dataLayer.push(arguments); };
  window.track = (name, params) => { try { window.gtag('event', name, params || {}); } catch { /* never break the page */ } };
  if (!live) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(s);
  window.gtag('js', new Date());
  window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href*="buymeacoffee.com"]');
    if (a) window.track('coffee_click');
  });
})();
