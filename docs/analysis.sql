-- Toronto Spatial Analysis — reproducible DuckDB SQL
-- Daniel Spurr, 2026
--
-- Setup:
--   INSTALL spatial; INSTALL h3 FROM community;
--   LOAD spatial; LOAD h3;
--
-- Source files (download from City of Toronto Open Data CKAN + Overpass API):
--   trees.gpkg            street-tree-data-4326.gpkg
--   neighbourhoods.geojson  neighbourhoods-4326.geojson
--   centreline.gpkg       centreline-version-2-4326.gpkg
--   buildings.gpkg        building-outlines-4326.gpkg
--   rnfpa/RAVINE_BYLAW_WGS84.shp  ravine-natural-feature-protection-area-wgs84.zip
--   esa.geojson           environmentally-significant-areas-4326.geojson
--   chargers.csv          Overpass: node[amenity=charging_station](43.40,-80.05,44.05,-78.85)
--
-- CONVENTION: every metric computation (length, area, distance, buffer) is done in
-- EPSG:32617 (UTM 17N). Doing these in EPSG:4326 degrees produces wrong numbers.

LOAD spatial; LOAD h3;

--------------------------------------------------------------------------------
-- STUDY 1 — Urban forest density & equity
--------------------------------------------------------------------------------

-- Tree geometries are MULTIPOINT; ST_X/ST_Y require POINT, so take centroid first.
CREATE TABLE trees AS
SELECT ST_Centroid(geom) AS pt, COMMON_NAME, BOTANICAL_NAME, DBH_TRUNK
FROM ST_Read('trees.gpkg')
WHERE geom IS NOT NULL;

-- H3 resolution 9 aggregation (~0.1 km2 cells)
CREATE TABLE hex AS
WITH t AS (
  SELECT h3_latlng_to_cell(ST_Y(pt), ST_X(pt), 9) AS cell,
         COMMON_NAME, BOTANICAL_NAME, DBH_TRUNK
  FROM trees
  WHERE ST_X(pt) BETWEEN -79.7 AND -79.0
    AND ST_Y(pt) BETWEEN 43.5 AND 43.9      -- bbox gate before the expensive op
)
SELECT h3_h3_to_string(cell)            AS h3,
       COUNT(*)::INT                    AS trees,
       COUNT(DISTINCT BOTANICAL_NAME)::INT AS species,
       ROUND(AVG(DBH_TRUNK),1)::DOUBLE  AS avg_dbh_cm,
       MODE(COMMON_NAME)                AS top_species
FROM t GROUP BY cell;
-- => 5,412 hexes, max 791 trees, mean 127.2

-- Neighbourhood areas: MUST be projected. ST_Area_Spheroid returned 164.9 km2
-- (wrong, coordinate-order misread); UTM 17N returns 642.6 km2, matching the
-- City's published land area.
CREATE TABLE hoods AS
SELECT AREA_NAME AS name, geom,
       ST_Area(ST_Transform(geom,'EPSG:4326','EPSG:32617', true))/1e6 AS area_km2
FROM ST_Read('neighbourhoods.geojson');

-- Point-in-polygon join + basal area per hectare (forestry stocking metric)
CREATE TABLE hood_trees AS
SELECT h.name,
       COUNT(t.pt)::INT                     AS trees,
       COUNT(DISTINCT t.BOTANICAL_NAME)::INT AS species,
       ROUND(AVG(t.DBH_TRUNK),1)::DOUBLE    AS avg_dbh_cm,
       ROUND(h.area_km2,2)::DOUBLE          AS area_km2,
       ROUND(COUNT(t.pt)/h.area_km2,0)::DOUBLE AS trees_per_km2,
       ROUND(SUM(PI()*POW(t.DBH_TRUNK/200.0,2))/(h.area_km2*100),2)::DOUBLE
                                            AS basal_m2_per_ha
FROM hoods h
LEFT JOIN trees t ON ST_Contains(h.geom, t.pt)
GROUP BY h.name, h.geom, h.area_km2;
-- => 158 neighbourhoods, 688,335 trees assigned, 642.6 km2 total

--------------------------------------------------------------------------------
-- STUDY 2 — EV charging deserts
--------------------------------------------------------------------------------

CREATE TABLE roads AS
SELECT CENTRELINE_ID AS id, LINEAR_NAME_FULL AS road, FEATURE_CODE_DESC AS class,
       geom,
       ST_Transform(geom,'EPSG:4326','EPSG:32617', true) AS geom_utm
FROM ST_Read('centreline.gpkg')
WHERE FEATURE_CODE_DESC IN ('Expressway','Major Arterial','Minor Arterial');
-- => 10,591 segments, 1,505 km

CREATE TABLE chargers AS
SELECT name, operator, capacity, lon, lat,
       ST_Transform(ST_Point(lon,lat),'EPSG:4326','EPSG:32617', true) AS pt_utm
FROM read_csv('chargers.csv');
-- => 158 stations (GTA-wide, so city-edge distances are not clipped)

-- Nearest-neighbour join: min distance in true metres
CREATE TABLE ev_scored AS
SELECT r.id, r.road, r.class,
       ROUND(MIN(ST_Distance(r.geom_utm, c.pt_utm)),0)::DOUBLE          AS dist_m,
       ROUND(MIN(ST_Distance(r.geom_utm, c.pt_utm))/1000.0,2)::DOUBLE   AS dist_km,
       ROUND(ST_Length(r.geom_utm),0)::DOUBLE                           AS seg_len_m,
       ANY_VALUE(r.geom)                                                AS geom
FROM roads r, chargers c
GROUP BY r.id, r.road, r.class, r.geom_utm;

-- Distribution check
SELECT CASE WHEN dist_km<1 THEN '<1km' WHEN dist_km<2 THEN '1-2km'
            WHEN dist_km<5 THEN '2-5km' ELSE '>5km' END AS band,
       ROUND(SUM(seg_len_m)/1000,0) AS km_road, COUNT(*) AS segs
FROM ev_scored GROUP BY 1;
-- => 458 / 468 / 575 / 5 km ; mean 1.71 km, max 5.5 km

--------------------------------------------------------------------------------
-- STUDY 3 — Environmental permit screening
--------------------------------------------------------------------------------

CREATE TABLE rnfpa AS SELECT geom FROM ST_Read('rnfpa/RAVINE_BYLAW_WGS84.shp');  -- 854
CREATE TABLE esa   AS SELECT ESA_NAME, geom FROM ST_Read('esa.geojson');          -- 92
CREATE TABLE water AS
SELECT LINEAR_NAME_FULL AS name, FEATURE_CODE_DESC AS type, geom
FROM ST_Read('centreline.gpkg')
WHERE FEATURE_CODE_DESC IN ('River','Creek/Tributary');                           -- 887, 320 km

-- 30 m screening setback, buffered in metres then returned to WGS84
CREATE TABLE wbuf AS
SELECT name, type,
       ST_Transform(
         ST_Buffer(ST_Transform(geom,'EPSG:4326','EPSG:32617', true), 30),
         'EPSG:32617','EPSG:4326', true) AS geom
FROM water;

-- Dissolve each layer, then union all three so overlaps are counted once
CREATE TABLE constraints_all AS
SELECT ST_Union(
         ST_Union((SELECT ST_Union_Agg(geom) FROM rnfpa),
                  (SELECT ST_Union_Agg(geom) FROM esa)),
         (SELECT ST_Union_Agg(geom) FROM wbuf)) AS geom;

-- Individual vs unioned area (union MUST be less than the sum — proves dissolve works)
--   ravine 111.0 + esa 27.3 + setbacks 19.1 = 157.4 km2 summed
--   union  115.9 km2  =  18.0% of the city's 642.6 km2

-- Per-neighbourhood exposure
CREATE TABLE permit_exposure AS
SELECT h.name,
       ROUND(h.area_km2,2) AS area_km2,
       ROUND(COALESCE(ST_Area(ST_Transform(ST_Intersection(h.geom, a.geom),
             'EPSG:4326','EPSG:32617', true)),0)/1e6, 3) AS con_km2,
       ROUND(100 * COALESCE(ST_Area(ST_Transform(ST_Intersection(h.geom, a.geom),
             'EPSG:4326','EPSG:32617', true)),0)/1e6 / h.area_km2, 1) AS pct_constrained
FROM hoods h, constraints_all a;
-- => Morningside Heights 70.2%, Elms-Old Rexdale 57.9%, High Park-Swansea 55.2%

--------------------------------------------------------------------------------
-- SUPPLEMENTARY — Downtown building heights
--------------------------------------------------------------------------------

CREATE TABLE downtown_buildings AS
SELECT SUBTYPE_DESC AS subtype,
       TRY_CAST(DERIVED_HEIGHT AS DOUBLE) AS height_m,
       geom
FROM ST_Read('buildings.gpkg')
WHERE ST_X(ST_Centroid(geom)) BETWEEN -79.415 AND -79.345
  AND ST_Y(ST_Centroid(geom)) BETWEEN  43.628 AND  43.680
  AND TRY_CAST(DERIVED_HEIGHT AS DOUBLE) > 2;
-- => 33,838 footprints. Ground truth: First Canadian Place 295.8 m (actual 298 m)

--------------------------------------------------------------------------------
-- Export pattern used for all layers (GeoJSON via CSV with geometry column)
--------------------------------------------------------------------------------
-- COPY (SELECT <fields>, ST_AsGeoJSON(geom) AS geometry FROM <table>)
--   TO 'layer.csv' (HEADER);
