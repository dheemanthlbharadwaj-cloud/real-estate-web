"""Generate the inner pages (rank, shortlist, analysis, account) from one shared shell.

Run after editing a page body below:  python3 pipeline/build_pages.py
"""
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} · MyBTO</title>
  <meta name="description" content="{desc}">
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Instrument+Serif:ital@0;1&family=Albert+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/app.css">
</head>
<body data-page="{page}">
  <main>
    <section class="page-hero c-{color}">
      <div class="ph-grid">
        <div class="copy">
          <span class="label">{kicker}</span>
          <h1 class="h1">{h1}</h1>
          <p>{lede}</p>
          <div class="sample-note" id="sample-note" hidden><b>SAMPLE DATA</b><span id="sample-text"></span></div>
        </div>
        <div class="media"><img src="/img/{img}" alt=""></div>
      </div>
    </section>
"""

FOOT = """  </main>
  <script src="/js/site.js"></script>{extra}
  <script src="/js/scoring.js"></script>
  <script src="/js/legend.js"></script>
  <script type="module" src="/js/app.js"></script>
</body>
</html>
"""

PAGES = {
    "rank": dict(
        title="Rank units", img="garden-ridge.webp", kicker="Rank units", color="sky",
        h1="Every unit, <i>ranked</i> for you.",
        lede="Choose a project, narrow it to the units you would consider, then weigh each factor from minus 5 (avoid) to plus 5 (must have).",
        desc="Rank every unit of a BTO project by your own priorities.",
        body="""
    <section class="tool"><div class="wrap">
      <div class="desk">
        <aside class="rail" aria-label="Preferences">
          <div class="step">
            <div class="step-h"><span class="n">i.</span><h2>Project</h2></div>
            <select id="project" class="project-select" aria-label="Project"></select>
            <p id="project-meta" class="project-meta"></p>
          </div>
          <div class="step">
            <div class="step-h"><span class="n">ii.</span><h2>Filters</h2></div>
            <div class="field"><span class="eyebrow">Unit type</span><div id="f-types" class="chips"></div></div>
            <div class="field"><span class="eyebrow">Blocks</span>
              <div class="mini-links"><button type="button" data-blocks="all">Select all</button><button type="button" data-blocks="none">Clear</button></div>
              <div id="f-blocks" class="chips"></div>
            </div>
            <div class="field"><span class="eyebrow">Storey range</span>
              <div class="storey-pair"><select id="f-min" aria-label="Minimum storey"></select><span class="muted">to</span><select id="f-max" aria-label="Maximum storey"></select></div>
            </div>
            <div class="field"><span class="eyebrow">Prioritise floors</span>
              <div class="chips" id="f-pref" role="radiogroup">
                <label class="chip"><input type="radio" name="pref" value="none" checked><span>No preference</span></label>
                <label class="chip"><input type="radio" name="pref" value="higher"><span>Higher</span></label>
                <label class="chip"><input type="radio" name="pref" value="middle"><span>Middle</span></label>
                <label class="chip"><input type="radio" name="pref" value="lower"><span>Lower</span></label>
              </div>
            </div>
            <label class="toggle"><input type="checkbox" id="f-opposite">
              <span><b>Privacy: opposite unit &gt; 30 m away</b><span class="small muted">Only show units whose windows face nothing closer than 30 m.</span></span></label>
          </div>
          <div class="step">
            <div class="step-h"><span class="n">iii.</span><h2>Importance</h2></div>
            <p class="small muted" style="margin:-6px 0 0">Minus 5 means avoid, 0 means you don't mind, plus 5 means must have. Only factors found in your selected blocks are shown. Tap ? to see what a factor means.</p>
            <div id="weights"></div>
            <p id="hidden-factors" class="hidden-note"></p>
          </div>
          <button id="btn-rank" class="btn primary">Rank units <span class="arr">→</span></button>
          <button type="button" class="btn ghost legend-open" data-legend="sun">What these factors mean</button>
        </aside>
        <div>
          <div class="sched-head">
            <div><span class="eyebrow">Matching units</span><div class="count" id="result-count">0<small>units</small></div></div>
            <div class="spacer"></div>
            <div class="queue"><span class="eyebrow">Queue no.</span><input id="queue" type="text" inputmode="numeric" placeholder="e.g. 1234" aria-label="Queue number"></div>
            <button id="btn-save" class="btn primary">Save list</button>
            <button id="btn-csv" class="btn ghost">CSV</button>
          </div>
          <p id="save-msg" class="save-msg" aria-live="polite"></p>
          <div class="table-wrap"><table class="schedule" id="results"><thead></thead><tbody></tbody></table></div>
          <div class="more"><button id="btn-more" class="btn ghost" hidden>Show 100 more</button></div>
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
        h1="The homes you'd <i>pick first.</i>",
        lede="The units you starred, in the order you would choose them on selection day. Drag to reorder. It is saved to your account when you are signed in.",
        desc="Your ordered shortlist of BTO units.",
        body="""
    <section class="tool"><div class="wrap">
      <div class="picker-row"><span class="eyebrow">Project</span><select id="project" aria-label="Project"></select><a class="btn ghost" href="/rank">Add more units <span class="arr">→</span></a></div>
      <ol id="flag-list" class="shortlist"></ol>
    </div></section>
"""),
    "analysis": dict(
        title="Insights", img="garden-brook.webp", kicker="Insights", color="forest",
        h1="What other buyers <i>want.</i>",
        lede="Built from saved lists. Per project, only verified members are counted once there are at least 100 of them; until then every saved list counts.",
        desc="Aggregate insights from MyBTO users: preferred floors, facings, blocks and factors.",
        extra='\n  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>',
        body="""
    <section class="tool"><div class="wrap">
      <div id="analysis-locked" class="locked" hidden>
        <span class="label">Members only</span>
        <h2>For verified members</h2>
        <p id="locked-text">Create an account and verify your email to unlock insights.</p>
        <a class="btn primary" href="/account">Sign in or sign up <span class="arr">→</span></a>
      </div>
      <div id="analysis-body" hidden>
        <div class="filters-row">
          <label><span class="eyebrow">View by</span><br><select id="a-group">
            <option value="all">All projects</option><option value="project_type">Project type</option>
            <option value="project">Project</option><option value="flat_type">Unit type</option></select></label>
          <label id="a-value-wrap" hidden><span class="eyebrow">&nbsp;</span><br><select id="a-value"></select></label>
        </div>
        <p id="a-basis" class="basis"></p>
        <div class="board">
          <div class="panel"><span class="eyebrow">Figure 1</span><h3>Lowest storey people will accept</h3><canvas id="c-min"></canvas><div class="stats-row" id="s-min"></div></div>
          <div class="panel"><span class="eyebrow">Figure 2</span><h3>Highest storey people consider</h3><canvas id="c-max"></canvas><div class="stats-row" id="s-max"></div></div>
          <div class="panel w4"><span class="eyebrow">Figure 3</span><h3>Sun direction, most to least wanted</h3><ol class="ranklist" id="r-sun"></ol></div>
          <div class="panel w4"><span class="eyebrow">Figure 4</span><h3>Blocks, most to least wanted</h3><ol class="ranklist" id="r-block"></ol></div>
          <div class="panel w4"><span class="eyebrow">Figure 5</span><h3>Factors, most to least important</h3><ol class="ranklist" id="r-factor"></ol></div>
          <div class="panel w8"><span class="eyebrow">Figure 6</span><h3>Average importance by factor</h3><canvas id="c-factor"></canvas></div>
          <div class="panel w4"><span class="eyebrow">Figure 7</span><h3>Floor preference</h3><canvas id="c-pref"></canvas><div class="stats-row" id="s-privacy"></div></div>
          <div class="panel"><span class="eyebrow">Figure 8</span><h3>Unit types searched</h3><canvas id="c-types"></canvas></div>
          <div class="panel"><span class="eyebrow">Figure 9</span><h3>Most flagged units</h3><ol class="ranklist" id="r-flagged"></ol><div class="stats-row" id="s-queue"></div></div>
        </div>
      </div>
    </div></section>
"""),
    "account": dict(
        title="Account", img="berlayar-rise-7.webp", kicker="Account", color="sage",
        h1="Your <i>MyBTO</i> account.",
        lede="Save your ranked list with your queue number, keep your shortlist on every device and, once verified, unlock insights.",
        desc="Sign in or create a MyBTO account.",
        body="""
    <section class="tool"><div class="wrap">
      <p id="auth-error" class="err" hidden></p>
      <p id="acct-note" class="devlink" hidden aria-live="polite"></p>
      <div id="acct-in" class="acct-card" hidden>
        <span class="label">Signed in</span>
        <h2 style="margin-top:14px" id="acct-email"></h2>
        <p><span id="acct-badge" class="badge"></span></p>
        <div id="verify-box" hidden>
          <p class="small muted">Verify your email to unlock insights. Check your inbox (and spam) for the link.</p>
          <div class="row-btns"><button id="btn-refresh" class="btn primary">I've verified</button><button id="btn-resend" class="btn ghost">Resend email</button></div>
        </div>
        <div class="row-btns"><a class="btn" href="/rank">Rank units</a><a class="btn" href="/shortlist">My shortlist</a><button id="btn-logout" class="btn ghost">Sign out</button></div>
      </div>
      <div id="acct-out" class="auth">
        <form id="form-login"><h2>Sign in</h2>
          <button type="button" class="btn google" data-google>Continue with Google</button>
          <div class="or">or</div>
          <input name="email" type="email" placeholder="Email" autocomplete="email" required>
          <input name="password" type="password" placeholder="Password" autocomplete="current-password" required>
          <button class="btn primary">Sign in</button>
          <button type="button" id="btn-forgot" class="linkbtn">Forgot password?</button>
          <p class="err small"></p></form>
        <form id="form-register"><h2>Create account</h2>
          <button type="button" class="btn google" data-google>Sign up with Google</button>
          <div class="or">or</div>
          <input name="email" type="email" placeholder="Email" autocomplete="email" required>
          <input name="password" type="password" placeholder="Password (min. 8 characters)" minlength="8" autocomplete="new-password" required>
          <button class="btn primary">Create account</button>
          <p class="small muted">Free. We only use your email to sign you in and to verify your account.</p>
          <p class="err small"></p></form>
      </div>
    </div></section>
"""),
}


def main():
    for page, p in PAGES.items():
        html = HEAD.format(page=page, **{k: p[k] for k in ("title", "desc", "img", "kicker", "h1", "lede", "color")}) + p["body"] + FOOT.format(extra=p.get("extra", ""))
        (PUBLIC / f"{page}.html").write_text(html)
        print("wrote", page)


if __name__ == "__main__":
    main()
