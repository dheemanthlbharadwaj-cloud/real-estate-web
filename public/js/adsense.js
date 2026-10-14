// Google AdSense Auto ads. Google decides where ads go; formats and ad load are set in the AdSense dashboard
// (Ads > By site > mybto.web.app). Only runs on the live site, so local dev and tests never load ads.
// ADSENSE_CLIENT lives in js/config.js; leave it empty to switch AdSense off.
(function () {
  const client = (window.MYBTO_CONFIG || {}).ADSENSE_CLIENT;
  if (!client || location.hostname !== 'mybto.web.app') return;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(s);
})();
