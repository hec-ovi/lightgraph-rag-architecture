export interface DocumentIngestionTask {
  groupId: string;
  expectedMinDocuments: number;
  filename: string;
  source: "text" | "file";
  startedAt: string;
}

const STORAGE_KEY = "lightgraph.document.ingestion.task";
const TASK_EVENT = "document-ingestion-task-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getDocumentIngestionTask(): DocumentIngestionTask | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DocumentIngestionTask;
    if (
      !parsed.groupId ||
      !parsed.expectedMinDocuments ||
      !parsed.filename ||
      !parsed.source ||
      !parsed.startedAt
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setDocumentIngestionTask(task: DocumentIngestionTask): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(task));
  window.dispatchEvent(new CustomEvent(TASK_EVENT));
}

export function clearDocumentIngestionTask(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(TASK_EVENT));
}

export const documentIngestionTaskEvent = TASK_EVENT;
