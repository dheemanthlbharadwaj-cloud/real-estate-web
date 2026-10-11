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
  <meta name="theme-color" content="#ffffff">
  <title>{title} · MyBTO</title>
  <meta name="description" content="{desc}">{robots}
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
        <p>{lede}</p>
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
        title="Unofficial HDB BTO Flat Unit Ranker", img="garden-ridge.webp", kicker="", color="sky",
        h1="Unofficial HDB BTO Flat Unit Ranker",
        lede="Choose a project and filters, then rate each factor from minus 5 (avoid) to plus 5 (must have).",
        desc="Rank every unit of a BTO project by your own priorities.",
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
            <div class="field"><span class="eyebrow">Housing type · pick one</span><div id="f-types" class="chips" role="radiogroup" aria-label="Housing type"></div></div>
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
                <label class="chip"><input type="radio" name="pref" value="lower"><span>Lower</span></label>
              </div>
            </div>
          </div>
          <div class="step">
            <div class="step-h"><h2>3. Importance</h2></div>
            <p class="small muted" style="margin:-6px 0 0">Minus 5 means avoid and plus 5 means must have. Tap ? to see what a factor means.</p>
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
              <a id="btn-analysis" class="btn primary" href="/analysis" target="_blank" rel="noopener"><span id="analysis-name">Project</span> Analysis</a>
              <button type="button" class="linkbtn" id="btn-edit-survey">Edit survey answers</button>
            </div>
          </div>
          <p id="save-msg" class="save-msg" aria-live="polite"></p>
          <div class="fg-wrap">
            <div class="fg-intro"><span class="eyebrow">By floor</span><p class="small muted">Every matching unit on the highest, middlemost and lowest storeys of your list (the middle two if there’s an even number).</p></div>
            <div id="floor-groups" class="floor-groups" hidden></div>
          </div>
          <div class="table-wrap"><table class="schedule" id="results"><thead></thead><tbody></tbody></table></div>
        </div>
      </div>
    </div></section>
    <div id="survey" class="modal" hidden>
      <div class="modal-scrim"></div>
      <form id="survey-form" class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="survey-title">
        <h2 class="h3" id="survey-title">Before we show your ranking</h2>
        <p class="small muted">Four quick questions so the Analysis page can show what buyers like you want. We don’t ask for your name, and you only do this once.</p>
        <fieldset><legend>How old are you?</legend><div class="chips">
          <label class="chip"><input type="radio" name="age" value="under-25" required><span>Under 25</span></label>
          <label class="chip"><input type="radio" name="age" value="25-29"><span>25 to 29</span></label>
          <label class="chip"><input type="radio" name="age" value="30-34"><span>30 to 34</span></label>
          <label class="chip"><input type="radio" name="age" value="35-39"><span>35 to 39</span></label>
          <label class="chip"><input type="radio" name="age" value="40-plus"><span>40 and above</span></label>
        </div></fieldset>
        <fieldset><legend>Who will you live with?</legend><div class="chips">
          <label class="chip"><input type="radio" name="household" value="alone" required><span>On my own</span></label>
          <label class="chip"><input type="radio" name="household" value="partner"><span>My partner</span></label>
          <label class="chip"><input type="radio" name="household" value="partner-kids"><span>My partner and kids</span></label>
          <label class="chip"><input type="radio" name="household" value="parents"><span>Parents or grandparents too</span></label>
        </div></fieldset>
        <fieldset><legend>Is this your first flat from HDB?</legend><div class="chips">
          <label class="chip"><input type="radio" name="timer" value="first" required><span>First-timer</span></label>
          <label class="chip"><input type="radio" name="timer" value="second"><span>Second-timer</span></label>
          <label class="chip"><input type="radio" name="timer" value="mixed"><span>One of each (as a couple)</span></label>
        </div></fieldset>
        <fieldset><legend>Where do you live now?</legend><div class="chips">
          <label class="chip"><input type="radio" name="current_home" value="parents" required><span>With my parents</span></label>
          <label class="chip"><input type="radio" name="current_home" value="hdb-rental"><span>HDB rental flat</span></label>
          <label class="chip"><input type="radio" name="current_home" value="own-hdb"><span>My own HDB flat</span></label>
          <label class="chip"><input type="radio" name="current_home" value="private"><span>Private property</span></label>
        </div></fieldset>
        <label class="survey-queue"><span>Your queue number, if you have one</span><input name="queue_number" type="text" inputmode="numeric" maxlength="12" placeholder="e.g. 1234"></label>
        <p class="consent small">By continuing, you agree that your answers and your ranking are saved without your name and used only for the combined results on the Analysis page.</p>
        <p class="err small" id="survey-err"></p>
        <div class="modal-btns"><button type="button" class="btn ghost" data-close-survey>Not now</button><button type="submit" class="btn primary" id="survey-ok">I agree, show my ranking</button></div>
      </form>
    </div>
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
      <div class="picker-row"><span class="eyebrow">Project</span><select id="project" aria-label="Project"></select><a class="btn ghost" href="/">Add more units <span class="arr">→</span></a></div>
      <ol id="flag-list" class="shortlist"></ol>
    </div></section>
"""),
    "analysis": dict(
        title="Analysis", img="garden-brook.webp", kicker="Analysis", color="forest",
        h1="What other buyers <em>want.</em>",
        lede="Built from everyone’s saved rankings for this project.", robots=True,
        desc="Combined results from MyBTO rankings: preferred floors, facings, blocks and factors.",
        extra='\n  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>',
        body="""
    <section class="tool"><div class="wrap">
      <div id="analysis-locked" class="locked" hidden>
        <span class="label">Rank first</span>
        <h2>Rank a project to see this</h2>
        <p id="locked-text">Rank units for any project and answer the four quick questions. Analysis opens right after.</p>
        <a class="btn primary" href="/">Rank units <span class="arr">→</span></a>
      </div>
      <div id="analysis-body" hidden>
        <div class="filters-row">
          <label><span class="eyebrow">View by</span><br><select id="a-group">
            <option value="project">Project</option><option value="all">All projects</option><option value="project_type">Project type</option>
            <option value="flat_type">Housing type</option></select></label>
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
          <div class="panel w4"><span class="eyebrow">Figure 7</span><h3>Floor preference</h3><canvas id="c-pref"></canvas></div>
          <div class="panel w4"><span class="eyebrow">Figure 8</span><h3>Facilities, most to least wanted</h3><ol class="ranklist" id="r-facility"></ol></div>
          <div class="panel w4"><span class="eyebrow">Figure 9</span><h3>Housing types searched</h3><canvas id="c-types"></canvas></div>
          <div class="panel w12"><span class="eyebrow">Figure 10</span><h3>Who ranked</h3><div class="who" id="r-who"></div></div>
          <div class="panel w12"><span class="eyebrow">Figure 11</span><h3>Most shortlisted units</h3><ol class="ranklist" id="r-flagged"></ol><div class="stats-row" id="s-queue"></div></div>
        </div>
      </div>
    </div></section>
"""),
    "account": dict(
        title="Account", img="berlayar-rise-7.webp", kicker="Account", color="sage",
        h1="Your <em>MyBTO</em> account.",
        lede="Signing in is optional. It keeps your shortlist and rankings with you on any device.",
        desc="Sign in or create a MyBTO account.",
        body="""
    <section class="tool"><div class="wrap">
      <p id="auth-error" class="err" hidden></p>
      <p id="acct-note" class="devlink" hidden aria-live="polite"></p>
      <div id="acct-in" class="acct-card" hidden>
        <span class="label">Signed in</span>
        <h2 style="margin-top:14px" id="acct-email"></h2>
        <div class="row-btns"><a class="btn" href="/">Rank units</a><button id="btn-logout" class="btn ghost">Sign out</button></div>
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
          <p class="small muted">It’s free. We only use your email to sign you in.</p>
          <p class="err small"></p></form>
      </div>
    </div></section>
"""),
}


def main():
    for page, p in PAGES.items():
        kicker_html = f'        <span class="label">{p["kicker"]}</span>\n' if p["kicker"] else ""
        robots = '\n  <meta name="robots" content="noindex">' if p.get("robots") else ""
        html = HEAD.format(page=page, kicker_html=kicker_html, robots=robots, **{k: p[k] for k in ("title", "desc", "img", "h1", "lede", "color")}) + p["body"] + FOOT.format(extra=p.get("extra", ""))
        (PUBLIC / f"{page}.html").write_text(html)
        print("wrote", page)
        if page == "rank":  # the ranking page is also the home page; the old home page lives at /archive/home
            (PUBLIC / "index.html").write_text(html)
            print("wrote index (rank)")


if __name__ == "__main__":
    main()
