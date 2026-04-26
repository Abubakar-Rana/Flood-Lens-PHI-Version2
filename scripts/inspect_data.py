"""One-shot inspection: dump schema/metadata for every input file. No data is modified."""
import json
import os
from pathlib import Path

import geopandas as gpd
import rasterio

ROOT = Path(__file__).resolve().parent.parent
BOUND = ROOT / "public" / "Boundries"
DATA = ROOT / "public" / "Data"

COUNTRIES = {
    "pak": "Pakistan",
    "ind": "India",
    "bgd": "Bangladesh",
    "npl": "Nepal",
    "btn": "Bhutan",
    "lka": "SriLanka",
}

def safe(d):
    out = {}
    for k, v in d.items():
        try:
            json.dumps(v)
            out[k] = v
        except TypeError:
            out[k] = str(v)
    return out

def inspect_shp(p: Path):
    if not p.exists():
        return {"missing": True}
    g = gpd.read_file(p, rows=3)
    full = gpd.read_file(p)
    sample = full.head(2).drop(columns=[full.geometry.name]).to_dict(orient="records")
    return {
        "path": str(p.relative_to(ROOT)),
        "feature_count": len(full),
        "columns": list(full.columns),
        "dtypes": {c: str(t) for c, t in full.dtypes.items()},
        "crs": str(full.crs),
        "geom_type": full.geom_type.iloc[0] if len(full) else None,
        "bounds": [float(x) for x in full.total_bounds.tolist()],
        "sample_attrs": [safe(r) for r in sample],
    }

def inspect_tif(p: Path):
    if not p.exists():
        return {"missing": True}
    with rasterio.open(p) as r:
        sample = None
        try:
            # tiny window for stats, no full read
            w = rasterio.windows.Window(0, 0, min(512, r.width), min(512, r.height))
            arr = r.read(1, window=w, masked=True)
            sample = {
                "window_min": float(arr.min()) if arr.count() else None,
                "window_max": float(arr.max()) if arr.count() else None,
                "window_mean": float(arr.mean()) if arr.count() else None,
                "window_pixels": int(arr.count()),
            }
        except Exception as e:
            sample = {"error": str(e)}
        return {
            "path": str(p.relative_to(ROOT)),
            "size_mb": round(p.stat().st_size / 1e6, 1),
            "width": r.width,
            "height": r.height,
            "count": r.count,
            "dtype": r.dtypes[0],
            "crs": str(r.crs),
            "transform": list(r.transform)[:6],
            "bounds": list(r.bounds),
            "res": list(r.res),
            "nodata": r.nodata,
            "sample_topleft_512": sample,
        }

report = {"countries": {}}
for code, name in COUNTRIES.items():
    entry = {"name": name, "boundaries": {}, "rasters": {}, "points": {}}
    if code == "ind":
        for lvl, path in [("admin2", BOUND / "geoBoundaries-IND-ADM2_simplified.shp"),
                          ("admin2_full", BOUND / "geoBoundaries-IND-ADM2.shp")]:
            entry["boundaries"][lvl] = inspect_shp(path)
    else:
        for lvl in ["admin0", "admin1", "admin2"]:
            entry["boundaries"][lvl] = inspect_shp(BOUND / f"{code}_{lvl}.shp")

    entry["rasters"]["affected_pop"] = inspect_tif(DATA / "Affectde_Population" / f"{name} Affected Pop.tif")
    entry["rasters"]["affected_child_pop"] = inspect_tif(DATA / "Affected_Child_Population" / f"{name} Child Affected.tif")

    health_dir = DATA / "Affected_Health_facilities" / name
    school_dir = DATA / "Affected_Schools" / name
    if health_dir.exists():
        for shp in health_dir.glob("*.shp"):
            entry["points"]["health"] = inspect_shp(shp)
            break
    if school_dir.exists():
        for shp in school_dir.glob("*.shp"):
            entry["points"]["schools"] = inspect_shp(shp)
            break

    report["countries"][code] = entry

out_path = ROOT / "scripts" / "inspect_report.json"
out_path.write_text(json.dumps(report, indent=2, default=str))
print(f"Wrote {out_path}")
print(f"Total countries inspected: {len(report['countries'])}")
