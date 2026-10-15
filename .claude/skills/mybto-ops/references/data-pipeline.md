# Data pipeline (real unit data)

All 7 projects carry real data since 2026-10-13: 6,952 sale units in 257 stacks. The source of truth is `pipeline/raw/real/<project_key>.json`. The site reads only `public/data/units/*.json`, written by `pipeline/build_real_data.py --publish`.

| Project | Key | Stacks | Units | Car park | MRT within 100 m |
|---|---|---|---|---|---|
| Kebun Baru Breeze | `kebun-baru_breeze-5` | 20 | 579 | Block 247 MSCP | none (no station on plan) |
| Kebun Baru Ridge | `kebun-baru_ridge-1` | 26 | 485 | Block 183 MSCP | none |
| Berlayar Rise | `berlayar-rise-7` | 48 | 1,976 | Block 201 MSCP | Telok Blangah: 728 units |
| Lakeview Cascadia | `lakeview-cascadia-2` | 47 | 1,221 | Block 325 MSCP | none |
| Sembawang Brook | `sembawang-brook-6` | 40 | 1,160 | Block 436 MSCP | none |
| Sembawang Portico | `sembawang-portico-4` | 35 | 875 | Block 433 MSCP | none |
| Woodgrove Acres | `woodgrove-acres-3` | 41 | 656 | Block 447 MSCP | none |

Rental flats (marked "not available for sale" in the brochures) are excluded from stacks and units.

## Inputs
Each project was analysed from two sources: the HDB sales brochure (site plan, unit distribution, floor plans, with scale bars) and the owner's annotated board (`board.pdf`, rows: 1b MRT circle, 2 facility 30 m circles, 3 semicircles for the 30 m test, 5 facing arrows). Board vector shapes were mapped into brochure coordinates. Every project then had an independent review on 2026-10-13 and the fixes were applied (see each file's `notes`). The analysis scratch files (renders, crops, scripts) are not in the repo.

## Raw file schema (`pipeline/raw/real/<key>.json`)
- `project_key`, `name`, `north_bearing_deg` (0 for all 7: plan north points up), `scale` (metres per pixel or points per metre for site and floor plans, with notes on how they were measured).
- `totals_check`: `{brochure: {flat_type: n}, counted: {flat_type: n}, brochure_total, counted_total, match}`. `match` must be true.
- `stacks`: one per sale stack: `block`, `unit`, `facing` (NE/SE/SW/NW), `gt30m` (bool), `gt30m_evidence` (`crop`, `centre_px`, pass1/pass2 colours, semicircles), `position` (Corner/Corridor), `chute_m`, `roof_floors` (list of storeys, all `[]`), `wind_open` (bool), `mscp_m`, `mrt_m` (null when no station on the plan), `facilities_has`, `facilities_near`, `confidence` ("high" or lower), `notes`. Optional extras: `roof_next_to_2nd_storey_roof`, `roof_note_2nd_storey`, `facing_evidence`, `door_floorplan_pt`, `mscp_m_exact`.
- `units`: `{block, storey, unit, flat_type}`; flat types allowed: "2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)", "3-Room", "4-Room", "5-Room", "3Gen".
- `blocks`: one entry per block with the block-wide values `facilities_near`, `facilities_has` (when any), `mscp_m`, `mrt_m` (when present). These are copied onto every stack of the block; `build_real_data.py` reads the stack fields only, so keep both in step (they match today).
- `notes`: the method and decisions in plain sentences. Keep adding to it.

## Agreed measurement rules (owner decisions)
- **Facing.** From the board row 5 arrows (NW magenta, NE blue, SW red, SE purple), one per stack, checked against the floor plan living-room windows. Only NE, SE, SW, NW. Sun direction = where the living room windows face.
- **More than 30 m (`gt30m`).** Board row 3 semicircles (labelled 15 m radius, so two facing ones meet at about 30 m), each attributed to the stack it is centred on. A unit fails if any of its OWN semicircles is red. A neighbour's red semicircle overlapping the unit's own green one does not fail it.
- **Position.** Corner = the last unit door at a dead end of its corridor branch from the lift lobby. Everything else is Corridor.
- **Rubbish chute (`chute_m`).** Straight line from the main door to the centralised (general) refuse chute on the typical floor plan, with the scale bar. "Within 10 m" means `chute_m <= 10`; the site factor scores `chute_m > 10`.
- **Roof access.** "Roof at 2nd storey only" (and similar) on HDB plans is a non-accessible roof slab, so it is NOT roof access. Car-park roof gardens reached by shared link bridges do not count either. Result: `roof_floors` is `[]` everywhere and no unit has roof access, so the "Access to roof" meter hides itself and the roof legend entry was removed.
- **Wind (`wind_open`).** Per unit, from the living-room window wall: no other residential block (rental blocks included, same-block wings excluded) within 30 m at bearing 90 to 135 degrees inclusive.
- **Block-wide rule (owner, 2026-10-13).** `facilities_near`, MRT distance (`mrt_m`) and car park distance (`mscp_m`) are per BLOCK, not per stack. A facility's 30 m circle touching any part of the block outline gives it to every unit in the block (any touch counts, even a sliver). `facilities_has` (the facility is in the block itself, e.g. void deck) wins over near and is not repeated in near.
- **Car park (`mscp_m`) and MRT (`mrt_m`).** Nearest distance from the block outline to the car park outline or the station point, rounded to 5 m. Within 100 m is near.
- **Per-unit only:** `gt30m`, `facing`, `position`, `chute_m`, `wind_open`.
- Future amenities/facilities (void deck space HDB has set aside) count as a facility where the brochure marks them.

## Build and publish
```
pip install openpyxl                         # dev-only, also needed by npm test
python3 pipeline/build_real_data.py          # validate all 7 files, write review/mybto-units-review.xlsx and .csv
python3 pipeline/build_real_data.py --publish  # also write public/data/units/<key>.json and index.json
python3 pipeline/build_real_data.py --in DIR --out DIR   # other input folder / output root (the test uses this)
```
- Validation errors (block publish for that project): duplicate stack or unit, facing not in NE/SE/SW/NW, unit without a stack, flat type not allowed, storey not an int, no units, `totals_check.match` not true.
- Warnings (printed, do not block): null `gt30m`, `chute_m` or `wind_open`, odd position, confidence not high, stack with no units, missing file (that project keeps its current published file).
- The review workbook (`review/`, git-ignored) has a Summary sheet, one sheet per project (one row per stack) and All units. Share it with the owner directly; publish only after the owner approves.
- Publish writes ids as `<CODE>-<block>-<storey 2 digits>-<unit>` using codes from `PROJECTS` in `make_sample_data.py`, sets `lift_m`, `neighbour_m`, `opposite_m` to null, `opposite_gt30m` = `gt30m`, `sample_fields` = [], `data_status: "real data"`, and `index.json` `sample: false`. Project order in `index.json` follows `PROJECTS`.
- After publishing: `npm test`, the browser test, commit the raw file, `public/data/units/` and the skill together, then deploy with approval.

## Legacy scripts (do not run)
- `pipeline/make_sample_data.py` writes SAMPLE data straight into `public/data/units/` and would replace the real data. It stays in the repo because `build_real_data.py` imports `PROJECTS`, `HOUSING`, `housing()` and the thresholds (`CHUTE_NEAR_M = 10`, `MRT_NEAR_M = 100`, `MSCP_NEAR_M = 100`) from it.
- `pipeline/build_dataset.py` is the older extraction-based build. It needs `pipeline/raw/<key>-{dist,floor,site}.json` for every project and exits at the first missing file (only `berlayar-rise-7-dist.json` exists).
- `pipeline/raw/facilities_1st_storey.json` and `mscp_distance.json` fed the legacy pipelines. The real files supersede them (per-block car park distances differ from `mscp_distance.json` by design).
- `npm run sample` (`lib/make_sample_submissions.js`) regenerates the 420 sample rankings used by sample Analytics and the fake Sheet. Not needed for normal work; the e2e test expects 71 sample rankings for Berlayar Rise.

## Fix one value
1. Edit the stack (and the `blocks` entry if it is a block-wide field) in `pipeline/raw/real/<key>.json`. Add a dated line to `notes` saying what changed and why.
2. Run the build, check the warnings, give the owner the review workbook if the change is not trivial.
3. `--publish`, tests, commit, deploy (approval).
Do not edit `pipeline/raw/real/*.json` while another agent is writing them.

## Add a new BTO exercise (next launch)
1. Agree with the owner which projects go live and whether the old ones stay (the site and copy say "June 2026 exercise" in `README.md`, `public/llms.txt`, `package.json`).
2. For each project: get the brochure and the owner's annotated board, then produce `pipeline/raw/real/<key>.json` with the schema and rules above. Key format follows HDB's brochure file names (e.g. `berlayar-rise-7`).
3. Add each project to `PROJECTS` in `pipeline/make_sample_data.py` as `(key, name, town, type, code, blocks-or-None, flat-types, nearest MRT name)`; only key, name, town, type, code and MRT name are used by `build_real_data.py`. Remove old projects from `PROJECTS` if they should leave the site (publish drops index entries whose key is not in `PROJECTS`; delete their unit JSON files by hand).
4. Add the keys to `PROJECT_KEYS` in `apps-script/Analytics.js` (writes for unknown keys are refused). The owner must paste and publish a new Apps Script version.
5. Images: `public/img/<key>.webp` (archive home grid) and, if legend pictures change, `public/img/legend/`. Update `ORDER` and `BLURB` in `public/js/home.js`.
6. Update facts in `public/llms.txt`, `README.md`, the privacy page if data collection changes, the sitemap `lastmod`, and this skill.
7. Run the build, review with the owner, publish, run all tests (some e2e checks name current projects and counts, see `testing.md`), commit, deploy with approval.
