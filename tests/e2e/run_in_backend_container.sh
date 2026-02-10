#!/usr/bin/env bash
set -euo pipefail

# Runs the backend E2E suite from inside the backend container so networking and
# Python runtime are deterministic, regardless of host environment.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-lightrag-backend}"
SCRIPT_SRC="${ROOT_DIR}/tests/e2e/backend_e2e.py"
SCRIPT_DST="/tmp/backend_e2e.py"
PDF_SRC="${ROOT_DIR}/tests/e2e/fixtures/small.pdf"
PDF_DST="/tmp/e2e_small.pdf"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${BACKEND_CONTAINER}"; then
  echo "backend container '${BACKEND_CONTAINER}' is not running" >&2
  exit 1
fi

if [[ ! -f "${SCRIPT_SRC}" ]]; then
  echo "missing test script: ${SCRIPT_SRC}" >&2
  exit 1
fi

docker cp "${SCRIPT_SRC}" "${BACKEND_CONTAINER}:${SCRIPT_DST}"

if [[ ! -f "${PDF_SRC}" ]]; then
  echo "missing PDF fixture: ${PDF_SRC}" >&2
  exit 1
fi
docker cp "${PDF_SRC}" "${BACKEND_CONTAINER}:${PDF_DST}"

# Accept additional args and pass through to the Python runner.
docker exec "${BACKEND_CONTAINER}" python "${SCRIPT_DST}" \
  --base-url "http://localhost:8000" \
  --ollama-base-url "http://ollama:11434" \
  --pdf-path "${PDF_DST}" \
  "$@"
