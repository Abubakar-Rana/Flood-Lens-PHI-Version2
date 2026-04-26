"""Compute per-district raster statistics (sum, mean, max, count of valid pixels).

Method (no rasterstats dep): for each admin2 polygon, use rasterio.mask to
clip the raster to the polygon bbox + apply the polygon mask. Read only the
windowed pixels — full-resolution raster never loaded into memory.

Pixel value semantics: counts of affected people per ~100m pixel.
- sum   = total affected people in district (the headline number)
- mean  = average per-pixel intensity (population density proxy)
- max   = peak hotspot intensity
- count = number of valid (non-nodata) pixels in district

Nothing rounded or transformed. Floats preserved as-is.
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from shapely.geometry import mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import COUNTRIES, INPUT_BOUND, INPUT_DATA, OUT, normalize_admin_props


def zonal_for_polygon(src, geom):
    """Return (sum, mean, max, count) for one polygon. None if no valid pixels."""
    try:
        arr, _ = rio_mask(src, [mapping(geom)], crop=True, all_touched=False, filled=False)
    except ValueError:
        # polygon entirely outside raster bounds
        return None
    a = arr[0] if arr.ndim == 3 else arr
    # arr is a MaskedArray when filled=False
    valid = a.compressed() if hasattr(a, "compressed") else a[~np.isnan(a)]
    # Also drop nodata sentinel if it slipped through (huge negative)
    if src.nodata is not None:
        valid = valid[valid != src.nodata]
    # Drop NaN/inf
    valid = valid[np.isfinite(valid)]
    if valid.size == 0:
        return {"sum": 0.0, "mean": 0.0, "max": 0.0, "count": 0}
    return {
        "sum": float(valid.sum()),
        "mean": float(valid.mean()),
        "max": float(valid.max()),
        "count": int(valid.size),
    }


def process_country(country: dict):
    code = country["code"]
    schema = country["schema"]
    print(f"[zonal] {code} ({country['name']})")

    a2_path = INPUT_BOUND / country["boundaries"]["admin2"]
    a2 = gpd.read_file(a2_path)
    a2 = normalize_admin_props(a2, 2, schema).to_crs("EPSG:4326")

    out: dict[str, dict] = {}

    for kind, rel in country["rasters"].items():
        tif = INPUT_DATA / rel
        if not tif.exists():
            print(f"  [skip] {kind}: missing {tif.name}")
            continue
        with rasterio.open(tif) as src:
            print(f"  {kind}: {src.width}x{src.height} {src.dtypes[0]} (computing for {len(a2)} districts)")
            for i, row in enumerate(a2.itertuples(index=False)):
                stats = zonal_for_polygon(src, row.geometry)
                if stats is None:
                    stats = {"sum": 0.0, "mean": 0.0, "max": 0.0, "count": 0}
                d = out.setdefault(row.id, {})
                d[f"{kind}_total"] = stats["sum"]
                d[f"{kind}_mean"] = stats["mean"]
                d[f"{kind}_max"] = stats["max"]
                d[f"{kind}_pixels"] = stats["count"]
                if (i + 1) % 50 == 0 or i + 1 == len(a2):
                    print(f"    [{i+1}/{len(a2)}] last id={row.id} sum={stats['sum']:.1f}")

    out_dir = OUT / code
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "_zonal_raw.json"
    out_path.write_text(json.dumps(out, default=str))
    print(f"  -> {out_path.name} ({len(out)} districts)")


def main(only_country: str | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    for c in COUNTRIES:
        if only_country and c["code"] != only_country:
            continue
        process_country(c)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
