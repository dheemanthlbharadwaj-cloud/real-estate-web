# Frontend and scoring

Source: `public/js/app.js`, `public/js/scoring.js`, `public/js/legend.js`, `public/js/site.js`, page bodies in `pipeline/build_pages.py`.

## Projects
| Type | Projects (key) |
|---|---|
| Plus | Kebun Baru Breeze (`kebun-baru_breeze-5`), Kebun Baru Ridge (`kebun-baru_ridge-1`), Ang Mo Kio |
| Prime | Berlayar Rise (`berlayar-rise-7`, Bukit Merah), Lakeview Cascadia (`lakeview-cascadia-2`, Bishan) |
| Standard | Sembawang Brook (`sembawang-brook-6`), Sembawang Portico (`sembawang-portico-4`), Sembawang; Woodgrove Acres (`woodgrove-acres-3`, Woodlands) |

The project dropdown groups them Prime, Plus, Standard.

## Rank page flow
1. **Project.** `?project=` wins, then localStorage `project`, then the first project. A line under the dropdown says type, town, units and blocks.
2. **Filters.** One housing type at a time (`Scoring.HOUSING_TYPES`: 2-Room Flexi, 3-Room, 4-Room, 5-Room, 3Gen; 2-Room Flexi covers Type 1 and Type 2; 4-Room is preselected when present). Blocks (Select all / Clear). Storey range. "Prioritise floors": No preference / Higher / Lower, **always starts at Higher** (`loadProject` sets it and `restoreLast` does not restore it; an old saved Lower once surprised a user).
3. **Importance of factors.** Sliders from -5 to +5. A meter shows only if some unit in the selected blocks and housing type has that feature; hidden ones are listed under "Not in your selection, so hidden: ...". Group order (`renderWeights`): Blocks, Sun direction, Wind direction, Unit design (2-Room Flexi only), Distance, Others, Facilities nearby (within 30 m). With real data no unit has roof access, so "Others" shows only Corner unit.
4. **Rank units.** `onRankClick` calls `MyBTOAds.interstitial()`, which resolves at once while `ADS_ENABLED` is false (consent time stored in sessionStorage), then `runRank()`. The header tab "Rank units" does the same: on the rank page it is intercepted; from other pages it opens `/?rank=1`, which ranks on load and then cleans the URL.
5. **Results.** Top 100 rows (`SHOW_TOP = 100`), "Showing the top 100." when there are more. The By floor boxes (highest, middlemost, lowest storeys) use only the top 100. The full order of all matching units is sent to the Sheet. The support card appears under the results. Returning visitors get their last filters and weights for that project, with the message "Your last settings for this project are filled in. Press Rank units to see the ranking."

## Scoring (`public/js/scoring.js`)
- Score = sum of importance x feature (0..1), rounded to 3 decimals. Floor priority adds `FLOOR_PREF_WEIGHT` (5) x position within the unit's own block height (higher: top storey = 1; lower: bottom storey = 1).
- Per-group weights: `block` (per block), `sun` (per facing), `design` (Type 1 / Type 2), `facility` (per facility: has = 1, near = 0.5).
- Single factors (`FACTORS`, label, feature):
  - `clearance` "More than 30 m from the nearest visible unit" (`gt30m`)
  - `corner` "Corner unit" (`position === 'Corner'`)
  - `roof` "Access to roof" (`roof_access`; no real unit has it, so the meter hides)
  - `chute` "10 m away from rubbish chute" (`chute_m > 10`, `CHUTE_FAR_M = 10`)
  - `mrt` "Within 100 m from MRT" (`mrt_near`)
  - `mscp` "Within 100 m from a multi-storey car park" (`mscp_near`, `MSCP_NEAR_M = 100`)
  - `wind_facing` "Faces the prevailing wind (SE to E)" (facing NE or SE; Singapore's prevailing wind comes from SE to E, bearing 90 to 135, and both NE and SE windows catch the east side)
  - `wind_open` "Not blocked from the wind" (`wind_open`: no other block within 30 m on the SE to E side)
- `GROUPS`: wind (`wind_facing`, `wind_open`), distance (`clearance`, `chute`, `mrt`, `mscp`), others (`corner`, `roof`).
- Ranks are dense: equal scores share a rank and the next score gets the next number (1, 1, 2). Ties sort by higher storey, then id.
- Facings are only NE, SE, SW, NW. Sun direction = where the living room windows face.
- `FACTOR_KEYS` in `apps-script/Analytics.js` must equal `Object.keys(Scoring.FACTORS)` (a unit test checks it).

## Results table conventions
- Columns: `#`, star, Unit (storey-unit, block, tags), Score (bar, signed), Type and facing (compass arrow), Chute (more than 10 m), MRT (within 100 m), then one column per facility present.
- Chute: ✓ = more than 10 m from the chute, ✗ = within 10 m, – = unknown. MRT: ✓ = within 100 m. Facilities: ✓ when in the block or within 30 m. No "Near/Far" words.
- Tags under the unit: `corner` or `corridor`, `near MRT`, `chute within 10 m`.
- Rows with a negative score are shaded, with a red line before the first one. Rows ranked 1 to 3 with a score of 0 or more are highlighted (`top3`).

## Shortlist
- Star (★) in the results toggles a unit. Stored in `flags:<project>`, synced across tabs with the `storage` event, sent to the Sheet debounced 2 s (`store.saveShortlist`).
- "Shortlisted" button (count) opens `/shortlist?project=<key>` in a new tab.
- Page copy: title "Your Shortlist", no kicker, subtitle "Drag to reorder your shortlisted units" (owner's words). Reorder by drag or the ↑ ↓ buttons, ✕ removes.
- Each item shows "Rank 12 (was 30) · score +4.5" from `mybto:lastrank:<project>` (rank shown beyond the top 100 too; "not in your latest ranking" when filtered out). A note explains which settings the ranking used and when. `prev` changes only when the result changes.
- **Clear all** asks "Are you sure you want to clear your whole shortlist for <Project>?" and syncs the empty list.
- **Share shortlist** builds `<origin>/shortlist?project=<key>&units=<ids in order>` (max 100). Uses `navigator.share` when present, else copies and shows "Link copied", else a prompt.
- A shared link shows a read-only list with the banner "Shared shortlist for <Project>", **Save as my shortlist** (asks "Replace your shortlist for <Project> with this shared one?" if they have one) and **Back to my shortlist**. Unknown ids are dropped, max 100. The visitor's own list changes only if they save.

## Legend drawer
- "What these factors mean" button and the `?` buttons open the drawer at an entry; `?legend=<key>` deep-links it.
- `window.LEGEND` in `legend.js` has 11 entries, sorted like the panel: sun, wind_facing, wind_open, floor, design, clearance, chute, mrt, mscp, corner, facilities. The roof entry was removed (no unit has roof access); `lg-roof.webp` is still in `public/img/legend/` but unused.
- Each entry: title, picture (`public/img/legend/<img>`), one plain text, and a source line rendered by `app.js`: "Source: HDB sales brochure" (link to https://homes.hdb.gov.sg) plus ", measured with its scale bar" when `rule: "scale"`. No PDF names, page numbers, placeholder or estimate wording.
- Opening an entry sends the GA event `open_legend`.

## Header and footer (`site.js`)
- Header: logo (links to `/`) and the "Rank units" tab. The Analytics tab appears only with `ANALYTICS_ENABLED: true` and follows the project via the `mybto:project` event. Active tab has `aria-current="page"`. No hamburger menu. No sign-in links anywhere.
- Footer: one credit line only: independent student project, not affiliated with HDB, images © HDB, visits counted with Google Analytics, plus a "Privacy policy" link. No logo, tagline, link columns or support link.

## Support card (Buy Me a Coffee)
- `#support` card under the results, shown after the first ranking. Heading "Help keep MyBTO free". Text (owner's exact words, keep verbatim): "Helping you find your dream home takes a lot of coffee! If MyBTO made your selection easier, consider buying us a Kopi to help fuel the next BTO launch ☕". Button "Buy me a coffee ☕" to https://buymeacoffee.com/mybto. Plain link, no widget script. Clicks send GA `coffee_click`.

## Archived Analytics page
- `/archive/analytics?project=<key>`, `noindex`, h1 "<Project> Analytics", one project, no controls. `/analytics` and `/analysis` redirect to `/`.
- With `ANALYTICS_SOURCE: 'sample'` the numbers come from `sample_submissions.json` through `analytics-core.js` in the browser (the e2e test expects "Based on 71 saved rankings" for Berlayar Rise). With `'sheet'` it calls `SHEETS_URL?action=analytics&project=`.
- Layout: 4 KPI tiles (Rankings, Typical lowest floor, Typical highest floor, Floor preference doughnut), 6 chart cards (storey, sun, blocks, factors, facilities top 10, housing types), 8 insight boxes in two rows of four (Sun chasers, Catch the breeze, Most wanted block, Don't want to see your neighbours?, Ew! The smell, Corner seekers, The most popular facility is, Car owners or Train lovers). A box with no data, or for a factor the project lacks, is skipped and the next idea from a pool fills in. Chart.js charts are non-interactive. One faint site-name watermark per chart canvas (`mybtoWatermark` plugin), CSS watermark on cards with no canvas and on insight boxes. <!-- DOMAIN-SWITCH: update when mybto.sg is primary --> (watermark text is the site name)
- To bring it back: `ANALYTICS_ENABLED: true`; to show real data: `ANALYTICS_SOURCE: 'sheet'` and Settings!B1 FALSE in the Sheet (already FALSE). Only when the owner asks.

## Copy rules
- Plain words, short sentences, "you". No marketing filler. No em dashes. Write "10 m", "30 m", "100 m". Facings NE, SE, SW, NW only.
- No SVG: use text characters (★ ✓ ✗ ↑) or the webp images.
- Keep the owner's exact wording where given (support card, shortlist subtitle). No intro paragraph under the rank page title (`lede=""`).
- Analytics boxes: plain text, no blue link-style words.
- Images in `public/img/` are HDB brochure drawings: keep the footer credit.
