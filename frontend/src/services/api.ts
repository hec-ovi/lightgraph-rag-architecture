const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function getStreamReader(
  path: string,
  body: unknown
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Stream request failed");
  if (!res.body) throw new Error("No response body");
  return res.body.getReader();
}
