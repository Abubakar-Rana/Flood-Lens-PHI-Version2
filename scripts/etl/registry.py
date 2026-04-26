"""Generate countries.json — the master index the frontend loads first.

Includes per-country bbox + center for map fly-to, plus the data-availability
flags so the UI can disable layers/levels that don't exist for a country
(e.g. India has no admin1).
"""
import json
import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import COUNTRIES, INPUT_BOUND, OUT


def country_bbox(country: dict) -> list[float] | None:
    """Compute bbox [west, south, east, north] from the source admin0
    (or admin2 for IND, since it has no admin0 source)."""
    if "admin0" in country["boundaries"]:
        shp = INPUT_BOUND / country["boundaries"]["admin0"]
    else:
        shp = INPUT_BOUND / country["boundaries"]["admin2"]
    if not shp.exists():
        return None
    g = gpd.read_file(shp).to_crs("EPSG:4326")
    minx, miny, maxx, maxy = g.total_bounds
    return [float(minx), float(miny), float(maxx), float(maxy)]


def main():
    out_dir = OUT
    out_dir.mkdir(parents=True, exist_ok=True)
    countries = []
    for c in COUNTRIES:
        cdir = out_dir / c["code"]
        if not cdir.exists():
            continue
        levels = []
        for lvl in [0, 1, 2]:
            if (cdir / f"admin{lvl}.topojson").exists():
                levels.append(lvl)
        bbox = country_bbox(c)
        totals_path = cdir / "totals.json"
        totals = json.loads(totals_path.read_text(encoding="utf-8")) if totals_path.exists() else {}
        center = None
        if bbox and len(bbox) >= 4:
            center = [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2]
        countries.append({
            "code": c["code"],
            "name": c["name"],
            "iso3": c["code"].upper(),
            "levels": levels,
            "bbox": bbox,
            "center": center,
            "totals": totals,
        })
    out_path = out_dir / "countries.json"
    out_path.write_text(json.dumps({"countries": countries}, indent=2))
    print(f"[registry] {len(countries)} countries -> countries.json")


if __name__ == "__main__":
    main()
