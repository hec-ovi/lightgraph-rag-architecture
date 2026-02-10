#!/usr/bin/env python3
"""End-to-end backend verification for LightGraph RAG.

This script validates the full backend API lifecycle against a running stack:
- Readiness gating (`/health`) and OpenAPI contract checks.
- Model residency and GPU processor checks through Ollama `/api/ps`.
- Group CRUD, document ingestion/list/get/delete, query modes, and SSE streaming.
- Conversation CRUD, chat, streamed chat, and persistence checks.
- Interrupt/cancel resilience via intentional client disconnects.

The script is intentionally stdlib-only so it runs in both host Python and container
Python without extra dependencies.
"""

from __future__ import annotations

import argparse
import http.client
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class E2EError(RuntimeError):
    """Raised when an end-to-end expectation fails."""


@dataclass(slots=True)
class TestState:
    """Tracks created entities to allow best-effort cleanup on failures."""

    group_a_id: str | None = None
    group_b_id: str | None = None
    group_b_document_id: str | None = None
    conversation_id: str | None = None


class BackendE2ETester:
    """Runs a full backend verification flow with bounded request timeouts."""

    def __init__(
        self,
        base_url: str,
        ollama_base_url: str,
        expected_models: list[str],
        llm_model: str,
        embed_model: str,
        warmup_keep_alive: str,
        pdf_path: str,
        health_timeout_seconds: int,
        request_timeout_seconds: int,
        long_request_timeout_seconds: int,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.expected_models = expected_models
        self.llm_model = llm_model
        self.embed_model = embed_model
        self.warmup_keep_alive = warmup_keep_alive
        self.pdf_path = Path(pdf_path)
        self.health_timeout_seconds = health_timeout_seconds
        self.request_timeout_seconds = request_timeout_seconds
        self.long_request_timeout_seconds = long_request_timeout_seconds
        self.state = TestState()
        self.run_id = uuid.uuid4().hex[:8]
        self.token_a = f"TOKEN_A_{self.run_id}_ALPHA123"
        self.token_b = f"TOKEN_B_{self.run_id}_BETA456"

    def log(self, message: str) -> None:
        """Print a prefixed progress line for easier triage in CI/logs."""
        print(f"[e2e] {message}", flush=True)

    @staticmethod
    def _decode_json(raw: bytes) -> dict[str, Any]:
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            preview = raw[:500].decode("utf-8", errors="ignore")
            raise E2EError(f"Invalid JSON response body: {preview}") from exc

    def _post_json_url(
        self,
        url: str,
        payload: dict[str, Any],
        timeout: int,
    ) -> dict[str, Any]:
        """POST JSON to an absolute URL and return decoded response payload."""
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return self._decode_json(response.read())

    def request_json(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
        timeout: int | None = None,
        expected_statuses: tuple[int, ...] = (200, 201),
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, Any]]:
        """Send a JSON request and enforce expected status codes."""
        req_headers = dict(headers or {})
        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json")

        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method=method,
            headers=req_headers,
        )

        status = 0
        raw = b""
        try:
            with urllib.request.urlopen(
                req, timeout=timeout or self.request_timeout_seconds
            ) as response:
                status = response.status
                raw = response.read()
        except urllib.error.HTTPError as error:
            status = error.code
            raw = error.read()

        payload_data = self._decode_json(raw)
        if status not in expected_statuses:
            raise E2EError(
                f"{method} {path} returned {status}, expected {expected_statuses}. "
                f"Body={json.dumps(payload_data)[:900]}"
            )
        return status, payload_data

    @staticmethod
    def _encode_multipart(
        fields: dict[str, str],
        files: dict[str, tuple[str, str, bytes]],
    ) -> tuple[bytes, str]:
        boundary = f"----e2e{uuid.uuid4().hex}"
        lines: list[bytes] = []

        for name, value in fields.items():
            lines.append(f"--{boundary}".encode())
            lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
            lines.append(b"")
            lines.append(value.encode())

        for name, (filename, content_type, file_bytes) in files.items():
            lines.append(f"--{boundary}".encode())
            lines.append(
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
            )
            lines.append(f"Content-Type: {content_type}".encode())
            lines.append(b"")
            lines.append(file_bytes)

        lines.append(f"--{boundary}--".encode())
        lines.append(b"")
        return b"\r\n".join(lines), f"multipart/form-data; boundary={boundary}"

    def post_multipart(
        self,
        path: str,
        files: dict[str, tuple[str, str, bytes]],
        timeout: int | None = None,
    ) -> dict[str, Any]:
        """POST multipart file upload and return parsed JSON response."""
        body, content_type = self._encode_multipart({}, files)
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={"Content-Type": content_type},
        )

        try:
            with urllib.request.urlopen(
                req, timeout=timeout or self.long_request_timeout_seconds
            ) as response:
                if response.status not in (200, 201):
                    raise E2EError(
                        f"POST {path} returned {response.status} instead of 200/201"
                    )
                return self._decode_json(response.read())
        except urllib.error.HTTPError as error:
            body_preview = error.read().decode("utf-8", errors="ignore")[:900]
            raise E2EError(
                f"POST {path} failed with {error.code}. Body={body_preview}"
            ) from error

    def read_sse_events(
        self,
        path: str,
        payload: dict[str, Any],
        timeout: int | None = None,
    ) -> list[tuple[str, str]]:
        """Read SSE events until `done` or fail on `error` event."""
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
        )

        events: list[tuple[str, str]] = []
        current_event = ""
        with urllib.request.urlopen(req, timeout=timeout or self.long_request_timeout_seconds) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    current_event = line.split(":", 1)[1].strip()
                    continue
                if not line.startswith("data:"):
                    continue

                data = line.split(":", 1)[1].strip()
                events.append((current_event, data))

                if current_event == "error":
                    raise E2EError(f"SSE error from {path}: {data}")
                if current_event == "done":
                    break

        if not any(event == "done" for event, _ in events):
            raise E2EError(f"SSE stream {path} ended without a done event")
        return events

    @staticmethod
    def fire_and_disconnect(path: str, payload: dict[str, Any]) -> None:
        """Send request bytes then close socket immediately to simulate client cancellation."""
        body = json.dumps(payload).encode("utf-8")
        conn = http.client.HTTPConnection("localhost", 8000, timeout=5)
        conn.putrequest("POST", path)
        conn.putheader("Content-Type", "application/json")
        conn.putheader("Content-Length", str(len(body)))
        conn.endheaders()
        conn.send(body)
        conn.close()

    def wait_for_models(self) -> dict[str, Any]:
        """Poll health until backend reports all expected models as loaded."""
        deadline = time.time() + self.health_timeout_seconds
        last_health: dict[str, Any] = {}
        expected = set(self.expected_models)
        next_warmup_at = 0.0

        while time.time() < deadline:
            _, health = self.request_json(
                "GET",
                "/health",
                timeout=10,
                expected_statuses=(200,),
            )
            last_health = health
            loaded_models = set(health.get("loaded_models", []))
            if health.get("models_loaded") and expected.issubset(loaded_models):
                return health

            now = time.time()
            if now >= next_warmup_at:
                self.log("models not ready; forcing Ollama warmup for required models")
                try:
                    self.warm_models_once()
                except Exception as exc:
                    self.log(f"warmup request failed: {exc}")
                next_warmup_at = now + 30

            self.log(f"Models not ready yet: {health}")
            time.sleep(5)

        raise E2EError(
            f"Timed out waiting for models to load. Last health payload: {last_health}"
        )

    def assert_ollama_gpu_residency(self) -> dict[str, Any]:
        """Validate expected models are loaded and assigned to GPU processors."""
        with urllib.request.urlopen(
            f"{self.ollama_base_url}/api/ps", timeout=self.request_timeout_seconds
        ) as response:
            payload = self._decode_json(response.read())

        models = payload.get("models", [])
        model_map = {
            str(item.get("model", "")): item
            for item in models
            if isinstance(item, dict)
        }

        missing = [model for model in self.expected_models if model not in model_map]
        if missing:
            raise E2EError(f"Expected models missing from ollama /api/ps: {missing}")

        non_gpu = []
        for model_name in self.expected_models:
            model_payload = model_map[model_name]
            processor = str(model_payload.get("processor", "")).strip()
            size_vram = int(model_payload.get("size_vram") or 0)

            # Ollama payloads differ by version. Newer versions include "processor";
            # older payloads only expose VRAM usage.
            if processor:
                if "GPU" not in processor.upper():
                    non_gpu.append(f"{model_name} (processor={processor})")
            elif size_vram <= 0:
                non_gpu.append(f"{model_name} (size_vram={size_vram})")
        if non_gpu:
            raise E2EError(f"Expected GPU residency but got non-GPU processors: {non_gpu}")

        return payload

    def warm_models_once(self) -> None:
        """Load both required models into memory to satisfy readiness checks."""
        self._post_json_url(
            f"{self.ollama_base_url}/api/generate",
            {
                "model": self.llm_model,
                "prompt": "warmup",
                "stream": False,
                "keep_alive": self.warmup_keep_alive,
            },
            timeout=min(self.long_request_timeout_seconds, 900),
        )
        self._post_json_url(
            f"{self.ollama_base_url}/api/embed",
            {
                "model": self.embed_model,
                "input": "warmup",
                "keep_alive": self.warmup_keep_alive,
            },
            timeout=min(self.long_request_timeout_seconds, 900),
        )

    def assert_openapi_contract(self) -> None:
        """Validate expected routes and methods are available in OpenAPI."""
        _, openapi = self.request_json("GET", "/openapi.json", expected_statuses=(200,))
        paths = openapi.get("paths", {})

        required_paths = {
            "/health",
            "/groups",
            "/groups/{group_id}",
            "/groups/{group_id}/documents",
            "/groups/{group_id}/documents/upload",
            "/groups/{group_id}/documents/{document_id}",
            "/groups/{group_id}/query",
            "/groups/{group_id}/query/stream",
            "/groups/{group_id}/conversations",
            "/groups/{group_id}/conversations/{conversation_id}",
            "/groups/{group_id}/conversations/{conversation_id}/chat",
            "/groups/{group_id}/conversations/{conversation_id}/chat/stream",
        }
        missing_paths = sorted(required_paths - set(paths.keys()))
        if missing_paths:
            raise E2EError(f"OpenAPI missing paths: {missing_paths}")

        document_item_methods = set(paths["/groups/{group_id}/documents/{document_id}"].keys())
        if "delete" not in document_item_methods:
            raise E2EError(
                "OpenAPI is missing DELETE /groups/{group_id}/documents/{document_id}"
            )

    def _ensure_404(self, path: str) -> None:
        status, _ = self.request_json("GET", path, expected_statuses=(404,))
        if status != 404:
            raise E2EError(f"Expected 404 from {path}, got {status}")

    def _cleanup_best_effort(self) -> None:
        """Cleanup transient entities if a mid-run failure occurs."""
        if self.state.conversation_id and self.state.group_a_id:
            try:
                self.request_json(
                    "DELETE",
                    f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}",
                    expected_statuses=(204, 404),
                    timeout=10,
                )
            except Exception:
                pass

        if self.state.group_b_document_id and self.state.group_b_id:
            try:
                self.request_json(
                    "DELETE",
                    f"/groups/{self.state.group_b_id}/documents/{self.state.group_b_document_id}",
                    expected_statuses=(204, 404),
                    timeout=10,
                )
            except Exception:
                pass

        for group_id in [self.state.group_a_id, self.state.group_b_id]:
            if not group_id:
                continue
            try:
                self.request_json(
                    "DELETE",
                    f"/groups/{group_id}",
                    expected_statuses=(204, 404),
                    timeout=10,
                )
            except Exception:
                pass

    def run(self) -> int:
        """Execute end-to-end backend verification and return process exit code."""
        try:
            self.log("1/14 waiting for health and model readiness")
            health = self.wait_for_models()
            self.log(f"health: {json.dumps(health)}")

            self.log("2/14 checking OpenAPI contract")
            self.assert_openapi_contract()

            self.log("3/14 checking Ollama model residency on GPU")
            ps_before = self.assert_ollama_gpu_residency()
            self.log(f"ollama ps models: {[m.get('model') for m in ps_before.get('models', [])]}")

            self.log("4/14 creating two groups and updating one")
            _, group_a = self.request_json(
                "POST",
                "/groups",
                payload={
                    "name": f"E2E Group A {self.run_id}",
                    "description": "Group A for isolation",
                },
                expected_statuses=(201,),
            )
            _, group_b = self.request_json(
                "POST",
                "/groups",
                payload={
                    "name": f"E2E Group B {self.run_id}",
                    "description": "Group B for isolation",
                },
                expected_statuses=(201,),
            )
            self.state.group_a_id = str(group_a["id"])
            self.state.group_b_id = str(group_b["id"])

            self.request_json(
                "PATCH",
                f"/groups/{self.state.group_a_id}",
                payload={"description": "Updated by E2E"},
                expected_statuses=(200,),
            )

            self.log("5/14 ingesting text and file documents")
            _, doc_a = self.request_json(
                "POST",
                f"/groups/{self.state.group_a_id}/documents",
                payload={
                    "filename": f"group_a_{self.run_id}.txt",
                    "content": (
                        "This is Group A authoritative text. "
                        f"Unique token is {self.token_a}."
                    ),
                },
                timeout=self.long_request_timeout_seconds,
                expected_statuses=(201,),
            )

            group_b_text = (
                "This is Group B authoritative text. "
                f"Unique token is {self.token_b}."
            ).encode("utf-8")
            doc_b = self.post_multipart(
                f"/groups/{self.state.group_b_id}/documents/upload",
                files={
                    "file": (
                        f"group_b_{self.run_id}.txt",
                        "text/plain",
                        group_b_text,
                    )
                },
                timeout=self.long_request_timeout_seconds,
            )
            self.state.group_b_document_id = str(doc_b["id"])

            if self.pdf_path.exists():
                self.log("6/14 ingesting sample PDF into Group A")
                self.post_multipart(
                    f"/groups/{self.state.group_a_id}/documents/upload",
                    files={
                        "file": (
                            self.pdf_path.name,
                            "application/pdf",
                            self.pdf_path.read_bytes(),
                        )
                    },
                    timeout=max(self.long_request_timeout_seconds, 1800),
                )
            else:
                self.log(f"6/14 sample PDF not found at {self.pdf_path}, skipping PDF stage")

            self.log("7/14 checking document list/get")
            _, docs_a = self.request_json(
                "GET",
                f"/groups/{self.state.group_a_id}/documents",
                expected_statuses=(200,),
            )
            _, docs_b = self.request_json(
                "GET",
                f"/groups/{self.state.group_b_id}/documents",
                expected_statuses=(200,),
            )
            if int(docs_a.get("total", 0)) < 1 or int(docs_b.get("total", 0)) < 1:
                raise E2EError("Expected at least one document in each group after ingestion")

            self.request_json(
                "GET",
                f"/groups/{self.state.group_a_id}/documents/{doc_a['id']}",
                expected_statuses=(200,),
            )
            self.request_json(
                "GET",
                f"/groups/{self.state.group_b_id}/documents/{self.state.group_b_document_id}",
                expected_statuses=(200,),
            )

            self.log("8/14 validating all query modes")
            for mode in ["naive", "local", "global", "hybrid", "mix"]:
                _, query_response = self.request_json(
                    "POST",
                    f"/groups/{self.state.group_a_id}/query",
                    payload={
                        "query": "Return Group A unique token exactly.",
                        "mode": mode,
                    },
                    timeout=self.long_request_timeout_seconds,
                    expected_statuses=(200,),
                )
                content = str(query_response.get("response", ""))
                if not content.strip():
                    raise E2EError(f"Query mode '{mode}' returned an empty response")

            self.log("9/14 validating cross-group isolation")
            _, query_a = self.request_json(
                "POST",
                f"/groups/{self.state.group_a_id}/query",
                payload={"query": "What is Group A token?", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
                expected_statuses=(200,),
            )
            _, query_b = self.request_json(
                "POST",
                f"/groups/{self.state.group_b_id}/query",
                payload={"query": "What is Group B token?", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
                expected_statuses=(200,),
            )
            if self.token_a not in str(query_a.get("response", "")):
                raise E2EError("Group A isolation check failed: token missing")
            if self.token_b not in str(query_b.get("response", "")):
                raise E2EError("Group B isolation check failed: token missing")

            self.log("10/14 validating query SSE stream")
            stream_events = self.read_sse_events(
                f"/groups/{self.state.group_a_id}/query/stream",
                payload={"query": "Summarize Group A context.", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
            )
            if sum(1 for event, _ in stream_events if event == "chunk") == 0:
                raise E2EError("Query stream returned no chunk events")

            self.log("11/14 validating conversation APIs")
            _, conv = self.request_json(
                "POST",
                f"/groups/{self.state.group_a_id}/conversations",
                payload={"title": f"E2E Conversation {self.run_id}"},
                expected_statuses=(201,),
            )
            self.state.conversation_id = str(conv["id"])

            _, conv_list = self.request_json(
                "GET",
                f"/groups/{self.state.group_a_id}/conversations",
                expected_statuses=(200,),
            )
            if int(conv_list.get("total", 0)) < 1:
                raise E2EError("Conversation list should include the newly created conversation")

            self.request_json(
                "POST",
                f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}/chat",
                payload={"message": "Reply with Group A token only.", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
                expected_statuses=(200,),
            )
            conv_stream_events = self.read_sse_events(
                f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}/chat/stream",
                payload={"message": "Reply with Group A token and reason.", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
            )
            if sum(1 for event, _ in conv_stream_events if event == "chunk") == 0:
                raise E2EError("Conversation stream returned no chunk events")

            _, conv_history = self.request_json(
                "GET",
                f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}",
                expected_statuses=(200,),
            )
            if len(conv_history.get("messages", [])) < 2:
                raise E2EError("Conversation history did not persist user/assistant messages")

            self.log("12/14 validating interrupt/disconnect resilience")
            self.fire_and_disconnect(
                f"/groups/{self.state.group_a_id}/query",
                {"query": "Long answer for disconnect test.", "mode": "mix"},
            )
            self.fire_and_disconnect(
                f"/groups/{self.state.group_a_id}/query/stream",
                {"query": "Long stream answer for disconnect test.", "mode": "mix"},
            )
            time.sleep(2)

            _, health_after_interrupt = self.request_json(
                "GET",
                "/health",
                timeout=10,
                expected_statuses=(200,),
            )
            if not health_after_interrupt.get("models_loaded"):
                raise E2EError("Health degraded after interrupt/disconnect checks")

            self.request_json(
                "POST",
                f"/groups/{self.state.group_a_id}/query",
                payload={"query": "Quick post-interrupt query.", "mode": "mix"},
                timeout=self.long_request_timeout_seconds,
                expected_statuses=(200,),
            )

            self.log("13/14 deleting document, conversation, and groups")
            self.request_json(
                "DELETE",
                f"/groups/{self.state.group_b_id}/documents/{self.state.group_b_document_id}",
                expected_statuses=(204,),
            )
            self._ensure_404(
                f"/groups/{self.state.group_b_id}/documents/{self.state.group_b_document_id}"
            )
            self.state.group_b_document_id = None

            self.request_json(
                "DELETE",
                f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}",
                expected_statuses=(204,),
            )
            self._ensure_404(
                f"/groups/{self.state.group_a_id}/conversations/{self.state.conversation_id}"
            )
            self.state.conversation_id = None

            self.request_json(
                "DELETE",
                f"/groups/{self.state.group_b_id}",
                expected_statuses=(204,),
            )
            self.request_json(
                "DELETE",
                f"/groups/{self.state.group_a_id}",
                expected_statuses=(204,),
            )
            self._ensure_404(f"/groups/{self.state.group_a_id}")
            self._ensure_404(f"/groups/{self.state.group_b_id}")
            self.state.group_a_id = None
            self.state.group_b_id = None

            self.log("14/14 confirming models remain loaded on GPU after tests")
            self.assert_ollama_gpu_residency()

            self.log("PASS: full backend E2E validation completed")
            return 0

        except Exception as exc:
            self.log(f"FAIL: {exc}")
            return 1

        finally:
            self._cleanup_best_effort()


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for endpoint URLs and timeout controls."""
    parser = argparse.ArgumentParser(
        description="Run complete backend end-to-end verification against a running stack."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Backend base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--ollama-base-url",
        default="http://localhost:11434",
        help="Ollama base URL for GPU/model checks (default: http://localhost:11434)",
    )
    parser.add_argument(
        "--llm-model",
        default="gpt-oss:20b",
        help="LLM model used for warmup and residency checks",
    )
    parser.add_argument(
        "--embed-model",
        default="bge-m3:latest",
        help="Embedding model used for warmup and residency checks",
    )
    parser.add_argument(
        "--warmup-keep-alive",
        default="30m",
        help="Keep-alive duration used by warmup requests",
    )
    parser.add_argument(
        "--pdf-path",
        default="/tmp/e2e_small.pdf",
        help="Sample PDF path used for ingestion test",
    )
    parser.add_argument(
        "--health-timeout-seconds",
        type=int,
        default=1200,
        help="Max seconds to wait for models_loaded readiness",
    )
    parser.add_argument(
        "--request-timeout-seconds",
        type=int,
        default=60,
        help="Default timeout for lightweight API calls",
    )
    parser.add_argument(
        "--long-request-timeout-seconds",
        type=int,
        default=1800,
        help="Timeout for ingestion and query calls",
    )
    return parser.parse_args()


def main() -> int:
    """Entrypoint for CLI execution."""
    args = parse_args()
    # Keep insertion order but remove duplicates when repeated on CLI.
    expected_models = [args.llm_model, args.embed_model]
    tester = BackendE2ETester(
        base_url=args.base_url,
        ollama_base_url=args.ollama_base_url,
        expected_models=expected_models,
        llm_model=args.llm_model,
        embed_model=args.embed_model,
        warmup_keep_alive=args.warmup_keep_alive,
        pdf_path=args.pdf_path,
        health_timeout_seconds=args.health_timeout_seconds,
        request_timeout_seconds=args.request_timeout_seconds,
        long_request_timeout_seconds=args.long_request_timeout_seconds,
    )
    return tester.run()


if __name__ == "__main__":
    sys.exit(main())
