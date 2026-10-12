// Shared site chrome for every page: header and footer.
(function () {
  const logo = '<em>My</em>BTO';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `<div class="wrap bar">
      <a class="logo" href="/" aria-label="MyBTO home">${logo}</a>
    </div>`;
  document.body.prepend(header);

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
