// Ads and consent, in one place. Everything here is a PLACEHOLDER: no third-party script is loaded.
//   MyBTOAds.interstitial()  -> Promise<string|null>   first "Rank units" in a browser session.
//                               Resolves with the consent time (ISO) once the person taps "Show my ranking", or null for "Not now".
//   MyBTOAds.rewarded(key)   -> Promise<boolean>        Analytics gate, once per project per browser session.
//                               Resolves true after the countdown and "Continue", false for "Back to Rank units".
// ONE SWITCH: window.MYBTO_CONFIG.ADS_ENABLED (js/config.js). Not true = ads are archived: interstitial() resolves at once with the
// consent time (rankings still save with consent) and rewarded() resolves true at once. All the ad code below is kept for later.
// To plug in a real ad network, replace the two functions in PROVIDERS below (search "PLUG IN").
// Countdowns are 5 s and 15 s; tests may shorten them with window.MYBTO_AD_SECONDS = { interstitial: 1, rewarded: 1 }.
(function () {
  const SECONDS = { interstitial: 5, rewarded: 15 };
  const seconds = kind => Number((window.MYBTO_AD_SECONDS || {})[kind] ?? SECONDS[kind]);

  // Session memory (sessionStorage, with an in-page fallback when storage is blocked).
  const mem = {};
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return mem[k] ?? null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { mem[k] = v; } },
  };

  // PLUG IN: the ad network goes here. Each provider fills `slot` (a 300x250 box, or a 16:9 box for video) and may call
  // unlock() to enable the button early (for example from a rewarded video "reward granted" callback).
  const PROVIDERS = {
    interstitial(slot) {
      slot.innerHTML = '<span class="ad-tag">Advertisement</span><div class="ad-fill"><b>Your ad here</b><span>300 x 250</span></div>';
    },
    rewarded(slot) {
      slot.innerHTML = '<span class="ad-tag">Advertisement</span><div class="ad-fill"><b>Video ad here</b><span>Placeholder video</span></div><i class="ad-bar"><b></b></i>';
    },
  };

  function modal({ kind, title, intro, slotClass, go, cancel }) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'modal';
      el.innerHTML = `<div class="modal-scrim"></div>
        <div class="modal-panel ad-panel" role="dialog" aria-modal="true" aria-labelledby="ad-title">
          <h2 class="h3" id="ad-title">${title}</h2>
          <p class="small muted">${intro}</p>
          <div class="ad-slot ${slotClass}" data-ad="${kind}" aria-label="Advertisement"></div>
          <div class="modal-btns"><button type="button" class="btn ghost" data-ad-cancel>${cancel}</button><button type="button" class="btn primary" data-ad-go disabled>${go}</button></div>
        </div>`;
      document.body.append(el);
      document.body.classList.add('drawer-open');
      const goBtn = el.querySelector('[data-ad-go]'), slot = el.querySelector('.ad-slot');
      const total = seconds(kind);
      let left = total, timer = null;
      const finish = value => { clearInterval(timer); el.remove(); document.body.classList.remove('drawer-open'); resolve(value); };
      const tick = () => {
        const bar = slot.querySelector('.ad-bar b');
        if (bar) bar.style.width = `${total ? Math.round(((total - left) / total) * 100) : 100}%`;
        if (left > 0) { goBtn.disabled = true; goBtn.textContent = `${go} in ${left}…`; left -= 1; return; }
        clearInterval(timer);
        goBtn.disabled = false;
        goBtn.textContent = go;
        goBtn.focus();
      };
      const unlock = () => { left = 0; tick(); };
      PROVIDERS[kind](slot, unlock);
      tick();
      if (goBtn.disabled) timer = setInterval(tick, 1000);
      goBtn.addEventListener('click', () => { if (!goBtn.disabled) finish(true); });
      el.querySelector('[data-ad-cancel]').addEventListener('click', () => finish(false));
    });
  }

  const adsOn = () => (window.MYBTO_CONFIG || {}).ADS_ENABLED === true;

  window.MyBTOAds = {
    async interstitial() {
      const seen = ss.get('mybto:ad-consent');
      if (seen) return seen;
      if (!adsOn()) { const now = new Date().toISOString(); ss.set('mybto:ad-consent', now); return now; }
      const ok = await modal({
        kind: 'interstitial', title: 'One moment before your ranking', intro: 'This free tool is supported by ads.',
        slotClass: 'ad-300', go: 'Show my ranking', cancel: 'Not now',
      });
      if (!ok) return null;
      const at = new Date().toISOString();
      ss.set('mybto:ad-consent', at);
      return at;
    },
    async rewarded(projectKey) {
      if (!adsOn()) return true;
      const key = `mybto:unlocked:${projectKey}`;
      if (ss.get(key)) return true;
      const ok = await modal({
        kind: 'rewarded', title: 'Watch a short video to open Analytics', intro: 'The video keeps this tool free. Analytics opens when the countdown ends.',
        slotClass: 'ad-video', go: 'Continue', cancel: 'Back to Rank units',
      });
      if (ok) ss.set(key, '1');
      return ok;
    },
  };
})();
