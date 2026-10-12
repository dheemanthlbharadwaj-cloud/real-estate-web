"""Generate SAMPLE unit data for the web app until the verified extraction is complete.

- Berlayar Rise: the unit list (block, storey, unit no., flat type) is REAL -- taken from
  pipeline/raw/berlayar-rise-7-dist.json (two independent extractions agreed on all 1,976 units).
  All other attributes are sample values.
- Other projects: real block numbers, everything else is sample.

Every unit carries "sample_fields" listing which fields are placeholders. Deterministic (seeded).
Outputs data/units/<project>.json and data/units/index.json.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "units"

LIFT_NEAR_M, CHUTE_NEAR_M, MRT_NEAR_M, CLEARANCE_M = 15, 10, 100, 30
MSCP_NEAR_M = 100
# Berlayar Rise is the only project with a station on its site plan (Telok Blangah MRT). Rough
# block-to-station distances measured off that plan; every other block is well over 100 m away.
BERLAYAR_MRT_M = {"201A": (45, 70), "200B": (85, 110)}
COMPASS = ["NE", "SE", "SW", "NW"]  # facings are only ever these four quadrants
FACILITIES = ["Children's playground", "Adult fitness station", "Elderly fitness station", "Hardcourt",
              "Precinct pavilion", "Drop-off porch", "Community space", "Preschool", "Residents' network centre",
              "Eating house", "Shops", "Supermarket", "Green roof"]
# Random placeholders only come from FACILITIES_RANDOM. "Mini-mart" and "Future amenities/facilities" are
# never random: they only appear where the HDB brochure shows them (pipeline/raw/facilities_1st_storey.json).
FACILITIES_RANDOM = list(FACILITIES)
FACILITIES = FACILITIES_RANDOM + ["Mini-mart", "Future amenities/facilities"]

# key, name, town, type, code, {block: storeys}, flat types for sample stacks, nearest MRT
PROJECTS = [
    ("kebun-baru_breeze-5", "Kebun Baru Breeze", "Ang Mo Kio", "Plus", "KBB", {"247A": 30, "248A": 30},
     ["4-Room", "2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)"], "Mayflower"),
    ("kebun-baru_ridge-1", "Kebun Baru Ridge", "Ang Mo Kio", "Plus", "KBR", {"183A": 21, "184A": 21, "184B": 21},
     ["3-Room", "4-Room"], "Mayflower"),
    ("berlayar-rise-7", "Berlayar Rise", "Bukit Merah", "Prime", "BR", None, None, "Telok Blangah"),
    ("lakeview-cascadia-2", "Lakeview Cascadia", "Bishan", "Prime", "LC", {"325A": 35, "326A": 40, "326B": 35, "327A": 18, "328A": 18},
     ["4-Room", "2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)"], "Upper Thomson"),
    ("sembawang-brook-6", "Sembawang Brook", "Sembawang", "Standard", "SB", {"437A": 30, "437B": 30, "439A": 30, "440A": 30},
     ["2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)", "3-Room", "4-Room", "5-Room", "3Gen"], "Sembawang"),
    ("sembawang-portico-4", "Sembawang Portico", "Sembawang", "Standard", "SP", {"433A": 26, "433B": 26, "434A": 26},
     ["2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)", "3-Room", "4-Room", "5-Room"], "Sembawang"),
    ("woodgrove-acres-3", "Woodgrove Acres", "Woodlands", "Standard", "WA", {"446A": 17, "446B": 17, "447A": 19, "447B": 18},
     ["2-Room Flexi (Type 1)", "2-Room Flexi (Type 2)", "3-Room", "4-Room", "5-Room"], "Woodlands North"),
]

HOUSING = ["2-Room Flexi", "3-Room", "4-Room", "5-Room", "3Gen"]  # same order as Scoring.HOUSING_TYPES


def housing(flat_type):
    return "2-Room Flexi" if flat_type.startswith("2-Room Flexi") else flat_type


SAMPLE_FIELDS = ["facing", "position", "lift_m", "chute_m", "roof_access", "neighbour_m", "opposite_m",
                 "mrt_m", "facilities_has", "facilities_near", "wind_open"]


def load_mscp():
    """Multi-storey car park distance per block (metres), estimated by hand from the brochure site plans."""
    path = ROOT / "pipeline" / "raw" / "mscp_distance.json"
    return json.loads(path.read_text()) if path.exists() else {}


MSCP = load_mscp()


def stack_attrs(rng, block_idx, i, n_stacks):
    corner = i in (0, n_stacks - 1)
    return {
        "facing": COMPASS[(block_idx + (0 if i < n_stacks / 2 else 2) + rng.choice([0, 0, 1])) % 4],
        "position": "Corner" if corner else "Corridor",
        "lift_m": round(rng.uniform(4, 9) + abs(i - n_stacks / 2) * rng.uniform(2.5, 4), 1),
        "chute_m": round(rng.uniform(3, 30), 1),
        "neighbour_m": round(rng.uniform(18, 90), 1),
        "opposite_m": round(rng.uniform(15, 120), 1),
        "mrt_m": round(rng.uniform(150, 900)),
        "facilities_has": rng.sample(FACILITIES_RANDOM, rng.choice([0, 0, 1, 2])),
        "facilities_near": sorted(rng.sample(FACILITIES_RANDOM, rng.choice([0, 1, 2, 3, 4]))),
        "roof_floors": [2] if rng.random() < 0.25 else [],
    }


def add_wind_open(a, wind_rng):
    """Placeholder for "no block within 30 m on the SE to E side". Real site geometry is not available for most
    projects, so NE/SE-facing stacks are mostly open and the rest are a coin flip. Uses its own seeded Random so
    the other sample attributes do not reshuffle."""
    a = dict(a)
    a["wind_open"] = wind_rng.random() < (0.85 if a["facing"] in ("NE", "SE") else 0.5)
    return a


def load_real_facilities():
    """Facilities at the 1st storey (void deck) read off the HDB brochures, per project key."""
    path = ROOT / "pipeline" / "raw" / "facilities_1st_storey.json"
    return json.loads(path.read_text()) if path.exists() else {}


REAL_FAC = load_real_facilities()


def overlay_real_facilities(a, key, block):
    """Add the brochure facilities on top of the random draw (so the RNG sequence is unchanged).
    Listed in this block -> has. Listed in another block of the project, or project level (block null,
    e.g. a standalone MSCP block or an unplaced legend entry) -> near (a precinct is small)."""
    entries = REAL_FAC.get(key) or []
    if not entries:
        return a
    a = dict(a)
    has = {e["facility"] for e in entries if e["block"] == block}
    near = {e["facility"] for e in entries if e["block"] != block} - has
    a["facilities_has"] = sorted(set(a["facilities_has"]) | has)
    a["facilities_near"] = sorted((set(a["facilities_near"]) | near) - has)
    return a


def make_unit(code, name, key, town, ptype, block, storey, unit, flat_type, a, mrt_name, real_list):
    design = None
    if flat_type.startswith("2-Room Flexi"):
        design = "Type 1" if "Type 1" in flat_type else "Type 2"
    mscp_m = (MSCP.get(key) or {}).get(block)  # hand estimate from the brochure, None when not measured
    return {
        "id": f"{code}-{block}-{storey:02d}-{unit}", "project": name, "project_key": key, "project_type": ptype, "town": town,
        "block": block, "storey": storey, "unit": unit, "address": f"Blk {block} #{storey:02d}-{unit}",
        "flat_type": flat_type, "unit_design": design,
        "facing": a["facing"], "position": a["position"],
        "lift_m": a["lift_m"], "lift_near": a["lift_m"] <= LIFT_NEAR_M,
        "chute_m": a["chute_m"], "chute_near": a["chute_m"] <= CHUTE_NEAR_M,
        "roof_access": storey in a["roof_floors"],
        "neighbour_m": a["neighbour_m"], "gt30m": a["neighbour_m"] > CLEARANCE_M,
        "opposite_m": a["opposite_m"], "opposite_gt30m": a["opposite_m"] > CLEARANCE_M,
        "mrt_name": mrt_name, "mrt_m": a["mrt_m"], "mrt_near": a["mrt_m"] <= MRT_NEAR_M,
        "wind_open": a["wind_open"],
        "mscp_m": mscp_m, "mscp_near": mscp_m is not None and mscp_m <= MSCP_NEAR_M, "mscp_estimated": mscp_m is not None,
        "facilities_has": a["facilities_has"], "fac_has_count": len(a["facilities_has"]),
        "facilities_near": a["facilities_near"], "fac_near_count": len(a["facilities_near"]),
        "sample_fields": SAMPLE_FIELDS if real_list else SAMPLE_FIELDS + ["block_layout", "storey", "unit", "flat_type"],
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index, all_types = [], set()
    for n, (key, name, town, ptype, code, blocks, types, mrt) in enumerate(PROJECTS):
        rng = random.Random(f"bto-sample-{key}")
        wind_rng = random.Random(f"bto-sample-wind-{key}")
        units = []
        if blocks is None:  # real unit list
            dist = json.loads((ROOT / "pipeline" / "raw" / f"{key}-dist.json").read_text())
            by_block = {}
            for e in dist["entries"]:
                by_block.setdefault(e["block"], []).append(e)
            for bi, (block, entries) in enumerate(sorted(by_block.items())):
                entries.sort(key=lambda e: e["unit"])
                for i, e in enumerate(entries):
                    a = stack_attrs(rng, bi, i, len(entries))
                    a = overlay_real_facilities(a, key, block)
                    a = add_wind_open(a, wind_rng)
                    lo, hi = BERLAYAR_MRT_M.get(block, (150, 300))
                    a["mrt_m"] = round(rng.uniform(lo, hi))
                    for s in e["storeys"]:
                        units.append(make_unit(code, name, key, town, ptype, block, s, e["unit"], e["flat_type"], a, mrt, True))
        else:
            stack_no = 0  # running count, so every flat type in the brochure legend appears
            for bi, (block, top) in enumerate(blocks.items()):
                n_stacks = rng.choice([6, 8, 10])
                for i in range(n_stacks):
                    unit = str(100 + bi * 20 + i * 2 + 1)
                    a = stack_attrs(rng, bi, i, n_stacks)
                    a = overlay_real_facilities(a, key, block)
                    a = add_wind_open(a, wind_rng)
                    t = types[stack_no % len(types)]
                    stack_no += 1
                    for s in range(2, top + 1):
                        units.append(make_unit(code, name, key, town, ptype, block, s, unit, t, a, mrt, False))
        units.sort(key=lambda u: (u["block"], u["storey"], u["unit"]))
        (OUT / f"{key}.json").write_text(json.dumps(units, separators=(",", ":")))
        all_types |= {u["flat_type"] for u in units}
        index.append({"key": key, "name": name, "town": town, "project_type": ptype, "units": len(units),
                      "blocks": sorted({u["block"] for u in units}), "max_storey": max(u["storey"] for u in units),
                      "flat_types": sorted({u["flat_type"] for u in units}),
                      "housing_types": [h for h in HOUSING if any(housing(u["flat_type"]) == h for u in units)],
                      "data_status": "real unit list, sample attributes" if blocks is None else "sample data"})
        print(f"{ptype:9} {name:20} {len(units):5} units")
    (OUT / "index.json").write_text(json.dumps({"sample": True, "projects": index, "flat_types": sorted(all_types),
                                                "housing_types": [h for h in HOUSING if any(housing(t) == h for t in all_types)]}, indent=1))


if __name__ == "__main__":
    main()
