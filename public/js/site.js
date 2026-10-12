// Shared site chrome for every page: header and footer.
(function () {
  const logo = '<em>My</em>BTO';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="/" aria-label="MyBTO home">${logo}</a>
      <nav class="tabs" aria-label="Main">
        <a class="tab" id="tab-rank" href="/">Rank units</a>
        <a class="tab" id="tab-analytics" href="/analytics"><span id="tab-analytics-name"></span> Analytics</a>
      </nav>
    </div>`;
  document.body.prepend(header);

  // Active tab from the path; the Analytics tab follows the project last picked (localStorage `project`, written by app.js).
  const path = location.pathname.replace(/\/$/, '');
  const active = ['', '/index', '/rank'].includes(path) ? 'rank' : path === '/analytics' ? 'analytics' : '';
  if (active) header.querySelector(`#tab-${active}`).setAttribute('aria-current', 'page');
  let projects = [];
  const storedProject = () => { try { return JSON.parse(localStorage.getItem('project')); } catch { return null; } };
  function setProject(key) {
    const p = projects.find(x => x.key === key) || projects[0];
    if (!p) return;
    header.querySelector('#tab-analytics-name').textContent = p.name;
    header.querySelector('#tab-analytics').href = `/analytics?project=${encodeURIComponent(p.key)}`;
  }
  window.addEventListener('mybto:project', e => setProject(e.detail));
  fetch('/data/units/index.json').then(r => r.json()).then(d => { projects = d.projects; setProject(storedProject()); }).catch(() => {});

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap">
      <div class="top">
        <div><a class="logo" href="/">${logo}</a><p class="about">Every unit in this BTO exercise, ranked your way.</p></div>
        <div><h4>Explore</h4><ul><li><a href="/">Rank units</a></li></ul></div>
        <div><h4>More</h4><ul><li><a href="/?legend=sun">What each factor means</a></li><li><a href="https://homes.hdb.gov.sg" target="_blank" rel="noopener">HDB Homes ↗</a></li></ul></div>
      </div>
      <div class="fine"><span>© 2026 MyBTO. An independent student project, not affiliated with HDB.</span><span>Data: HDB BTO sales brochures</span></div>
      <p class="credits">Project images and drawings come from HDB’s BTO sales brochures, © Housing &amp; Development Board, and are used for reference.</p>
    </div>`;
  document.body.append(footer);

  window.revealAll = () => {};
})();
