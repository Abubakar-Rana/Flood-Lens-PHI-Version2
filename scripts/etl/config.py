"""Shared config for the ETL pipeline.

Defines the country registry and the canonical output schema. Every country —
regardless of source schema (HDX COD vs geoBoundaries) — exports the same
property names so the frontend doesn't need per-country branching.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
# Source data (shapefiles, GeoTIFFs) lives outside public/ so Next.js doesn't
# scan it. Only the ETL output goes into public/ for browser access.
INPUT_BOUND = ROOT / "source-data" / "Boundries"
INPUT_DATA = ROOT / "source-data" / "Data"
OUT = ROOT / "public" / "web-data"

# Mapshaper simplification: visvalingam, percentage of vertices to retain.
# Higher = more faithful boundary. 15% is conservative — district shapes
# stay clearly recognizable, country/province perfect.
SIMPLIFY_PCT = "15%"


COUNTRIES = [
    {
        "code": "pak",
        "name": "Pakistan",
        "schema": "hdx",
        "boundaries": {
            "admin0": "pak_admin0.shp",
            "admin1": "pak_admin1.shp",
            "admin2": "pak_admin2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/Pakistan Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/Pakistan Child Affected.tif",
        },
        "points": {
            "health": "Affected_Health_facilities/Pakistan/Pakistan_health.shp",
            "schools": "Affected_Schools/Pakistan/Pakistan.shp",
        },
    },
    {
        "code": "ind",
        "name": "India",
        "schema": "geoboundaries",
        "boundaries": {
            # India only has admin2 in this dataset. ETL will derive admin0
            # as the dissolved union of admin2 polygons. No admin1 layer.
            "admin2": "geoBoundaries-IND-ADM2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/India Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/India Child Affected.tif",
        },
        "points": {
            # The IND schools file contains rows mislabeled as country=Bangladesh.
            # ETL filters to points spatially inside the IND admin0 (derived).
            "health": "Affected_Health_facilities/India/India_health.shp",
            "schools": "Affected_Schools/India/India.shp",
        },
    },
    {
        "code": "bgd",
        "name": "Bangladesh",
        "schema": "hdx",
        "boundaries": {
            "admin0": "bgd_admin0.shp",
            "admin1": "bgd_admin1.shp",
            "admin2": "bgd_admin2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/Bangladesh Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/Bangladesh Child Affected.tif",
        },
        "points": {
            "health": "Affected_Health_facilities/Bangladesh/Bangladesh_health.shp",
            "schools": "Affected_Schools/Bangladesh/Bangladesh.shp",
        },
    },
    {
        "code": "npl",
        "name": "Nepal",
        "schema": "hdx",
        "boundaries": {
            "admin0": "npl_admin0.shp",
            "admin1": "npl_admin1.shp",
            "admin2": "npl_admin2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/Nepal Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/Nepal Child Affected.tif",
        },
        "points": {
            "health": "Affected_Health_facilities/Nepal/Nepal_health.shp",
            "schools": "Affected_Schools/Nepal/Nepal.shp",
        },
    },
    {
        "code": "btn",
        "name": "Bhutan",
        "schema": "hdx",
        "boundaries": {
            "admin0": "btn_admin0.shp",
            "admin1": "btn_admin1.shp",
            "admin2": "btn_admin2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/Bhutan Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/Bhutan Child Affected.tif",
        },
        "points": {
            "health": "Affected_Health_facilities/Bhutan/Bhutan_health.shp",
            "schools": "Affected_Schools/Bhutan/Bhutan.shp",
        },
    },
    {
        "code": "lka",
        "name": "SriLanka",
        "schema": "hdx",
        "boundaries": {
            "admin0": "lka_admin0.shp",
            "admin1": "lka_admin1.shp",
            "admin2": "lka_admin2.shp",
        },
        "rasters": {
            "affected_pop": "Affectde_Population/Srilanka Affected Pop.tif",
            "affected_child_pop": "Affected_Child_Population/Srilanka Child Affected.tif",
        },
        "points": {
            # Sri Lanka folder ships two variants per kind. We use the larger
            # files (1138 health, 2759 schools) — the smaller ones are very
            # sparse subsets (9 health, ~2780 schools) and would underrepresent
            # the country.
            "health": "Affected_Health_facilities/Srilanka/Srilanka Health.shp",
            "schools": "Affected_Schools/Srilanka/Affected Schools Srilanka.shp",
        },
    },
]


def normalize_admin_props(gdf, level: int, schema: str):
    """Map source columns to the canonical schema:
    id, name, parent_id, parent_name, area_sqkm, center_lat, center_lon.
    """
    out = gdf.copy()
    if schema == "hdx":
        if level == 0:
            out["id"] = out["adm0_pcode"]
            out["name"] = out["adm0_name"]
            out["parent_id"] = None
            out["parent_name"] = None
        elif level == 1:
            out["id"] = out["adm1_pcode"]
            out["name"] = out["adm1_name"]
            out["parent_id"] = out["adm0_pcode"]
            out["parent_name"] = out["adm0_name"]
        elif level == 2:
            out["id"] = out["adm2_pcode"]
            out["name"] = out["adm2_name"]
            out["parent_id"] = out["adm1_pcode"]
            out["parent_name"] = out["adm1_name"]
        for col in ["area_sqkm", "center_lat", "center_lon"]:
            if col not in out.columns:
                out[col] = None
    elif schema == "geoboundaries":
        out["id"] = out["shapeID"]
        out["name"] = out["shapeName"]
        out["parent_id"] = None
        out["parent_name"] = None
        # geoBoundaries doesn't ship area/centroid — compute from geometry.
        # We use planar centroid in EPSG:4326 (lon/lat) — fine for tooltip
        # placement and bbox math, NOT for distance calculations.
        out["area_sqkm"] = out.to_crs("EPSG:6933").geometry.area / 1e6
        cent = out.geometry.centroid
        out["center_lat"] = cent.y
        out["center_lon"] = cent.x
    keep = ["id", "name", "parent_id", "parent_name", "area_sqkm",
            "center_lat", "center_lon", "geometry"]
    return out[keep]
