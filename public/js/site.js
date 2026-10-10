// Shared site chrome for every page: header, footer and mobile menu.
(function () {
  const page = document.body.dataset.page || 'home';
  const signedIn = (() => { try { return JSON.parse(localStorage.getItem('mybto:user')); } catch { return null; } })();
  const flags = (() => { try { return Number(localStorage.getItem('mybto:flagcount')) || 0; } catch { return 0; } })();
  const NAV = [
    ['/#projects', 'Projects', 'projects'],
    ['/rank', 'Rank units', 'rank'],
    ['/shortlist', 'Shortlist', 'shortlist'],
    ['/analysis', 'Insights', 'analysis'],
  ];
  const logo = '<em>My</em>BTO';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="/" aria-label="MyBTO home">${logo}</a>
      <button class="menu-btn" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="nav" id="site-nav" aria-label="Main">
        ${NAV.map(([href, label, key]) => `<a href="${href}"${key === page ? ' class="active" aria-current="page"' : ''}>${label}${key === 'shortlist' ? `<span class="count" id="flag-count">${flags}</span>` : ''}</a>`).join('')}
        <a href="/account" class="cta${page === 'account' ? ' active' : ''}" id="account-link">${signedIn ? 'My account' : 'Sign in'}</a>
      </nav>
    </div>`;
  document.body.prepend(header);
  const btn = header.querySelector('.menu-btn'), nav = header.querySelector('.nav');
  btn.addEventListener('click', () => { const open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; });

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap">
      <div class="top">
        <div><a class="logo" href="/">${logo}</a><p class="about">Every unit in this BTO exercise, ranked by what matters to you: sun, height, privacy and convenience.</p></div>
        <div><h4>Explore</h4><ul><li><a href="/#projects">Projects</a></li><li><a href="/rank">Rank units</a></li><li><a href="/shortlist">Shortlist</a></li><li><a href="/analysis">Insights</a></li></ul></div>
        <div><h4>More</h4><ul><li><a href="/rank?legend=sun">What each factor means</a></li><li><a href="/account">${signedIn ? 'My account' : 'Sign in or sign up'}</a></li><li><a href="https://homes.hdb.gov.sg" target="_blank" rel="noopener">HDB Homes ↗</a></li></ul></div>
      </div>
      <div class="fine"><span>© 2026 MyBTO. An independent student project, not affiliated with HDB.</span><span>Data: HDB BTO sales brochures</span></div>
      <p class="credits">Project images and drawings come from HDB's BTO sales brochures, © Housing &amp; Development Board, and are used for reference. Unit data is still being verified, so parts of the site show sample values.</p>
    </div>`;
  document.body.append(footer);

  window.revealAll = () => {};
})();
