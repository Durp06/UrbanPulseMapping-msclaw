# 🤖 AI Pipeline

Tree observation photo analysis microservice. Identifies species, assesses health, estimates physical measurements, and evaluates site conditions from field photos.

## Architecture

```
Redis Queue              AI Pipeline                    API Server
(BullMQ)                 (Python)                       (Fastify)
───────────              ──────────                     ──────────
ai-process-    ────►     consumer.py receives job
observation              pipeline.py orchestrates:
                         ├─ storage.py downloads photos from MinIO
                         ├─ quality.py filters blurry/dark photos
                         ├─ species.py  ─┐
                         ├─ health.py   ─┤  run in parallel
                         ├─ measurements.py ─┤
                         └─ site.py     ─┘
                         pipeline.py POSTs results  ────►  /api/internal/
                                                           observations/:id/
                                                           ai-result
```

## How Species ID Works

Two-source consensus system:

1. **Pl@ntNet** — botanical image recognition API, returns ranked species with confidence scores
2. **Claude Vision** — multimodal LLM analyzes photos with geographic context (reverse geocode)
3. **Consensus logic** — if both agree on genus, high confidence. If they disagree, lower confidence with the more specific result used.

### Accuracy (tested 2026-02-27)

| Species | Type | Confidence | Genus Match |
|---------|------|-----------|-------------|
| Live Oak (*Quercus virginiana*) | Native | 93% | ✅ |
| Bald Cypress (*Taxodium distichum*) | Native | 91% | ✅ |
| Crepe Myrtle (*Lagerstroemia indica*) | Ornamental | 84% | ✅ |
| Ashe Juniper (*Juniperus ashei*) | Native | 70% | ✅ |
| Cedar Elm (*Ulmus crassifolia*) | Native | 53% | ✅ |
| Texas Red Oak (*Quercus buckleyi*) | Native | 52% | ✅ |
| Monterrey Oak (*Quercus polymorpha*) | Planted | 40% | ✅ |
| Texas Ash (*Fraxinus texensis*) | Native | 22% | ✅ |

**Genus accuracy: 100%** across all 12 tested Austin street tree species (47 real photos from iNaturalist).

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy and configure environment
cp .env.example .env
# Required: ANTHROPIC_API_KEY, PLANTNET_API_KEY, REDIS_URL, DATABASE_URL, S3_*, INTERNAL_API_KEY
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for vision analysis |
| `PLANTNET_API_KEY` | Yes | Free at [my.plantnet.org](https://my.plantnet.org) |
| `GOOGLE_API_KEY` | No | Gemini as alternative LLM |
| `LLM_PROVIDER` | No | `anthropic` (default), `google`, `openai` |
| `LLM_MODEL` | No | Default: `claude-sonnet-4-5-20250929` |
| `REDIS_URL` | Yes | `redis://localhost:6379` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `S3_ENDPOINT` | Yes | `http://localhost:9000` (MinIO) |
| `S3_ACCESS_KEY` | Yes | MinIO/R2 access key |
| `S3_SECRET_KEY` | Yes | MinIO/R2 secret key |
| `S3_BUCKET` | Yes | `urban-pulse-photos` |
| `API_BASE_URL` | Yes | `http://localhost:3000` |
| `INTERNAL_API_KEY` | Yes | Must match API's `INTERNAL_API_KEY` |
| `LOG_LEVEL` | No | `INFO` (default), `DEBUG` for verbose |

## Running

```bash
# Start the consumer (runs until killed)
python -m src.main

# With debug logging
LOG_LEVEL=DEBUG python -m src.main
```

## Testing

```bash
# Quality filter only (no API keys needed)
pytest tests/test_e2e_real_photos.py::TestQualityFilter -v

# Pl@ntNet species ID
pytest tests/test_e2e_real_photos.py::TestPlantNet -v -s

# Claude analyzers (health, species, measurements, site)
pytest tests/test_e2e_real_photos.py::TestLLMAnalyzers -v -s

# Full pipeline (all 12 species)
pytest tests/test_e2e_real_photos.py::TestFullPipeline -v -s

# Everything
pytest tests/test_e2e_real_photos.py -v -s
```

Test fixtures: 47 real tree photos in `tests/fixtures/tree-photos/` from iNaturalist (CC-licensed).

## Project Structure

```
src/
├── main.py              # Entry point
├── config.py            # Pydantic settings from env
├── consumer.py          # BullMQ/Redis job consumer + retry logic
├── pipeline.py          # Orchestration: fetch → analyze → POST result
├── clients/
│   ├── plantnet.py      # Pl@ntNet species ID (async, with retry)
│   ├── llm.py           # Multimodal LLM client (Anthropic/OpenAI/Google)
│   │                    # Includes auto-resize for large photos (max 1568px)
│   └── storage.py       # MinIO/S3 download + PostgreSQL observation fetch
├── analyzers/
│   ├── species.py       # Dual-source consensus (Pl@ntNet + LLM + geo context)
│   ├── health.py        # Structural condition, leaf condition, confidence
│   ├── measurements.py  # DBH (cm), height (m), crown width (m), stem count
│   └── site.py          # Condition rating, location type, risk assessment
├── prompts/             # LLM prompt templates (.txt)
└── utils/
    └── quality.py       # Blur detection (Laplacian), brightness, size checks

tests/
├── test_e2e_real_photos.py          # E2E tests with real tree photos
└── fixtures/
    └── tree-photos/                 # 47 iNaturalist photos (12 species)
        └── README.md                # Photo inventory + accuracy results
```

## Analyzers

### Species (`species.py`)
- Runs Pl@ntNet + Claude in parallel
- Reverse geocodes lat/lon for regional context in LLM prompt
- Consensus: agree on genus → high confidence, disagree → capped at 0.70
- Returns: common name, scientific name, genus, confidence

### Health (`health.py`)
- Claude analyzes full-tree photos for structural and foliage condition
- Returns: condition_structural (excellent→dead), condition_leaf (excellent→absent), observations, notes, confidence

### Measurements (`measurements.py`)
- Claude estimates from photos, optionally cross-references species allometry
- Returns: DBH (cm), height (m), crown width (m), stem count

### Site (`site.py`)
- Claude evaluates planting site from photos + geo context
- Returns: condition_rating, location_type, site_type, overhead_utility_conflict, sidewalk_damage, risk_flag

## Gotchas

- **Large photos** (4000x3000+) are auto-resized to max 1568px in `llm.py` before base64 encoding
- **Pl@ntNet rate limit**: 500 requests/day on free tier — check `remaining_identification_requests` in response
- **BullMQ Python library**: jobs with `attempts: 0` in Redis won't retry — the consumer handles retry logic
- **INTERNAL_API_KEY** must match between pipeline `.env` and API `.env` or results POST gets 401
