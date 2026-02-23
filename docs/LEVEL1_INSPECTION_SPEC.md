# Level 1 Tree Inspection Requirements

## Must Have (no product without these)
- Unique tree ID
- GPS coordinates (from phone EXIF)
- Species (common name minimum, genus/species ideal)
- DBH estimate (from photo)
- Condition rating (good/fair/poor/dead)
- Georeferenced photo per tree
- ArcGIS-compatible output (shapefile + CSV)

## Should Have (expected by any municipal buyer)
- Height estimate
- Canopy spread estimate
- Crown dieback (visible y/n)
- Trunk defects (cavity/crack/lean — flag y/n)
- Overhead utility conflict (y/n)
- Maintenance flag (prune/remove/none)
- Location type (street tree/park/median/ROW)
- Nearest address
- Site type (tree lawn/cutout/open ground/planter)

## Nice to Have (differentiators)
- Sidewalk damage from roots (y/n)
- Vacant planting site ID
- Land use type
- Mulch/soil condition at base
- Risk flag (obvious serious structural defect)

## Do Not Promise (Level 2+ territory)
- Exact DBH
- Internal decay
- Below-grade root assessment
- Pest/disease diagnosis
- Detailed structural risk matrix

## AI Integration Notes
Fields marked with AI below are populated by the AI processing pipeline via
`POST /api/internal/observations/:id/ai-result`. The mobile app collects photos
and user inputs; AI returns estimates asynchronously. The app provides UI for
manual override/confirmation of all AI-generated values.
