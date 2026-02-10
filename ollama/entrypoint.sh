#!/bin/bash
set -e

MODEL_NAME="${OLLAMA_MODEL:-gpt-oss:20b}"
EMBED_MODEL="${OLLAMA_EMBED_MODEL:-bge-m3:latest}"
WARMUP_ENABLED="${OLLAMA_WARMUP:-true}"
OLLAMA_PID=""

log() {
    echo "[ollama] $1"
}

cleanup() {
    log "Shutting down..."
    if [ -n "$OLLAMA_PID" ]; then
        kill "$OLLAMA_PID" 2>/dev/null || true
        wait "$OLLAMA_PID" 2>/dev/null || true
    fi
}
trap cleanup SIGTERM SIGINT

log "========================================"
log "LLM Model: $MODEL_NAME"
log "Embed Model: $EMBED_MODEL"
log "========================================"

log "Starting Ollama server..."
/bin/ollama serve &
OLLAMA_PID=$!

log "Waiting for server to be ready..."
for i in {1..60}; do
    if timeout 2 bash -c 'cat < /dev/null > /dev/tcp/localhost/11434' 2>/dev/null; then
        log "Server is ready"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        log "Timeout waiting for server"
        exit 1
    fi
done

sleep 2

pull_model() {
    local name="$1"
    log "Checking model: $name..."
    if /bin/ollama list 2>/dev/null | grep -q "$name"; then
        log "Model $name already exists"
    else
        log "Pulling $name..."
        /bin/ollama pull "$name"
        log "$name download complete"
    fi
}

pull_model "$MODEL_NAME"
pull_model "$EMBED_MODEL"

warmup_generate() {
    local name="$1"
    log "Warming LLM model into VRAM: $name"
    if ! curl -sS http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$name\",\"prompt\":\"ping\",\"stream\":false,\"keep_alive\":\"${OLLAMA_KEEP_ALIVE:--1}\"}" \
        > /dev/null; then
        return 1
    fi
}

warmup_embeddings() {
    local name="$1"
    log "Warming embed model into VRAM: $name"
    if ! curl -sS http://localhost:11434/api/embed \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$name\",\"input\":\"ping\",\"keep_alive\":\"${OLLAMA_KEEP_ALIVE:--1}\"}" \
        > /dev/null; then
        return 1
    fi
}

if [ "$WARMUP_ENABLED" = "true" ] || [ "$WARMUP_ENABLED" = "1" ]; then
    log "Warming models (keep_alive=${OLLAMA_KEEP_ALIVE:--1})"
    warmup_generate "$MODEL_NAME" || log "LLM warmup failed (continuing)"
    warmup_embeddings "$EMBED_MODEL" || log "Embed warmup failed (continuing)"
else
    log "Model warmup disabled (OLLAMA_WARMUP=$WARMUP_ENABLED)"
fi

log "========================================"
log "Ollama running with GPU support"
log "LLM: $MODEL_NAME | Embed: $EMBED_MODEL"
log "========================================"

wait $OLLAMA_PID
