"""Generate the inner pages (rank, shortlist, analytics) from one shared shell.

Analytics is archived: it is written to public/archive/analytics.html (see ANALYTICS_ENABLED in public/js/config.js).

Run after editing a page body below:  python3 pipeline/build_pages.py
"""
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <title>{title} · MyBTO</title>
  <meta name="description" content="{desc}">{robots}{seo}
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/app.css">
</head>
<body data-page="{page}">
  <main>
    <section class="page-hero">
      <div class="wrap">
{kicker_html}        <h1 class="h1">{h1}</h1>
{lede_html}      </div>
    </section>
"""

FOOT = """  </main>
  <script src="/js/config.js"></script>
  <script src="/js/ga.js"></script>
  <script src="/js/site.js"></script>{extra}
  <script src="/js/scoring.js"></script>
  <script src="/js/legend.js"></script>
  <script src="/js/ads.js"></script>
  <script type="module" src="/js/app.js"></script>
</body>
</html>
"""

PAGES = {
    "rank": dict(
        title="Unofficial HDB BTO Flat Unit Ranker", img="garden-ridge.webp", kicker="", color="sky",
        h1="Unofficial HDB BTO Flat Unit Ranker",
        lede="",
        desc="Free, unofficial tool to rank every unit in a Singapore HDB BTO project by your own priorities: floor, facing, block, MRT distance and more. Shortlist your best units.",
        seo=True,
        body="""
    <section class="tool"><div class="wrap">
      <div class="desk">
        <aside class="rail" aria-label="Preferences">
          <div class="step">
            <div class="step-h"><h2>1. Project</h2></div>
            <select id="project" class="project-select" aria-label="Project"></select>
            <p id="project-meta" class="project-meta"></p>
          </div>
          <div class="step">
            <div class="step-h"><h2>2. Filters</h2></div>
            <div class="field"><span class="eyebrow">Housing type</span><div id="f-types" class="chips" role="radiogroup" aria-label="Housing type"></div></div>
            <div class="field"><span class="eyebrow">Blocks</span>
              <div class="mini-links"><button type="button" data-blocks="all">Select all</button><button type="button" data-blocks="none">Clear</button></div>
              <div id="f-blocks" class="chips"></div>
            </div>
            <div class="field"><span class="eyebrow">Storey range</span>
              <div class="storey-pair"><select id="f-min" aria-label="Minimum storey"></select><span class="muted">to</span><select id="f-max" aria-label="Maximum storey"></select></div>
            </div>
            <div class="field"><span class="eyebrow">Prioritise floors</span>
              <div class="chips" id="f-pref" role="radiogroup">
                <label class="chip"><input type="radio" name="pref" value="none"><span>No preference</span></label>
                <label class="chip"><input type="radio" name="pref" value="higher" checked><span>Higher</span></label>
                <label class="chip"><input type="radio" name="pref" value="lower"><span>Lower</span></label>
              </div>
            </div>
          </div>
          <div class="step">
            <div class="step-h"><h2>3. Importance of factors</h2></div>
            <p class="small muted" style="margin:-6px 0 0">Use the slider to rate each factor from minus 5 (avoid) to plus 5 (must have). Rating every factor gives the best results. Tap ? to see what a factor means.</p>
            <div id="weights"></div>
            <p id="hidden-factors" class="hidden-note"></p>
          </div>
          <button id="btn-rank" class="btn primary">Rank units <span class="arr">→</span></button>
          <button type="button" class="btn ghost legend-open" data-legend="sun">What these factors mean</button>
        </aside>
        <div class="results-card">
          <div class="sched-head">
            <div><span class="eyebrow">Matching units</span><div class="count" id="result-count">0<small>units</small></div><p id="top-note" class="small muted top-note"></p></div>
            <div class="spacer"></div>
            <div id="after-rank" class="after-rank" hidden>
              <a id="btn-shortlisted" class="btn" href="/shortlist" target="_blank" rel="noopener"><span class="star-ico" aria-hidden="true">★</span> Shortlisted <span class="count" id="flag-count">0</span></a>
              <a id="btn-analytics" class="btn primary" href="/archive/analytics" target="_blank" rel="noopener"><span id="analytics-name">Project</span> Analytics</a>
            </div>
          </div>
          <p id="save-msg" class="save-msg" aria-live="polite"></p>
          <div class="fg-wrap">
            <div class="fg-intro"><span class="eyebrow">By floor</span><p class="small muted">Units from your top 100 on the highest, middlemost and lowest storeys among them (the middle two if there’s an even number).</p></div>
            <div id="floor-groups" class="floor-groups" hidden></div>
          </div>
          <div class="table-wrap"><table class="schedule" id="results"><thead></thead><tbody></tbody></table></div>
          <div id="support" class="support-card" hidden>
            <div><h3>Help keep MyBTO free</h3><p class="small muted">Helping you find your dream home takes a lot of coffee! If MyBTO made your selection easier, consider buying us a Kopi to help fuel the next BTO launch ☕</p></div>
            <a class="btn primary" href="https://buymeacoffee.com/mybto" target="_blank" rel="noopener">Buy me a coffee ☕</a>
          </div>
        </div>
      </div>
    </div></section>
    <aside id="legend-drawer" class="drawer" hidden aria-label="What each factor means">
      <div class="drawer-scrim" data-close-legend></div>
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="legend-title">
        <div class="drawer-head"><h2 class="h3" id="legend-title">What each factor means</h2><button type="button" class="btn ghost" data-close-legend>Close</button></div>
        <div class="drawer-body"><div id="legend"></div></div>
      </div>
    </aside>
"""),
    "shortlist": dict(
        title="Shortlist", img="garden-portico.webp", kicker="Your shortlist", color="butter",
        h1="The homes you’d <em>pick first.</em>",
        lede="The units you starred, in the order you’d pick them. Drag to reorder.", robots=True,
        desc="Your ordered shortlist of BTO units.",
        body="""
    <section class="tool"><div class="wrap">
      <div id="shared-banner" class="shared-banner" hidden>
        <p class="shared-title">Shared shortlist for <span id="shared-name"></span></p>
        <p class="small muted">You are looking at someone else’s list. Your own shortlist is not changed unless you save this one.</p>
        <div class="shared-btns"><button type="button" class="btn primary" id="btn-save-shared">Save as my shortlist</button><button type="button" class="btn ghost" id="btn-back-mine">Back to my shortlist</button></div>
      </div>
      <div class="picker-row" id="picker-row"><span class="eyebrow">Project</span><select id="project" aria-label="Project"></select><a class="btn ghost" href="/">Add more units <span class="arr">→</span></a></div>
      <div class="sl-tools" id="sl-tools" hidden>
        <button type="button" class="btn" id="btn-share">Share shortlist</button>
        <button type="button" class="btn ghost" id="btn-clear">Clear all</button>
        <span id="sl-msg" class="small muted" aria-live="polite"></span>
      </div>
      <p id="rank-note" class="small muted rank-note"></p>
      <ol id="flag-list" class="shortlist"></ol>
    </div></section>
"""),
    "analytics": dict(
        out="archive/analytics.html",         title="Analytics", img="garden-brook.webp", kicker="", color="forest",
        h1="<span id=\"analytics-name\"></span> Analytics",
        lede="", robots=True,
        desc="Combined results from MyBTO rankings: preferred floors, facings, blocks and factors.",
        extra='\n  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" integrity="sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4" crossorigin="anonymous"></script>',
        body="""
    <section class="tool"><div class="wrap">
      <div id="analysis-body" hidden>
        <p id="a-basis" class="basis"></p>
        <div class="dash">
          <div class="half">
            <div class="kpis">
              <div class="kpi" id="k-rankings"><div class="kpi-title">Rankings</div><b class="kpi-num">-</b><span class="kpi-sub"></span></div>
              <div class="kpi" id="k-min"><div class="kpi-title">Typical lowest floor</div><b class="kpi-num">-</b><span class="kpi-sub"></span></div>
            </div>
            <div class="card" id="card-storey"><h3>Lowest and highest storey</h3><div class="plot tall"><canvas id="c-storey"></canvas></div></div>
          </div>
          <div class="half">
            <div class="kpis">
              <div class="kpi" id="k-max"><div class="kpi-title">Typical highest floor</div><b class="kpi-num">-</b><span class="kpi-sub"></span></div>
              <div class="kpi kpi-pref" id="k-pref"><div class="kpi-title">Floor preference</div><div class="pref-body"><ul class="swatches" id="pref-legend"></ul><div class="pref-plot"><canvas id="c-pref"></canvas></div></div></div>
            </div>
            <div class="card" id="card-sun"><h3>Most wanted sun direction</h3><div class="plot tall"><canvas id="c-sun"></canvas></div></div>
          </div>
        </div>
        <div class="ins-row" id="ins-1"></div>
        <div class="grid2">
          <div class="card" id="card-block"><h3>Blocks</h3><div class="plot" id="p-block"><canvas id="c-block"></canvas></div></div>
          <div class="card" id="card-factor"><h3>Factors, average importance</h3><div class="plot" id="p-factor"><canvas id="c-factor"></canvas></div></div>
        </div>
        <div class="ins-row" id="ins-2"></div>
        <div class="grid2">
          <div class="card" id="card-facility"><h3>Facilities, top 10 most wanted</h3><div class="plot" id="p-facility"><canvas id="c-facility"></canvas></div></div>
          <div class="card" id="card-types"><h3>Housing types</h3><div class="plot"><canvas id="c-types"></canvas></div></div>
        </div>
      </div>
    </div></section>
"""),
}


SITE = "https://mybto.web.app"
SEO = """
  <link rel="canonical" href="{site}/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MyBTO">
  <meta property="og:title" content="{title} · MyBTO">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{site}/">
  <meta property="og:image" content="{site}/img/og-mybto.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title} · MyBTO">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{site}/img/og-mybto.jpg">
  <script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebApplication","name":"MyBTO","url":"{site}/","applicationCategory":"UtilitiesApplication","operatingSystem":"Any","description":"{desc}","offers":{{"@type":"Offer","price":"0","priceCurrency":"SGD"}}}}</script>"""


def copy_analytics_core():
    """public/js/analytics-core.js is a generated copy of apps-script/Analytics.js (used by the pre-launch sample Analytics)."""
    src = (PUBLIC.parent / "apps-script" / "Analytics.js").read_text()
    (PUBLIC / "js" / "analytics-core.js").write_text("// GENERATED by pipeline/build_pages.py from apps-script/Analytics.js. Do not edit.\n" + src)


def main():
    copy_analytics_core()
    for page, p in PAGES.items():
        kicker_html = f'        <span class="label">{p["kicker"]}</span>\n' if p["kicker"] else ""
        robots = '\n  <meta name="robots" content="noindex">' if p.get("robots") else ""
        seo = SEO.format(site=SITE, title=p["title"], desc=p["desc"]) if p.get("seo") else ""
        lede_html = f'        <p>{p["lede"]}</p>\n' if p["lede"] else ""
        html = HEAD.format(page=page, kicker_html=kicker_html, robots=robots, seo=seo, lede_html=lede_html, **{k: p[k] for k in ("title", "desc", "img", "h1", "color")}) + p["body"] + FOOT.format(extra=p.get("extra", ""))
        (PUBLIC / p.get("out", f"{page}.html")).write_text(html)
        print("wrote", page)
        if page == "rank":  # the ranking page is also the home page; the old home page lives at /archive/home
            (PUBLIC / "index.html").write_text(html)
            print("wrote index (rank)")


if __name__ == "__main__":
    main()
