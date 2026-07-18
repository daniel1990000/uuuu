# Toronto Spatial Analysis — ArcGIS Online publish pack

Five GeoJSON layers (WGS84 / EPSG:4326), ready to upload as hosted feature layers.

| File | Geometry | Features | Key fields |
|---|---|---|---|
| toronto_street_trees_h3.geojson | Polygon (H3 r9 hex) | 5,412 | trees, species, avg_dbh_cm, top_species |
| toronto_tree_equity_neighbourhoods.geojson | Polygon | 158 | trees_per_km2, basal_m2_per_ha, species |
| toronto_ev_charging_gap_roads.geojson | LineString | 10,591 | dist_km (to nearest charger), class, road |
| toronto_ev_chargers_osm.geojson | Point | 158 | name, operator, capacity |
| toronto_downtown_buildings_lidar.geojson | Polygon | 33,838 | height_m (LiDAR-derived), subtype |

Publish: Content > New item > drag file > "Add and create a hosted feature layer".
Style suggestions per layer are in the repo's portfolio notes.

Sources: City of Toronto Open Data (street trees, neighbourhoods, centreline, building outlines), OpenStreetMap (chargers, ODbL).
Analysis: DuckDB spatial + H3. Daniel Spurr, 2026.
