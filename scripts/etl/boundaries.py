"""Convert each country's admin shapefiles to web-ready TopoJSON.

Pipeline per file:
  shapefile -> geopandas (normalize schema) -> intermediate GeoJSON
            -> mapshaper -simplify visvalingam keep-shapes -> TopoJSON
            -> public/web-data/{country}/admin{N}.topojson

Mapshaper's `keep-shapes` flag guarantees no district is dropped during
simplification, even on tiny islands. `visvalingam` is topology-aware so
shared boundaries between adjacent districts stay coincident (no slivers).

For India (no admin0 in source), admin0 is derived by dissolving admin2.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import COUNTRIES, INPUT_BOUND, OUT, SIMPLIFY_PCT, normalize_admin_props


def run_mapshaper(in_geojson: Path, out_topojson: Path):
    out_topojson.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "npx", "-y", "mapshaper",
        str(in_geojson),
        "-simplify", "visvalingam", SIMPLIFY_PCT, "keep-shapes",
        "-o", "format=topojson", "id-field=id", str(out_topojson),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    if r.returncode != 0:
        raise RuntimeError(f"mapshaper failed: {r.stderr}\n{r.stdout}")
    return out_topojson.stat().st_size


def derive_admin0_from_admin2(admin2_gdf: gpd.GeoDataFrame, country_name: str, iso3: str) -> gpd.GeoDataFrame:
    """For India: dissolve admin2 polygons into a single country polygon."""
    dissolved = admin2_gdf.dissolve()
    dissolved["id"] = iso3
    dissolved["name"] = country_name
    dissolved["parent_id"] = None
    dissolved["parent_name"] = None
    dissolved["area_sqkm"] = dissolved.to_crs("EPSG:6933").geometry.area / 1e6
    cent = dissolved.geometry.centroid
    dissolved["center_lat"] = cent.y
    dissolved["center_lon"] = cent.x
    keep = ["id", "name", "parent_id", "parent_name",
            "area_sqkm", "center_lat", "center_lon", "geometry"]
    return dissolved[keep]


def process_country(country: dict):
    code = country["code"]
    name = country["name"]
    schema = country["schema"]
    out_dir = OUT / code
    out_dir.mkdir(parents=True, exist_ok=True)

    # Track the admin2 GeoDataFrame so we can derive admin0 for India if needed
    admin2_gdf = None

    for level_str, fname in country["boundaries"].items():
        level = int(level_str.replace("admin", ""))
        in_shp = INPUT_BOUND / fname
        if not in_shp.exists():
            print(f"  [skip] {code} {level_str}: missing {fname}")
            continue

        gdf = gpd.read_file(in_shp)
        gdf = normalize_admin_props(gdf, level, schema)
        # Coerce nulls to empty so mapshaper preserves keys
        gdf = gdf.where(gdf.notna(), None)

        if level == 2:
            admin2_gdf = gdf

        with tempfile.TemporaryDirectory() as td:
            tmp_geojson = Path(td) / f"{code}_admin{level}.geojson"
            gdf.to_file(tmp_geojson, driver="GeoJSON")
            out_topojson = out_dir / f"admin{level}.topojson"
            sz = run_mapshaper(tmp_geojson, out_topojson)
            print(f"  {code} admin{level}: {len(gdf)} features -> {sz/1024:.1f} KB")

    # India fallback: derive admin0 by dissolving admin2
    if "admin0" not in country["boundaries"] and admin2_gdf is not None:
        a0 = derive_admin0_from_admin2(admin2_gdf, name, code.upper())
        with tempfile.TemporaryDirectory() as td:
            tmp_geojson = Path(td) / f"{code}_admin0.geojson"
            a0.to_file(tmp_geojson, driver="GeoJSON")
            out_topojson = out_dir / "admin0.topojson"
            sz = run_mapshaper(tmp_geojson, out_topojson)
            print(f"  {code} admin0 (derived): -> {sz/1024:.1f} KB")


def main(only_country: str | None = None):
    if not shutil.which("npx") and not shutil.which("npx.cmd"):
        raise SystemExit("npx not found on PATH")
    OUT.mkdir(parents=True, exist_ok=True)
    for c in COUNTRIES:
        if only_country and c["code"] != only_country:
            continue
        print(f"[boundaries] {c['code']} ({c['name']})")
        process_country(c)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
