import { getStreamReader } from "./api";
import type { QueryRequest, QueryMode } from "../types";

export const queryService = {
  query: async (
    groupId: string,
    request: QueryRequest,
    onChunk: (chunk: string) => void,
    onDone: (metadata: { query: string; mode: QueryMode; group_id: string }) => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const reader = await getStreamReader(
      `/groups/${groupId}/query/stream`,
      request,
      signal
    );
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        let currentEvent: string | null = null;

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            const data = line.slice(6);

            if (currentEvent === "chunk") {
              onChunk(data);
            } else if (currentEvent === "done") {
              try {
                const metadata = JSON.parse(data);
                onDone(metadata);
              } catch {
                onDone({ query: request.query, mode: request.mode || "mix", group_id: groupId });
              }
              return;
            } else if (currentEvent === "error") {
              try {
                const error = JSON.parse(data);
                onError(error.detail || "Stream error");
              } catch {
                onError(data);
              }
              return;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
