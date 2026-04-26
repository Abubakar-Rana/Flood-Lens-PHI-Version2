"""Convert health/schools point shapefiles to web-ready GeoJSON.

For India schools: source file contains rows mislabeled as country=Bangladesh.
We filter by *spatial* containment in the IND admin2 union (real geometry,
not the bad attribute), so only points actually inside India survive.

Output: only the columns the frontend needs.
"""
import json
import sys
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import COUNTRIES, INPUT_BOUND, INPUT_DATA, OUT


HEALTH_KEEP = ["name", "amenity", "healthcare", "addr_city", "osm_id", "osm_type"]
SCHOOL_KEEP = ["name", "amenity", "addr_city", "osm_id", "osm_type"]


def load_country_polygon(country: dict) -> gpd.GeoDataFrame:
    """Return a single-row GeoDataFrame of the country boundary in EPSG:4326."""
    if "admin0" in country["boundaries"]:
        gdf = gpd.read_file(INPUT_BOUND / country["boundaries"]["admin0"])
    else:
        # India: dissolve admin2
        a2 = gpd.read_file(INPUT_BOUND / country["boundaries"]["admin2"])
        gdf = a2.dissolve()
    return gdf.to_crs("EPSG:4326")


def process_points(country: dict, kind: str, keep_cols: list[str]):
    code = country["code"]
    rel = country["points"].get(kind)
    if not rel:
        return
    src = INPUT_DATA / rel
    if not src.exists():
        print(f"  [skip] {code} {kind}: missing {src.name}")
        return

    gdf = gpd.read_file(src).to_crs("EPSG:4326")
    n_in = len(gdf)

    # Spatial filter to true country boundary (handles IND mislabeled rows)
    poly = load_country_polygon(country)
    gdf = gpd.sjoin(gdf, poly[["geometry"]], how="inner", predicate="within")
    gdf = gdf.drop(columns=[c for c in gdf.columns if c.startswith("index_right")])
    n_kept = len(gdf)

    # Drop columns we don't need; preserve geometry
    cols = [c for c in keep_cols if c in gdf.columns] + ["geometry"]
    gdf = gdf[cols]
    # Coerce NaN to None for clean JSON
    gdf = gdf.where(gdf.notna(), None)

    out_dir = OUT / code
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{kind}.geojson"
    gdf.to_file(out_path, driver="GeoJSON")
    sz = out_path.stat().st_size
    note = f" (filtered {n_in-n_kept} outside country)" if n_kept != n_in else ""
    print(f"  {code} {kind}: {n_kept}/{n_in} points -> {sz/1024:.1f} KB{note}")


def main(only_country: str | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    for c in COUNTRIES:
        if only_country and c["code"] != only_country:
            continue
        print(f"[points] {c['code']} ({c['name']})")
        process_points(c, "health", HEALTH_KEEP)
        process_points(c, "schools", SCHOOL_KEEP)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
