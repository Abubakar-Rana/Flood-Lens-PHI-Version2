"""ETL for the July 2026 South Asia flood event.

Unlike the 2025 pipeline (which needs the 7 GB source-data/ tree), this script
runs entirely off files already committed to the repo:

  input   public/2026-data/Google Earth/*/UNION_*.tif   flood extent, ~100 m binary
          public/2026-data/*.docx                       published country tables
          public/web-data/<code>/admin2.topojson        district geometry
          public/web-data/<code>/stats.json             2025 baseline (density proxy)
          public/web-data/<code>/{health,schools}.geojson

  output  public/web-data/years.json                    year registry
          public/web-data/<code>/stats-2026.json        per-district event stats
          public/web-data/<code>/event-2026.json        country facts + extent bounds
          public/web-data/<code>/timeline.json          observed + projected series
          public/web-data/<code>/extent-2026.png        map overlay (max-pooled)

Everything the browser reads is precomputed here. The frontend does no math
heavier than a lookup, which is what keeps the dashboard fast as more event
years get added: one more stats-<year>.json + one registry entry, nothing else.

Run:  python scripts/etl/event2026.py [country_code]
"""
from __future__ import annotations

import json
import math
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import geopandas as gpd
import numpy as np
import rasterio
from PIL import Image
from rasterio.mask import mask as rio_mask
from shapely.geometry import mapping

ROOT = Path(__file__).resolve().parent.parent.parent
WEB = ROOT / "public" / "web-data"
SRC2026 = ROOT / "public" / "2026-data"
RASTER_DIR = SRC2026 / "Google Earth"

EVENT_ID = "2026"
EVENT_START = "2026-07-23"
EVENT_END = "2026-07-28"

# Country code -> (report name in the docx tables, UNION raster folder/file stem)
COUNTRIES = {
    "pak": ("Pakistan", "July_2026_Flood_PAK", "UNION_PAK_Pakistan_July_2026.tif"),
    "ind": ("India", "July_2026_Flood_IND", "UNION_IND_India_July_2026.tif"),
    "bgd": ("Bangladesh", "July_2026_Flood_BGD", "UNION_BGD_Bangladesh_July_2026.tif"),
    "npl": ("Nepal", "July_2026_Flood_NPL", "UNION_NPL_Nepal_July_2026.tif"),
    "btn": ("Bhutan", "July_2026_Flood_BTN", "UNION_BTN_Bhutan_July_2026.tif"),
    "lka": ("Sri Lanka", "July_2026_Flood_LKA", "UNION_LKA_Sri_Lanka_July_2026.tif"),
}

# Assumed annual growth of the population living in flood-exposed land, used
# only to project the risk outlook forward. These are stated assumptions, not
# measurements — the UI shows the value next to every projected point so the
# reader can discount it. Roughly national population growth.
EXPOSURE_GROWTH = {
    "pak": 0.019, "ind": 0.008, "bgd": 0.010,
    "npl": 0.009, "btn": 0.006, "lka": 0.004,
}
PROJECTION_YEARS = 6            # 2027 .. 2032
PIXEL_AREA_DEG = None           # filled per raster

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


# ─── docx table parsing ──────────────────────────────────────────────────

def _text(el) -> str:
    return "".join(t.text or "" for t in el.iter(f"{{{W_NS}}}t"))


def docx_tables(path: Path) -> list[list[list[str]]]:
    """Return every table in the document as a list of rows of cell strings."""
    root = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
    body = root.find(f"{{{W_NS}}}body")
    out = []
    for tbl in body.findall(f"{{{W_NS}}}tbl"):
        rows = []
        for tr in tbl.findall(f"{{{W_NS}}}tr"):
            rows.append([
                " ".join(_text(p).strip() for p in tc.findall(f"{{{W_NS}}}p")).strip()
                for tc in tr.findall(f"{{{W_NS}}}tc")
            ])
        rows and out.append(rows)
    return out


def num(s: str) -> float | None:
    """'1,421' -> 1421.0 ; '0.09%' -> 0.09 ; '—' -> None."""
    s = (s or "").strip().replace(",", "").replace("%", "").replace("−", "-")
    if not s or s in {"—", "-", "–"}:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def table_by_country(rows: list[list[str]], cols: dict[str, int]) -> dict[str, dict]:
    """Index a country-keyed appendix table into {report_name: {field: value}}."""
    out = {}
    for r in rows[1:]:
        name = r[0].strip()
        if not name or name.upper() == "TOTAL":
            continue
        out[name] = {k: num(r[i]) for k, i in cols.items() if i < len(r)}
    return out


def parse_appendix() -> dict[str, dict]:
    """Country facts from July_2026_appendix_summary.docx, keyed by report name."""
    tabs = docx_tables(SRC2026 / "July_2026_appendix_summary.docx")
    # Tables appear in document order: B extent/depth, C population, D
    # infrastructure, E urban/rural, F deep-water hazard.
    extent = table_by_country(tabs[0], {
        "extent_km2": 1, "depth_median_m": 2, "depth_mean_m": 3,
        "depth_p95_m": 4, "depth_max_m": 5})
    pop = table_by_country(tabs[1], {
        "pop_total_2025": 1, "affected_pop": 2, "affected_pop_pct": 3,
        "u18_total_2025": 4, "affected_u18": 5, "affected_u18_pct": 6})
    infra = table_by_country(tabs[2], {
        "schools_fwdet": 1, "hospitals_fwdet": 2,
        "roads_affected_km": 3, "roads_pct": 4})
    urban = table_by_country(tabs[3], {
        "pop_urban": 1, "pop_rural": 2, "urban_pct": 3, "rural_pct": 4,
        "u18_urban": 5, "u18_rural": 6})
    hazard = table_by_country(tabs[4], {
        "rp100_15m_km2": 1, "rp100_15m_pop": 2, "rp100_15m_u18": 3,
        "rp100_20m_km2": 4, "rp100_20m_pop": 5, "rp100_20m_u18": 6})

    facts: dict[str, dict] = {}
    for name in pop:
        facts[name] = {}
        for src in (extent, pop, infra, urban, hazard):
            facts[name].update(src.get(name, {}))
    return facts


def parse_pdma_points() -> list[dict]:
    """The 8 PDMA-reported Punjab locations plus their satellite verification."""
    tabs = docx_tables(SRC2026 / "PDMA_Pakistan_July_2026_report.docx")
    coords, verdicts = tabs[0], tabs[1]
    by_id = {}
    for r in coords[1:]:
        pid = r[0].strip()
        lat, lon = (num(x) for x in r[2].split(","))
        by_id[pid] = {"id": pid, "lat": lat, "lon": lon, "note": r[3].strip()}
    for r in verdicts[1:]:
        pid = r[0].strip()
        if pid not in by_id:
            continue
        by_id[pid].update({
            "union_extent": r[1].strip(),
            "fwdet_depth_m": num(r[2]),
            "rp100_depth_m": num(r[3]),
            "smod_class": r[4].strip(),
            "ndwi_change": num(r[5]),
        })
    return list(by_id.values())


# ─── raster helpers ──────────────────────────────────────────────────────

def px_km2_at(lat_deg: float, res_deg: float) -> float:
    """Area of one raster cell in km², at the given latitude (WGS84 cells)."""
    lat = math.radians(lat_deg)
    return (res_deg * 110.574) * (res_deg * 111.320 * math.cos(lat))


def district_flood_area(src, districts: gpd.GeoDataFrame) -> dict[str, float]:
    """Flooded km² per district: count UNION==1 cells inside each polygon."""
    res = src.res[0]
    out: dict[str, float] = {}
    for r in districts.itertuples(index=False):
        try:
            arr, _ = rio_mask(src, [mapping(r.geometry)], crop=True,
                              filled=True, nodata=0)
        except ValueError:
            out[r.id] = 0.0        # polygon lies outside the raster footprint
            continue
        n = int((arr[0] == 1).sum())
        lat = r.center_lat if r.center_lat is not None else 0.0
        out[r.id] = n * px_km2_at(lat, res) if n else 0.0
    return out


def sample_points(src, geojson_path: Path,
                  radius_km: float = 1.0) -> list[tuple[float, float]]:
    """Point features lying within `radius_km` of observed flooding.

    An exact cell hit is the wrong test here: the UNION mask is ~100 m and
    mostly 1–3 cells wide, so a facility centroid almost never lands on one
    (Pakistan scores 0 out of 469 that way). What matters operationally is
    proximity — a hospital 300 m from a flooded river is disrupted. We read a
    square window around each point and flag it if any cell inside is flooded.
    """
    if not geojson_path.exists():
        return []
    fc = json.loads(geojson_path.read_text(encoding="utf-8"))
    pts = [f["geometry"]["coordinates"][:2] for f in fc["features"]
           if f.get("geometry", {}).get("type") == "Point"]
    if not pts:
        return []

    res = src.res[0]
    hits = []
    for lon, lat in pts:
        # Degrees per km varies with latitude for longitude, not for latitude.
        dlat = radius_km / 110.574
        dlon = radius_km / max(1e-6, 111.320 * math.cos(math.radians(lat)))
        row0, col0 = src.index(lon - dlon, lat + dlat)
        row1, col1 = src.index(lon + dlon, lat - dlat)
        row0, row1 = max(0, row0), min(src.height, row1 + 1)
        col0, col1 = max(0, col0), min(src.width, col1 + 1)
        if row1 <= row0 or col1 <= col0:
            continue
        win = src.read(1, window=((row0, row1), (col0, col1)))
        if (win == 1).any():
            hits.append((lon, lat))
    return hits


def write_extent_png(src, out_path: Path, max_dim: int = 1400) -> dict:
    """Max-pooled RGBA overlay of the flood mask.

    Max-pooling (rather than averaging or nearest-neighbour) is deliberate: the
    flood mask is mostly 1–3 cell wide river threads, which vanish entirely
    under any downsampling that isn't a max. Any block containing flood stays
    lit, so the overlay reads correctly at every zoom level.
    """
    factor = max(1, math.ceil(max(src.width, src.height) / max_dim))
    h, w = src.height, src.width
    ph, pw = math.ceil(h / factor), math.ceil(w / factor)

    pooled = np.zeros((ph, pw), dtype=np.uint8)
    # Stream by row-blocks so the full-resolution array is never materialised.
    for by in range(ph):
        y0 = by * factor
        y1 = min(h, y0 + factor)
        band = src.read(1, window=((y0, y1), (0, w)))
        band = (band == 1)
        pad = (-band.shape[1]) % factor
        if pad:
            band = np.pad(band, ((0, 0), (0, pad)))
        pooled[by] = band.reshape(band.shape[0], -1, factor).any(axis=(0, 2))

    rgba = np.zeros((ph, pw, 4), dtype=np.uint8)
    on = pooled.astype(bool)
    rgba[on] = (56, 189, 248, 235)          # sky-400, near-opaque
    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out_path, optimize=True)

    b = src.bounds
    return {
        "url": f"/web-data/{out_path.parent.name}/{out_path.name}",
        "bounds": [[b.bottom, b.left], [b.top, b.right]],   # leaflet [[s,w],[n,e]]
        "width": pw, "height": ph, "downsample_factor": factor,
    }


# ─── risk outlook ────────────────────────────────────────────────────────

def expected_annual_impact(observed: float, rp100: float) -> tuple[float, float]:
    """Integrate a power-law severity curve into an expected annual impact.

    Two points anchor the curve: the observed July 2026 event, treated as a
    frequent (~1-in-2-year) occurrence, and the published JRC RP100y deep-water
    figure. E(RP) = a·RP^b is fitted through them and integrated over exceedance
    probability from RP=2 to RP=100 — the standard expected-annual-damage form,
    applied to people instead of currency. Returns (expected_annual, exponent).
    """
    if observed <= 0 or rp100 <= 0 or rp100 <= observed:
        return observed, 0.0
    b = math.log(rp100 / observed) / math.log(50.0)
    a = observed / (2.0 ** b)
    # ∫ E dP over P ∈ [0.01, 0.5], trapezoid on a log-spaced RP grid.
    rps = np.logspace(math.log10(2.0), math.log10(100.0), 64)
    e = a * rps ** b
    p = 1.0 / rps
    ead = float(-np.trapezoid(e, p))        # p decreases as rp increases
    return ead, b


# Fields that exist in both the 2025 and the 2026 stats tables, so a series
# can actually be drawn across the two. 'flood_extent_km2' is deliberately
# absent — it is only measured for an observed event.
TIMELINE_METRICS = [
    ("affected_pop_total", "People affected"),
    ("affected_child_pop_total", "Children affected"),
    ("health_count", "Health facilities affected"),
    ("school_count", "Schools affected"),
]


def project_next_year(v2025: float, v2026: float, growth: float) -> float:
    """Expected value for the next year, given two very different observed ones.

    A straight-line fit through two points is useless here: nationally the 2025
    and 2026 totals differ by 5x (Bangladesh) to 269x (Nepal), so a linear
    extrapolation of that slope either collapses to zero or explodes. Floods are
    multiplicative and heavy-tailed, so the central estimate is the geometric
    mean of the observed years — a typical year sitting between a severe one and
    a mild one — nudged by the assumed growth in exposed population.
    """
    if v2025 <= 0 and v2026 <= 0:
        return 0.0
    if v2025 <= 0:
        return v2026 * (1 + growth)
    if v2026 <= 0:
        return v2025 * (1 + growth)
    return math.sqrt(v2025 * v2026) * (1 + growth)


def build_timeline(code: str, totals_2025: dict, totals_2026: dict,
                   rp100: float, extra: dict) -> dict:
    """Per-metric series across 2025, 2026 and one projected year.

    One entry per metric so the chart can follow whichever question the reader
    picked, instead of being locked to population.
    """
    g = EXPOSURE_GROWTH.get(code, 0.01)
    observed_pop = totals_2026.get("affected_pop_total", 0.0)
    ead, exponent = expected_annual_impact(observed_pop, rp100)

    metrics = {}
    for key, label in TIMELINE_METRICS:
        v25 = float(totals_2025.get(key, 0.0) or 0.0)
        v26 = float(totals_2026.get(key, 0.0) or 0.0)
        central = project_next_year(v25, v26, g)
        metrics[key] = {
            "label": label,
            "points": [
                {"year": 2025, "value": v25, "kind": "observed"},
                {"year": 2026, "value": v26, "kind": "observed"},
                {
                    "year": 2027,
                    "value": central,
                    # Band spans half to double the assumed growth, floored at
                    # the milder observed year and capped at the severe one —
                    # next year is not expected to beat either record.
                    "low": max(min(v25, v26), central * (1 - g * 4)),
                    "high": min(max(v25, v26), central * (1 + g * 4)),
                    "kind": "projected",
                },
            ],
        }

    return {
        "metrics": metrics,
        "expected_annual": ead,
        "scenario": {
            "label": "1-in-100-year flood",
            "value": rp100,
            "u18": extra.get("rp100_15m_u18"),
            "area_km2": extra.get("rp100_15m_km2"),
            "source": "JRC CEMS-GLOFAS RP100y (≥1.5 m) ∩ observed extent",
        },
        "assumptions": {
            "exposure_growth_pct_per_year": round(g * 100, 2),
            "severity_exponent": round(exponent, 3),
            "method": "geometric mean of the two observed years × exposure growth",
            "note": ("2027 is an expected typical year, not a forecast of any "
                     "single flood. 2025 and 2026 were very different flood "
                     "years; the projection sits between them."),
        },
    }


# ─── per-country build ───────────────────────────────────────────────────

def process(code: str, facts: dict[str, dict]) -> dict:
    report_name, folder, tif_name = COUNTRIES[code]
    cdir = WEB / code
    tif = RASTER_DIR / folder / tif_name
    if not tif.exists():
        raise FileNotFoundError(tif)

    f = facts.get(report_name)
    if f is None:
        raise KeyError(f"{report_name} missing from the appendix tables")

    districts = gpd.read_file(cdir / "admin2.topojson").set_crs("EPSG:4326")
    base = json.loads((cdir / "stats.json").read_text(encoding="utf-8"))

    with rasterio.open(tif) as src:
        flood_km2 = district_flood_area(src, districts)
        health_hits = sample_points(src, cdir / "health.geojson")
        school_hits = sample_points(src, cdir / "schools.geojson")
        overlay = write_extent_png(src, cdir / f"extent-{EVENT_ID}.png")

    # Which district each flooded facility sits in — spatial join beats a
    # nested point-in-polygon loop by a wide margin at this feature count.
    def assign(hits: list[tuple[float, float]]) -> dict[str, int]:
        if not hits:
            return {}
        pts = gpd.GeoDataFrame(
            geometry=gpd.points_from_xy([h[0] for h in hits], [h[1] for h in hits]),
            crs="EPSG:4326")
        joined = gpd.sjoin(pts, districts[["id", "geometry"]],
                           how="inner", predicate="within")
        return joined["id"].value_counts().to_dict()

    health_by_d = assign(health_hits)
    school_by_d = assign(school_hits)

    # Apportion the published national affected-population total across
    # districts. Weight = flooded km² × people per km² of flood-prone land,
    # the latter read off the 2025 raster mean (people per ~100 m cell × 100).
    # The flooded area itself is measured; only the split is modelled.
    nat_pop = f.get("affected_pop") or 0.0
    nat_u18 = f.get("affected_u18") or 0.0
    dens = {}
    for did, d in base.items():
        m = d.get("affected_pop_mean") or 0.0
        dens[did] = m * 100.0
    positive = [v for v in dens.values() if v > 0]
    fallback = float(np.median(positive)) if positive else 1.0

    weights = {}
    for did, km2 in flood_km2.items():
        if km2 <= 0:
            weights[did] = 0.0
            continue
        weights[did] = km2 * (dens.get(did) or fallback)
    wsum = sum(weights.values()) or 1.0
    pop_by_d = {did: nat_pop * (w / wsum) for did, w in weights.items()}

    # The under-18 split is normalised to the published national U18 total, not
    # carried over from 2025. The two years measure different things (standing
    # exposure vs a single event) and their national child shares differ by a
    # factor of ~5, so the 2025 share is only usable as a *relative* weight
    # between districts. Districts with no 2025 child signal fall back to the
    # national mean share so a flooded district never reports zero children.
    shares = {did: (base.get(did, {}).get("child_share_pct") or 0.0) / 100.0
              for did in flood_km2}
    live = [s for did, s in shares.items() if s > 0 and pop_by_d.get(did, 0) > 0]
    mean_share = float(np.mean(live)) if live else 1.0
    u18_w = {did: pop_by_d.get(did, 0.0) * (shares[did] or mean_share)
             for did in flood_km2}
    u18_sum = sum(u18_w.values()) or 1.0
    u18_by_d = {did: nat_u18 * (w / u18_sum) for did, w in u18_w.items()}

    rows: dict[str, dict] = {}
    for r in districts.itertuples(index=False):
        did = r.id
        b = base.get(did, {})
        km2 = flood_km2.get(did, 0.0)
        pop = pop_by_d.get(did, 0.0)
        u18 = min(u18_by_d.get(did, 0.0), pop)
        area = float(r.area_sqkm or 0.0)
        hc = int(health_by_d.get(did, 0))
        sc = int(school_by_d.get(did, 0))

        rows[did] = {
            "name": r.name,
            "parent_id": r.parent_id,
            "parent_name": r.parent_name,
            "area_sqkm": area,
            "center_lat": r.center_lat,
            "center_lon": r.center_lon,

            # Measured directly from the UNION raster.
            "flood_extent_km2": km2,
            "flood_extent_pct": (km2 / area * 100.0) if area > 0 else 0.0,

            # Apportioned from the published national totals.
            "affected_pop_total": pop,
            "affected_pop_mean": (b.get("affected_pop_mean") or 0.0),
            "affected_pop_max": (b.get("affected_pop_max") or 0.0),
            "affected_pop_density": (pop / area) if area > 0 else 0.0,
            "affected_child_pop_total": u18,
            "affected_child_pop_mean": (b.get("affected_child_pop_mean") or 0.0),
            "affected_child_pop_max": (b.get("affected_child_pop_max") or 0.0),
            "child_share_pct": (u18 / pop * 100.0) if pop > 0 else 0.0,

            # Measured: facilities standing inside the observed flood extent.
            "health_count": hc,
            "school_count": sc,
            "health_per_1k_sqkm": (hc * 1000.0 / area) if area > 0 else 0.0,
            "school_per_1k_sqkm": (sc * 1000.0 / area) if area > 0 else 0.0,
            "health_per_100k_affected": (hc * 1e5 / pop) if pop > 0 else 0.0,
            "school_per_100k_affected_children": (sc * 1e5 / u18) if u18 > 0 else 0.0,
            "health_amenity_breakdown": {},
        }

    (cdir / f"stats-{EVENT_ID}.json").write_text(
        json.dumps(rows, separators=(",", ":")), encoding="utf-8")

    measured_extent = sum(flood_km2.values())
    rp100 = f.get("rp100_15m_pop") or 0.0

    def sum_field(table: dict, key: str) -> float:
        return sum(float(d.get(key) or 0.0) for d in table.values())

    totals_2025 = {k: sum_field(base, k) for k, _ in TIMELINE_METRICS}
    totals_2026 = {k: sum_field(rows, k) for k, _ in TIMELINE_METRICS}

    event = {
        "event_id": EVENT_ID,
        "country_code": code,
        "country_name": report_name,
        "window": {"start": EVENT_START, "end": EVENT_END},
        "published": f,
        "measured": {
            "flood_extent_km2": measured_extent,
            "districts_flooded": sum(1 for v in flood_km2.values() if v > 0),
            "districts_total": len(flood_km2),
            "health_near_flood": len(health_hits),
            "schools_near_flood": len(school_hits),
            "proximity_radius_km": 1.0,
        },
        "overlay": overlay,
        "totals": {
            "affected_pop_total": nat_pop,
            "affected_child_pop_total": nat_u18,
            "health_count": sum(health_by_d.values()),
            "school_count": sum(school_by_d.values()),
            "area_sqkm": sum(float(r.area_sqkm or 0) for r in
                             districts.itertuples(index=False)),
            "district_count": len(flood_km2),
            "health_amenity_breakdown": {},
        },
    }
    if code == "pak":
        event["pdma_points"] = parse_pdma_points()

    (cdir / f"event-{EVENT_ID}.json").write_text(
        json.dumps(event, separators=(",", ":")), encoding="utf-8")

    timeline = build_timeline(code, totals_2025, totals_2026, rp100, f)
    (cdir / "timeline.json").write_text(
        json.dumps(timeline, separators=(",", ":")), encoding="utf-8")
    event["timeline"] = timeline

    print(f"[{code}] extent {measured_extent:,.0f} km² "
          f"(published {f.get('extent_km2'):,.0f}) · "
          f"{event['measured']['districts_flooded']}/{len(flood_km2)} districts · "
          f"health {len(health_hits)} · schools {len(school_hits)} · "
          f"overlay {overlay['width']}x{overlay['height']}")
    return event


def write_all_country_timelines(events: dict[str, dict]) -> None:
    """One small file holding every country's series for every metric.

    The cross-country chart needs all six at once. Six separate fetches would
    work — they are cached — but this is a couple of KB and turns the chart's
    cold start into a single request, so switching country never re-fetches
    anything the chart already has.
    """
    out = {
        "metrics": [k for k, _ in TIMELINE_METRICS],
        "labels": {k: label for k, label in TIMELINE_METRICS},
        "years": [2025, 2026, 2027],
        "countries": [
            {
                "code": code,
                "name": ev["country_name"],
                "series": {
                    key: ev["timeline"]["metrics"][key]["points"]
                    for key, _ in TIMELINE_METRICS
                },
            }
            for code, ev in events.items()
        ],
    }
    (WEB / "timelines.json").write_text(
        json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"[registry] timelines.json · {len(out['countries'])} countries × "
          f"{len(TIMELINE_METRICS)} metrics")


def write_registry(events: dict[str, dict]) -> None:
    registry = {
        "years": [
            {
                "id": "2025",
                "label": "2025 Baseline",
                "short": "2025",
                "kind": "exposure",
                "headline": "People living in flood-prone land",
                "blurb": ("Everyone whose home sits inside a mapped flood-prone "
                          "zone — the standing risk, not a single flood."),
                "statsFile": "stats.json",
                "window": None,
            },
            {
                "id": EVENT_ID,
                "label": "2026 July Flood",
                "short": "2026",
                "kind": "event",
                "headline": "People hit by the July 2026 flood",
                "blurb": ("What the satellites actually saw flooded between "
                          f"{EVENT_START} and {EVENT_END}."),
                "statsFile": f"stats-{EVENT_ID}.json",
                "eventFile": f"event-{EVENT_ID}.json",
                "window": {"start": EVENT_START, "end": EVENT_END},
            },
        ],
        "defaultYear": EVENT_ID,
        "projectionRange": [2027, 2026 + PROJECTION_YEARS],
    }
    (WEB / "years.json").write_text(
        json.dumps(registry, indent=2), encoding="utf-8")
    print(f"[registry] years.json · {len(events)} countries with {EVENT_ID} data")


def main(only: str | None = None) -> None:
    facts = parse_appendix()
    events = {}
    for code in COUNTRIES:
        if only and code != only:
            continue
        events[code] = process(code, facts)
    if not only:
        write_all_country_timelines(events)
        write_registry(events)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
