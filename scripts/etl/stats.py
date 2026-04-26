"""Combine zonal-stats + point counts + DBF area into a single per-district
stats.json that drives every choropleth and chart in the UI.

Inputs (per country):
  public/web-data/{code}/_zonal_raw.json    (from zonal_stats.py)
  public/web-data/{code}/health.geojson     (from points.py)
  public/web-data/{code}/schools.geojson    (from points.py)
  public/Boundries/{country admin2 shp}     (for area_sqkm + parent linkage)

Output:
  public/web-data/{code}/stats.json

Schema per district id:
  {
    affected_pop_total, affected_pop_mean, affected_pop_max,
    affected_child_pop_total, affected_child_pop_mean, affected_child_pop_max,
    child_share_pct,
    health_count, school_count,
    health_per_1k_sqkm, school_per_1k_sqkm,
    health_per_100k_affected, school_per_100k_affected_children,
    health_amenity_breakdown: { hospital: N, clinic: N, ... },
    area_sqkm, center_lat, center_lon,
    parent_id, parent_name, name
  }

Per-country totals are written separately to public/web-data/{code}/totals.json
so the country-comparison view loads instantly.
"""
import json
import sys
from collections import Counter
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import COUNTRIES, INPUT_BOUND, OUT, normalize_admin_props


def safe_div(a: float, b: float) -> float:
    return float(a) / float(b) if b else 0.0


def load_zonal(code: str) -> dict:
    p = OUT / code / "_zonal_raw.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def count_points_per_district(points_path: Path, admin2: gpd.GeoDataFrame, group_by: str | None = None):
    """Return (count_per_id, breakdown_per_id_or_None).
    breakdown is dict[id] -> Counter of values for `group_by` column."""
    if not points_path.exists():
        return {}, {}
    pts = gpd.read_file(points_path).to_crs("EPSG:4326")
    if pts.empty:
        return {}, {}
    j = gpd.sjoin(pts, admin2[["id", "geometry"]], how="left", predicate="within")
    counts: dict[str, int] = {}
    breakdown: dict[str, dict] = {}
    for _, row in j.iterrows():
        rid = row.get("id")
        if not isinstance(rid, str):
            continue
        counts[rid] = counts.get(rid, 0) + 1
        if group_by and group_by in j.columns:
            v = row.get(group_by)
            if v is None or (isinstance(v, float) and v != v):  # NaN
                v = "unknown"
            breakdown.setdefault(rid, Counter())[str(v)] += 1
    breakdown = {k: dict(v) for k, v in breakdown.items()}
    return counts, breakdown


def process_country(country: dict):
    code = country["code"]
    schema = country["schema"]
    out_dir = OUT / code
    print(f"[stats] {code} ({country['name']})")

    a2 = gpd.read_file(INPUT_BOUND / country["boundaries"]["admin2"])
    a2 = normalize_admin_props(a2, 2, schema).to_crs("EPSG:4326")

    zonal = load_zonal(code)
    health_counts, health_breakdown = count_points_per_district(
        out_dir / "health.geojson", a2, group_by="amenity")
    school_counts, _ = count_points_per_district(out_dir / "schools.geojson", a2)

    stats: dict[str, dict] = {}
    for row in a2.itertuples(index=False):
        rid = row.id
        z = zonal.get(rid, {})
        ap = float(z.get("affected_pop_total", 0.0))
        ac = float(z.get("affected_child_pop_total", 0.0))
        area = float(row.area_sqkm or 0.0)
        hc = int(health_counts.get(rid, 0))
        sc = int(school_counts.get(rid, 0))
        stats[rid] = {
            "name": row.name,
            "parent_id": row.parent_id,
            "parent_name": row.parent_name,
            "area_sqkm": area,
            "center_lat": float(row.center_lat) if row.center_lat is not None else None,
            "center_lon": float(row.center_lon) if row.center_lon is not None else None,
            "affected_pop_total": ap,
            "affected_pop_mean": float(z.get("affected_pop_mean", 0.0)),
            "affected_pop_max": float(z.get("affected_pop_max", 0.0)),
            "affected_child_pop_total": ac,
            "affected_child_pop_mean": float(z.get("affected_child_pop_mean", 0.0)),
            "affected_child_pop_max": float(z.get("affected_child_pop_max", 0.0)),
            "child_share_pct": safe_div(ac, ap) * 100.0,
            "health_count": hc,
            "school_count": sc,
            "health_per_1k_sqkm": safe_div(hc * 1000.0, area),
            "school_per_1k_sqkm": safe_div(sc * 1000.0, area),
            "health_per_100k_affected": safe_div(hc * 100000.0, ap),
            "school_per_100k_affected_children": safe_div(sc * 100000.0, ac),
            "affected_pop_density": safe_div(ap, area),
            "health_amenity_breakdown": health_breakdown.get(rid, {}),
        }

    # Country-level totals
    totals = {
        "affected_pop_total": sum(s["affected_pop_total"] for s in stats.values()),
        "affected_child_pop_total": sum(s["affected_child_pop_total"] for s in stats.values()),
        "health_count": sum(s["health_count"] for s in stats.values()),
        "school_count": sum(s["school_count"] for s in stats.values()),
        "area_sqkm": sum(s["area_sqkm"] for s in stats.values()),
        "district_count": len(stats),
        "health_amenity_breakdown": dict(sum(
            (Counter(s["health_amenity_breakdown"]) for s in stats.values()),
            Counter())),
    }

    (out_dir / "stats.json").write_text(json.dumps(stats, default=str))
    (out_dir / "totals.json").write_text(json.dumps(totals, indent=2, default=str))
    sz = (out_dir / "stats.json").stat().st_size
    print(f"  -> stats.json ({len(stats)} districts, {sz/1024:.1f} KB)")
    print(f"  -> totals.json: pop={totals['affected_pop_total']:.0f} child={totals['affected_child_pop_total']:.0f} "
          f"health={totals['health_count']} schools={totals['school_count']}")


def main(only_country: str | None = None):
    for c in COUNTRIES:
        if only_country and c["code"] != only_country:
            continue
        process_country(c)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
