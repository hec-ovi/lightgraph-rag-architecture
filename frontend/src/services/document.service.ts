import { fetchApi } from "./api";
import type {
  Document,
  DocumentsListResponse,
  CreateDocumentRequest,
} from "../types";

export const documentService = {
  list: (groupId: string): Promise<DocumentsListResponse> =>
    fetchApi(`/groups/${groupId}/documents`),

  get: (groupId: string, documentId: string): Promise<Document> =>
    fetchApi(`/groups/${groupId}/documents/${documentId}`),

  create: (groupId: string, data: CreateDocumentRequest): Promise<Document> =>
    fetchApi(`/groups/${groupId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  upload: (groupId: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);

    return fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/groups/${groupId}/documents/upload`, {
      method: "POST",
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      return response.json();
    });
  },
};
