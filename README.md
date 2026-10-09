# BTO Unit Ranker (HDB June 2026 exercise)

Ranks every sale unit of the June 2026 BTO projects by each user's own importance weights.

| Type | Projects |
|---|---|
| Plus | Kebun Baru Breeze, Kebun Baru Ridge (Ang Mo Kio) |
| Prime | Berlayar Rise (Bukit Merah), Lakeview Cascadia (Bishan) |
| Standard | Sembawang Brook, Sembawang Portico (Sembawang), Woodgrove Acres (Woodlands) |

## Data status
**The site currently runs on SAMPLE data** (`python3 pipeline/make_sample_data.py`):
Berlayar Rise's unit list (blocks, storeys, unit numbers, flat types — 1,976 units) is real; every other
attribute, and all units of the other six projects, are placeholders. Sample analysis users (420, emails
`@sample.invalid`) are seeded on first start; remove with `node server/seed_sample.js --remove` or start with `SEED_SAMPLE=0`.

## Data (target)
- `data/BTO_Units_June2026.xlsx` — one row per sale unit; tabs **Plus / Prime / Standard** (+ Facilities, Method).
- `data/units/*.json` — the same data for the web app.
- Built by `python3 pipeline/build_dataset.py` from the reconciled brochure extractions in `pipeline/raw/`.
  Each dataset (unit distribution, floor plans, site plan) was extracted twice independently and reconciled
  against the brochure; `pipeline/verify.py` checks counts against the brochures' unit-mix tables.

## Web app
```
npm install
npm start          # http://localhost:3000
npm test
```
Node >= 22.13 (uses the built-in `node:sqlite`). Set `ADMIN_EMAILS` to let admins mark users verified,
`NODE_ENV=production` to stop returning verification links in API responses.

- **Rank units**: choose project, filter by unit type / blocks / storey range / floor preference, set importance
  (-5..+5) for each selected block, sun direction, 2-Room Flexi design and the other factors.
- **Flagged**: ★ units into a separate priority list; reorder by drag or arrows.
- **Privacy filter**: only show units whose windows face nothing closer than 30 m.
- Only importance meters for factors that exist in the selected blocks / unit types are shown.
- **Account**: save the list with your queue number (one saved list per project).
- **Analysis** (verified users only): min/max storey distributions with binomial fit and std, ranked sun directions, blocks and factors,
  floor preference, unit types, most flagged units — for all projects, by project type, project or unit type.
  Uses verified users only once a project has at least 100 verified saved lists, otherwise all users.
- **Legend**: annotated brochure images explaining each factor.
