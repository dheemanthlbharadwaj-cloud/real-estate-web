// Shared site chrome for every page: header and footer.
(function () {
  const logo = '<em>My</em>BTO';
  // The Analytics tab is archived: it shows only when window.MYBTO_CONFIG.ANALYTICS_ENABLED is true (public/js/config.js).
  const analyticsOn = (window.MYBTO_CONFIG || {}).ANALYTICS_ENABLED === true;

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="/" aria-label="MyBTO home">${logo}</a>
      <nav class="tabs" aria-label="Main">
        <a class="tab" id="tab-rank" href="/?rank=1">Rank units</a>
        ${analyticsOn ? '<a class="tab" id="tab-analytics" href="/archive/analytics"><span id="tab-analytics-name"></span> Analytics</a>' : ''}
      </nav>
    </div>`;
  document.body.prepend(header);

  // Active tab from the path; the Analytics tab follows the project last picked (localStorage `project`, written by app.js).
  const path = location.pathname.replace(/\/$/, '');
  const active = ['', '/index', '/rank'].includes(path) ? 'rank' : path === '/archive/analytics' ? 'analytics' : '';
  if (active && header.querySelector(`#tab-${active}`)) header.querySelector(`#tab-${active}`).setAttribute('aria-current', 'page');
  let projects = [];
  const storedProject = () => { try { return JSON.parse(localStorage.getItem('project')); } catch { return null; } };
  function setProject(key) {
    const p = projects.find(x => x.key === key) || projects[0];
    if (!p) return;
    if (!analyticsOn) return;
    header.querySelector('#tab-analytics-name').textContent = p.name;
    header.querySelector('#tab-analytics').href = `/archive/analytics?project=${encodeURIComponent(p.key)}`;
  }
  window.addEventListener('mybto:project', e => setProject(e.detail));
  fetch('/data/units/index.json').then(r => r.json()).then(d => { projects = d.projects; setProject(storedProject()); }).catch(() => {});

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap">
      <p class="credits">An independent student project, not affiliated with HDB. Project images and drawings come from HDB’s BTO sales brochures, © Housing &amp; Development Board, and are used for reference. Visits are counted with Google Analytics. <a href="/privacy">Privacy policy</a></p>
    </div>`;
  document.body.append(footer);

  window.revealAll = () => {};
})();
