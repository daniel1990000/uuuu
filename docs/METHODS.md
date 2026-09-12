# Methods, Validation & Findings

Engine: DuckDB with `spatial` and `h3` extensions. All distance, length and area
computations performed in **EPSG:32617 (UTM Zone 17N)** — metres — then returned
to EPSG:4326 for display. Doing metric work in degrees is the single most common
error in this kind of analysis; it is avoided throughout.

---

## Study 1 — Urban forest density & equity

**Question.** Where is Toronto's street-tree canopy concentrated, and how unevenly
is it distributed between neighbourhoods?

**Inputs**
- Street Tree Data (City of Toronto), 688,335 points, 304 species, GeoPackage
- Neighbourhoods (City of Toronto), 158 polygons

**Method**
1. Tree geometries arrive as `MULTIPOINT`; reduced to single points with
   `ST_Centroid` before any coordinate extraction (`ST_X`/`ST_Y` reject multipoint).
2. Aggregated to **H3 resolution 9** hexagons (~0.1 km² per cell) carrying tree
   count, species richness, mean DBH, and modal species.
3. Point-in-polygon join to neighbourhoods via `ST_Contains`, producing
   trees/km² and **basal area per hectare** — Σ π·(DBH/2)², a standard forestry
   stocking metric that weights mature trees over saplings.

**Validation**
- All 688,335 trees assigned to a neighbourhood; no orphans.
- Species distribution sanity-checked against domain knowledge: Norway maple
  dominant at 69,468 (10% of the street forest), followed by honey locust and
  Colorado blue spruce — consistent with known Toronto planting history.
- **Bug caught during QA:** `ST_Area_Spheroid` returned 164.9 km² for the city's
  158 neighbourhoods against a known ~630 km² land area — a coordinate-order
  misread. Recomputed via `ST_Transform` to UTM 17N: **642.6 km²**, matching the
  published figure. All area-derived metrics use the projected computation.

**Findings**
- Densest: Forest Hill South 2,470 trees/km²; Palmerston–Little Italy 2,430;
  Casa Loma 2,329; Trinity-Bellwoods 2,327; High Park North 2,239
- Sparsest: St Lawrence–East Bayfront–The Islands 249; Morningside Heights 260;
  Thorncliffe Park 416; Etobicoke City Centre 442
- **~6× gap** between the greenest and least-green residential neighbourhoods
- Dark corridors through the hex surface are the ravine system — ravine trees are
  parkland, not street trees, so their absence is correct, not missing data

---

## Study 2 — EV charging deserts

**Question.** How far is Toronto's arterial road network from public EV charging?

**Inputs**
- Toronto Centreline v2, filtered to Expressway / Major Arterial / Minor Arterial
  → 10,591 segments, 1,505 km
- OpenStreetMap `amenity=charging_station`, 158 stations, queried GTA-wide
  (bbox 43.40–44.05 N, 80.05–78.85 W) so city-edge distances are not biased by a
  hard clip at the municipal boundary

**Method**
Nearest-neighbour join: for each road segment, `MIN(ST_Distance(...))` against all
158 charger points, both geometries transformed to UTM 17N so the result is in
true metres. 10,591 × 158 pair evaluation, grouped per segment.

**Validation**
- Distance distribution inspected for plausibility across four bands
- Maximum distance 5.5 km — reasonable for a dense urban municipality; a result in
  the tens of kilometres would have indicated a projection or join error
- Total network length 1,505 km cross-checks against the centreline extract

**Findings**
| Band | Road length | Segments |
|---|---|---|
| <1 km | 458 km | 3,424 |
| 1–2 km | 468 km | 3,335 |
| 2–5 km | 575 km | 3,799 |
| >5 km | 5 km | 33 |

- Mean distance to nearest charger: **1.71 km**
- **38% of the arterial network (575 km) sits more than 2 km** from any mapped charger
- Deserts concentrate in **Scarborough**: Kingston Rd (5.48 km), St Clair Ave E
  (5.44 km), Midland Ave (5.42 km)
- Coverage tightest downtown and along the central Yonge corridor

**Caveat (stated on the published map).** OSM charger coverage is community-mapped
and undercounts commercial networks, so these distances are an upper bound on the
*mapped* network. The method transfers unchanged to authoritative feeds (NRCan
Electric Charging and Alternative Fuelling Stations Locator, ChargeHub).

---

## Study 3 — Environmental permit screening

**Question.** How much of Toronto carries a spatial trigger for environmental
approvals, and where is the screening burden heaviest?

This is a screening-level development-constraints model — the deliverable an
environmental consultant produces for Phase 1 site screening and permit due
diligence.

**Inputs & regulatory basis**

| Layer | Features | Area | Permit relevance |
|---|---|---|---|
| Ravine & Natural Feature Protection Area | 854 | 111.0 km² | Works within the boundary require a permit under City of Toronto Municipal Code Ch. 658 |
| Environmentally Significant Areas | 92 | 27.3 km² | Official Plan policy trigger; impact study required for nearby development |
| Watercourse 30 m setback | 887 segments, 320 km buffered | 19.1 km² | Screening proxy for conservation authority regulated area (O. Reg. 41/24) |

**Method**
1. Watercourses (`River`, `Creek/Tributary` from Centreline v2) buffered by
   **30 m in projected metres**, then returned to WGS84.
2. Each layer dissolved with `ST_Union_Agg`, then all three unioned into a single
   constraint surface — so overlapping triggers are counted once, not double-counted.
3. Per-neighbourhood `ST_Intersection` against the union, giving constrained area
   and percent of each neighbourhood under at least one trigger.

**Validation**
- Computed ravine bylaw area **111.0 km²** independently reproduces the City's
  published ravine system extent of ~11,000 hectares — an external check against
  a figure not used as an input.
- Union area (115.9 km²) is correctly *less* than the sum of parts (157.4 km²),
  confirming overlap is being dissolved rather than summed.

**Findings**
- **18.0% of Toronto's land area (115.9 km² of 642.6 km²)** carries at least one
  environmental permit trigger
- Most constrained: Morningside Heights 70.2% (contains Rouge National Urban
  Park), Elms-Old Rexdale 57.9%, High Park-Swansea 55.2%, Lambton Baby Point
  52.9%, Bridle Path-Sunnybrook-York Mills 48.2%
- Zero-constraint neighbourhoods cluster on the midtown tableland: South
  Eglinton-Davisville, North Toronto, Junction-Wallace Emerson

**Caveat (stated on the published map).** Screening-level only. The 30 m
watercourse buffer is a proxy; actual conservation authority regulated areas are
defined by TRCA's authoritative regulation mapping and include flood/erosion
hazard allowances that vary by reach. Not a substitute for formal regulatory review.

---

## Supplementary layer — Downtown building heights (LiDAR)

33,838 building footprints in the downtown core (43.628–43.680 N,
79.415–79.345 W) filtered from 557,694 citywide, carrying LiDAR-derived heights
from the City's topographic mapping program.

**Validation against ground truth:** First Canadian Place measures **295.8 m** in
the data against 298 m actual; CN Tower structure reads 523 m. Height
distribution: 24,329 buildings <10 m, 18,516 at 10–30 m, 7,162 at 30–100 m,
1,581 at 100–200 m, 187 above 200 m.

This layer is included as GeoJSON but is not currently one of the three published
Dekart maps (free tier caps at three reports).
