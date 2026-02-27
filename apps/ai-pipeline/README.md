# AI Pipeline

Tree observation photo analysis microservice — species identification, health assessment, and physical measurements.

## Architecture

Consumes jobs from a BullMQ/Redis queue, downloads photos from MinIO/S3, processes them through Pl@ntNet + multimodal LLM APIs, and POSTs structured results back to the Fastify API.

## Setup

```bash
# Install dependencies
pip install -e ".[dev]"

# Copy env template and fill in API keys
cp .env.example .env

# Run tests
pytest tests/ -v
```

## Docker

```bash
# From repo root
docker compose up ai-pipeline
```

## Project Structure

```
src/
├── main.py          # Entry point
├── config.py        # Environment settings (pydantic-settings)
├── consumer.py      # BullMQ/Redis job consumer
├── pipeline.py      # Orchestration: fetch → analyze → POST
├── clients/         # External service clients
│   ├── plantnet.py  # Pl@ntNet species ID API
│   ├── llm.py       # Claude/GPT-4o multimodal
│   └── storage.py   # MinIO/S3 photo download
├── analyzers/       # Analysis logic
│   ├── species.py   # Species consensus (Pl@ntNet + LLM)
│   ├── health.py    # Health assessment
│   └── measurements.py  # DBH + height estimation
├── prompts/         # LLM prompt templates
└── utils/
    └── quality.py   # Photo quality pre-checks
```
