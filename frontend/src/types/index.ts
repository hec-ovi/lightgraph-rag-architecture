// Group types
export interface Group {
  id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

export interface GroupsListResponse {
  groups: Group[];
  total: number;
}

// Document types
export interface Document {
  id: string;
  group_id: string;
  filename: string;
  content_length: number;
  created_at: string;
}

export interface CreateDocumentRequest {
  content: string;
  filename?: string;
}

export interface DocumentsListResponse {
  documents: Document[];
  total: number;
}

// Query types
export type QueryMode = "naive" | "local" | "global" | "hybrid" | "mix";

export interface QueryRequest {
  query: string;
  mode?: QueryMode;
}

export interface QueryResponse {
  query: string;
  mode: QueryMode;
  response: string;
  group_id: string;
}

export interface QueryStreamChunk {
  type: "chunk" | "done" | "error";
  data: string;
}

// Conversation types
export interface Conversation {
  id: string;
  group_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  query_mode: QueryMode | null;
  created_at: string;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface ConversationsListResponse {
  conversations: Conversation[];
  total: number;
}

export interface ChatRequest {
  message: string;
  mode?: QueryMode;
}

export interface ChatResponse {
  user_message: Message;
  assistant_message: Message;
}

// Health
export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  models_loaded: boolean;
  loaded_models: string[];
}

// Error
export interface ApiError {
  detail: string;
}
