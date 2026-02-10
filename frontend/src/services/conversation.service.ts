import { fetchApi, getStreamReader } from "./api";
import type {
  Conversation,
  ConversationsListResponse,
  CreateConversationRequest,
  ConversationResponse,
  ChatRequest,
  QueryMode,
} from "../types";

export const conversationService = {
  list: (groupId: string): Promise<ConversationsListResponse> =>
    fetchApi(`/groups/${groupId}/conversations`),

  get: (groupId: string, conversationId: string): Promise<ConversationResponse> =>
    fetchApi(`/groups/${groupId}/conversations/${conversationId}`),

  create: (
    groupId: string,
    data: CreateConversationRequest
  ): Promise<Conversation> =>
    fetchApi(`/groups/${groupId}/conversations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (groupId: string, conversationId: string): Promise<void> =>
    fetchApi(`/groups/${groupId}/conversations/${conversationId}`, {
      method: "DELETE",
    }),

  chat: async (
    groupId: string,
    conversationId: string,
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onDone: (metadata: { group_id: string; conversation_id: string; mode: QueryMode }) => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const reader = await getStreamReader(
      `/groups/${groupId}/conversations/${conversationId}/chat/stream`,
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
                onDone({
                  group_id: groupId,
                  conversation_id: conversationId,
                  mode: request.mode || "mix",
                });
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
