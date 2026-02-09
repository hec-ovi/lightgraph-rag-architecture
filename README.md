# LightGraph RAG Architecture

A fully local, Dockerized knowledge graph RAG system powered by [LightRAG](https://github.com/HKUDS/LightRAG) and [Ollama](https://ollama.com). Supports multiple isolated document groups with separate knowledge graphs, naive + graph-based RAG query modes, and persistent conversation memory.

> **Current Stage: Backend API** — The frontend will be added in future updates. This phase focuses on delivering a complete, production-ready REST API with full OpenAPI documentation and an `llm.txt` reference for frontend integration.

## Features

- **Graph + Vector RAG** — LightRAG combines knowledge graph extraction with vector similarity for superior retrieval
- **Multiple Document Groups** — Isolated knowledge graphs per group (projects, topics, clients)
- **All Query Modes** — Naive (vector-only), local, global, hybrid, and mix (graph + vector)
- **Conversation Memory** — Persistent chat sessions tied to document groups
- **Fully Local** — All AI inference via Ollama with ROCm GPU acceleration (AMD Strix Halo)
- **OpenAPI Documented** — Every endpoint auto-documented at `/docs`

## Architecture

```
┌──────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  Backend (FastAPI)│
│  (future)    │     │   Port 8000      │
└──────────────┘     └───────┬──────────┘
                             │
                     ┌───────▼──────────┐
                     │  Ollama (ROCm)   │
                     │  Port 11434      │
                     │  gpt-oss:20b     │
                     │  bge-m3 (embed)  │
                     └──────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API Framework | FastAPI + Pydantic v2 |
| RAG Engine | LightRAG (knowledge graph + vector) |
| LLM Inference | Ollama (gpt-oss:20b, 32k context) |
| Embeddings | Ollama (bge-m3, 1024 dim) |
| Metadata DB | SQLite (aiosqlite) |
| GPU | AMD Strix Halo (ROCm, RDNA 3.5) |
| Package Manager | uv |
| Containerization | Docker Compose |

## Project Structure

```
├── docker-compose.yml          # Orchestrates backend + ollama services
├── .env.template               # Environment variables template
├── backend/                    # FastAPI backend service
│   ├── Dockerfile
│   ├── pyproject.toml          # Dependencies (uv)
│   └── src/
│       ├── main.py             # FastAPI app entry point
│       ├── routes/             # HTTP route handlers
│       ├── services/           # Business logic
│       ├── models/             # Pydantic DTOs
│       ├── tools/              # Isolated reusable tools
│       ├── prompts/            # AI prompts as .md files
│       ├── core/               # Config, database, exceptions
│       └── lib/                # Utilities
├── ollama/                     # Ollama ROCm inference service
│   ├── Dockerfile
│   └── entrypoint.sh           # Auto-pulls LLM + embedding models
└── frontend/                   # React frontend (future updates)
```

## Quick Start

```bash
# 1. Clone and configure
cp .env.template .env
# Edit .env — set OLLAMA_MODELS_DIR to your host model path

# 2. Start services
docker compose up -d --build

# 3. Verify
curl http://localhost:8000/health
```

## Requirements

- Docker with compose plugin
- AMD Strix Halo GPU (or compatible ROCm GPU)
- ~30GB disk for models (gpt-oss:20b + bge-m3)
