// Shared site chrome for every page: header, footer, mobile menu, scroll effects.
(function () {
  const page = document.body.dataset.page || 'home';
  const overHero = document.body.hasAttribute('data-over-hero');
  const signedIn = (() => { try { return JSON.parse(localStorage.getItem('mybto:user')); } catch { return null; } })();
  const flags = (() => { try { return Number(localStorage.getItem('mybto:flagcount')) || 0; } catch { return 0; } })();
  const NAV = [
    ['/#projects', 'Projects', 'projects'],
    ['/rank', 'Rank units', 'rank'],
    ['/shortlist', 'Shortlist', 'shortlist'],
    ['/analysis', 'Insights', 'analysis'],
    ['/guide', 'How it works', 'guide'],
  ];
  const header = document.createElement('header');
  header.className = `site-header${overHero ? ' over-hero' : ' solid'}`;
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="/" aria-label="MyBTO home">My<b>BTO</b></a>
      <button class="menu-btn" aria-expanded="false" aria-controls="site-nav">MENU</button>
      <nav class="nav" id="site-nav" aria-label="Main">
        ${NAV.map(([href, label, key]) => `<a href="${href}"${key === page ? ' class="active" aria-current="page"' : ''}>${label}${key === 'shortlist' ? `<span class="count" id="flag-count">${flags}</span>` : ''}</a>`).join('')}
        <a href="/account" class="cta" id="account-link">${signedIn ? 'My account' : 'Sign in'}</a>
      </nav>
    </div>`;
  document.body.prepend(header);
  const btn = header.querySelector('.menu-btn'), nav = header.querySelector('.nav');
  btn.addEventListener('click', () => { const open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'CLOSE' : 'MENU'; header.classList.toggle('solid', open || !overHero || scrollY > 40); });

  if (overHero) {
    const onScroll = () => header.classList.toggle('solid', scrollY > 40 || nav.classList.contains('open'));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const year = 2026;
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap">
      <div class="top">
        <div><a class="logo" href="/">My<b>BTO</b></a>
          <p style="max-width:34ch;margin:18px 0 0">Every unit in the June 2026 BTO exercise, ranked by what matters to you — sun, height, privacy, convenience.</p></div>
        <div><h4>Explore</h4><ul><li><a href="/#projects">Projects</a></li><li><a href="/rank">Rank units</a></li><li><a href="/shortlist">Shortlist</a></li><li><a href="/analysis">Insights</a></li></ul></div>
        <div><h4>Learn</h4><ul><li><a href="/guide">How it works</a></li><li><a href="/guide#measures">What we measure</a></li><li><a href="https://homes.hdb.gov.sg" target="_blank" rel="noopener">HDB Homes ↗</a></li></ul></div>
        <div><h4>Account</h4><ul><li><a href="/account">${signedIn ? 'My account' : 'Sign in / sign up'}</a></li></ul></div>
      </div>
      <div class="fine"><span>© ${year} MyBTO · An independent student project, not affiliated with HDB.</span><span>Data: HDB June 2026 BTO sales brochures</span></div>
      <p class="credits">Project images are artist's impressions from HDB's June 2026 BTO sales brochures, © Housing &amp; Development Board, used for reference. Unit data is being verified; parts of the site currently show sample values.</p>
    </div>`;
  document.body.append(footer);

  // Reveal-on-scroll
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
  window.revealAll = root => (root || document).querySelectorAll('.reveal:not(.in)').forEach(el => (io ? io.observe(el) : el.classList.add('in')));
  window.revealAll();
  // Fallback: anything scrolled past (or above the fold) is shown even if the observer never fires.
  const sweep = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => { if (el.getBoundingClientRect().top < innerHeight * 1.05) el.classList.add('in'); });
  addEventListener('scroll', sweep, { passive: true });
  addEventListener('load', sweep);
  setTimeout(sweep, 400);

})();
