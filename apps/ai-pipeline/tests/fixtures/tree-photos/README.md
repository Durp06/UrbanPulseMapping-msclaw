# Test Tree Photos

Real tree photos from iNaturalist (CC-licensed open data) for pipeline integration testing.
Focused on Austin, TX's most common urban/street tree species.

## Species

| Prefix | Species | Scientific | Notes |
|--------|---------|------------|-------|
| liveoak_ | Live Oak | Quercus virginiana/fusiformis | ~25% of Austin inventory |
| cedarelm_ | Cedar Elm | Ulmus crassifolia | Most common native |
| pecan_ | Pecan | Carya illinoinensis | TX state tree |
| baldcypress_ | Bald Cypress | Taxodium distichum | Along waterways |
| crapemyrtle_ | Crepe Myrtle | Lagerstroemia indica | Ubiquitous ornamental |
| texasredoak_ | Texas Red Oak | Quercus buckleyi | Common street tree |
| monterreyoak_ | Monterrey Oak | Quercus polymorpha | Popular new planting |
| ashejuniper_ | Ashe Juniper | Juniperus ashei | Native "cedar" |
| texasash_ | Texas Ash | Fraxinus texensis | Native shade tree |
| oak_bark_ | Oak bark close-ups | Quercus spp. | Bark detail photos |
| urban_* | Urban context photos | Various | Trees with street/sidewalk context |

## Photo Types

- `*_angle1`, `*_angle2`: Full tree views from different angles
- `*_N_M`: Multiple photos per observation (N=observation, M=photo index)
- `oak_bark_*`: Bark close-up photos
- `urban_*`: Downtown Austin observations with urban context

## Pipeline Test Results (2026-02-27)

**Genus accuracy: 100%** across all 8 tested species (12/12 including earlier tests)

| Species | Confidence | Correct? |
|---------|-----------|----------|
| Live Oak | 93% | ✅ Exact species |
| Bald Cypress | 91% | ✅ Exact species |
| Crepe Myrtle | 84% | ✅ Exact species |
| Ashe Juniper | 70% | ✅ Exact species |
| Texas Red Oak | 52% | ✅ Correct genus |
| Urban Cedar Elm | 53% | ✅ Correct genus |
| Urban Crepe Myrtle | 51% | ✅ Correct genus |
| Monterrey Oak | 40% | ✅ Exact species |
| Urban Live Oak | 40% | ✅ Correct genus |
| Texas Ash | 22% | ✅ Correct genus |

## Source

Downloaded from iNaturalist research-grade observations near Austin, TX (30.27°N, 97.74°W).
Photos are CC-licensed via iNaturalist open data S3 bucket.
