# LightGraph RAG Architecture

A fully local, Dockerized knowledge graph RAG system powered by [LightRAG](https://github.com/HKUDS/LightRAG) and [Ollama](https://ollama.com). Supports multiple isolated document groups with separate knowledge graphs, naive + graph-based RAG query modes, persistent conversation memory, and full OpenAPI documentation.

> **Current Stage: Backend API** — The frontend will be added in future updates. This phase delivers a complete, production-ready REST API. See `llm.txt` for the full endpoint reference to build a frontend against.

## Features

- **Graph + Vector RAG** — LightRAG combines knowledge graph entity extraction with vector similarity for superior retrieval
- **Multiple Document Groups** — Isolated knowledge graphs per group (projects, topics, clients) with zero data leakage
- **5 Query Modes** — Naive (vector-only), local, global, hybrid, and mix (graph + vector combined)
- **Conversation Memory** — Persistent chat sessions with history-aware RAG responses
- **SSE Streaming** — Real-time streaming for both queries and conversations
- **Fully Local** — All AI inference via Ollama with ROCm GPU acceleration (AMD Strix Halo)
- **OpenAPI Documented** — 18 endpoints auto-documented at `/docs`
- **File Upload** — Ingest .txt, .md, .csv, .json, .xml, .html, .py, .js, .ts, .yaml, .yml, .log, and .pdf files via modular extractor registry

## Architecture

```
┌──────────────┐     ┌───────────────────────────────────────┐
│   Frontend   │────▶│         Backend (FastAPI)              │
│  (future)    │     │         Port 8000                      │
└──────────────┘     │                                        │
                     │  Routes ──▶ Services ──▶ Tools         │
                     │                │                       │
                     │         ┌──────▼───────┐               │
                     │         │   LightRAG   │  per-group    │
                     │         │  instances   │  isolation    │
                     │         └──────┬───────┘               │
                     │                │                       │
                     │  ┌─────────────┼─────────────┐         │
                     │  │ SQLite      │ File Store  │         │
                     │  │ (metadata)  │ (KG + vec)  │         │
                     │  └─────────────┴─────────────┘         │
                     └────────────────┬───────────────────────┘
                                      │
                              ┌───────▼──────────┐
                              │  Ollama (ROCm)   │
                              │  Port 11434      │
                              │  gpt-oss:20b     │
                              │  bge-m3 (embed)  │
                              └──────────────────┘
```

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| API Framework | FastAPI + Pydantic v2 | 0.128.x |
| RAG Engine | LightRAG | 1.4.9.11 |
| LLM Inference | Ollama (gpt-oss:20b) | 32k context |
| Embeddings | Ollama (bge-m3) | 1024 dim |
| Metadata DB | SQLite (aiosqlite) | WAL mode |
| GPU | AMD Strix Halo | ROCm, RDNA 3.5 |
| Package Manager | uv | Rust-based |
| Containerization | Docker Compose | Multi-stage builds |
| Streaming | SSE (sse-starlette) | Server-Sent Events |
| PDF Extraction | PyMuPDF | 1.26.x |

## API Overview

| Tag | Endpoints | Description |
|-----|-----------|-------------|
| Health | 1 | Service health check |
| Groups | 5 | CRUD for document groups (isolated knowledge graphs) |
| Documents | 4 | Text insert, file upload, list, get document metadata |
| Query | 2 | RAG query + SSE streaming (5 modes) |
| Conversations | 6 | Chat sessions with memory, SSE streaming, CRUD |

**Total: 18 endpoints** — See `llm.txt` for the complete reference with request/response schemas.

## Project Structure

```
├── docker-compose.yml              # Orchestrates backend + ollama services
├── .env.template                   # Environment variables template
├── llm.txt                         # Complete API reference for frontend integration
├── backend/                        # FastAPI backend service
│   ├── Dockerfile                  # Multi-stage UV build (python:3.12-slim)
│   ├── pyproject.toml              # Dependencies managed by uv
│   ├── uv.lock                     # Deterministic lock file
│   └── src/
│       ├── main.py                 # FastAPI app, lifespan, CORS, router registration
│       ├── routes/                 # HTTP handlers (health, groups, documents, query, conversations)
│       ├── services/               # Business logic (group, document, query, conversation, lightrag)
│       ├── models/                 # Pydantic DTOs (group, document, query, conversation)
│       ├── tools/                  # Isolated tools (text_extractor with PDF support)
│       ├── prompts/                # AI prompts as .md files
│       ├── core/                   # Config, database, exceptions
│       └── lib/                    # Utilities
├── ollama/                         # Ollama ROCm inference service
│   ├── Dockerfile                  # ollama/ollama:rocm + auto model download
│   └── entrypoint.sh              # Starts server, pulls gpt-oss:20b + bge-m3
├── data/                           # Sample test data for RAG ingestion
│   └── samples/
│       └── pydantic_ai_docs.txt   # Pydantic AI documentation (~10KB)
└── frontend/                       # React frontend (future updates)
    └── ...
```

## Quick Start

### Prerequisites

- Docker with compose plugin
- AMD Strix Halo GPU (or compatible ROCm GPU)
- ~30GB disk for models (gpt-oss:20b + bge-m3)

### Setup

```bash
# 1. Clone and configure
git clone <repo-url>
cd lightgraph-rag-architecture
cp .env.template .env
# Edit .env — set OLLAMA_MODELS_DIR to your host model storage path
```

### Run

```bash
# 2. Start all services
docker compose up -d --build

# 3. Wait for Ollama to download models (first run only, ~30GB)
docker logs -f lightrag-ollama

# 4. Verify backend
curl http://localhost:8000/health
# {"status":"healthy","service":"lightgraph-rag-api","version":"0.1.0"}
```

### Usage Example

```bash
# Create a document group
curl -X POST http://localhost:8000/groups \
  -H 'Content-Type: application/json' \
  -d '{"name":"Research","description":"ML research papers"}'

# Insert a document (replace GROUP_ID)
curl -X POST http://localhost:8000/groups/GROUP_ID/documents \
  -H 'Content-Type: application/json' \
  -d '{"content":"LightRAG is a knowledge graph RAG system..."}'

# Query with knowledge graph + vector (mix mode)
curl -X POST http://localhost:8000/groups/GROUP_ID/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"What is LightRAG?","mode":"mix"}'

# Start a conversation with memory
curl -X POST http://localhost:8000/groups/GROUP_ID/conversations \
  -H 'Content-Type: application/json' \
  -d '{"title":"Research chat"}'

# Upload a PDF file (replace GROUP_ID)
curl -X POST http://localhost:8000/groups/GROUP_ID/documents/upload \
  -F "file=@document.pdf"

# Upload the included sample data
curl -X POST http://localhost:8000/groups/GROUP_ID/documents/upload \
  -F "file=@data/samples/pydantic_ai_docs.txt"

# Chat (replace CONV_ID)
curl -X POST http://localhost:8000/groups/GROUP_ID/conversations/CONV_ID/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize the key concepts","mode":"mix"}'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODELS_DIR` | — | **Required.** Host path for Ollama model storage |
| `OLLAMA_MODEL` | `gpt-oss:20b` | LLM model name |
| `OLLAMA_EMBED_MODEL` | `bge-m3:latest` | Embedding model name |
| `OLLAMA_CONTEXT_LENGTH` | `32768` | LLM context window (tokens) |
| `OLLAMA_KEEP_ALIVE` | `5m` | Model VRAM retention after last request |
| `BACKEND_PORT` | `8000` | Backend API port |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama server URL (internal Docker network) |
| `LIGHTRAG_CONTEXT_WINDOW` | `32768` | Context window passed to LightRAG |
| `LIGHTRAG_EMBEDDING_DIM` | `1024` | Embedding dimensions (must match model) |
| `LIGHTRAG_EMBEDDING_MAX_TOKENS` | `8192` | Max tokens per embedding request |

## Query Modes

| Mode | Strategy | Best For |
|------|----------|----------|
| `naive` | Vector similarity only | Simple keyword/semantic search |
| `local` | Knowledge graph — entity-focused | Specific entity questions |
| `global` | Knowledge graph — relationship-focused | Broad conceptual questions |
| `hybrid` | Local + global combined | General graph-based retrieval |
| `mix` | Knowledge graph + vector combined | **Recommended** — best overall quality |

## Development

```bash
# Run backend locally (outside Docker, for development)
cd backend
cp ../.env.template ../.env
# Set OLLAMA_BASE_URL=http://localhost:11434 in .env
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir src

# OpenAPI docs
open http://localhost:8000/docs
```

## License

MIT
