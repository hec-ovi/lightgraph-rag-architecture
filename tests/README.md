# Backend E2E Tests

This folder contains a reproducible end-to-end backend validation flow for the Docker stack.

## Files

- `tests/e2e/backend_e2e.py`: Full API lifecycle verifier (stdlib-only Python).
- `tests/e2e/run_in_backend_container.sh`: Deterministic runner that executes the test script inside the backend container.

## What It Verifies

- Backend readiness gate from `GET /health` (`models_loaded` and `loaded_models`).
- OpenAPI contract and required route/method presence.
- Ollama runtime via `GET /api/ps`, including required model residency on GPU.
- Group lifecycle: create, update, list/get validation, delete.
- Document lifecycle: insert text, upload file, optional PDF ingest, list/get/delete.
- Query modes: `naive`, `local`, `global`, `hybrid`, `mix`.
- SSE streaming for query and conversation endpoints.
- Conversation lifecycle: create/list/get/chat/chat stream/delete.
- Interrupt/cancel resilience by intentionally disconnecting clients mid-request and validating recovery.
- Automatic model warmup retries when readiness is false (useful when `OLLAMA_KEEP_ALIVE` is finite).

## Prerequisites

- Docker services are already up:

```bash
docker compose up -d
```

- Backend and Ollama containers are healthy:

```bash
docker compose ps
```

## Recommended Run (Inside Backend Container)

```bash
bash tests/e2e/run_in_backend_container.sh
```

Optional timeout tuning:

```bash
bash tests/e2e/run_in_backend_container.sh \
  --health-timeout-seconds 1800 \
  --long-request-timeout-seconds 2400
```

Optional warmup retention tuning:

```bash
bash tests/e2e/run_in_backend_container.sh --warmup-keep-alive 45m
```

## Alternative Run (From Host Python)

```bash
python tests/e2e/backend_e2e.py \
  --base-url http://localhost:8000 \
  --ollama-base-url http://localhost:11434 \
  --pdf-path tests/e2e/fixtures/small.pdf
```

## Exit Codes

- `0`: all checks passed.
- `1`: at least one check failed.

The script performs best-effort cleanup of temporary groups/conversations/documents on failure.
