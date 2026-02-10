import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { documentService } from "../services";
import {
  clearDocumentIngestionTask,
  documentIngestionTaskEvent,
  getDocumentIngestionTask,
  type DocumentIngestionTask,
} from "../lib/documentIngestionTask";

interface UseDocumentIngestionStatusResult {
  task: DocumentIngestionTask | null;
  isBlocking: boolean;
  hasError: boolean;
  currentDocuments: number;
  clearTask: () => void;
}

export function useDocumentIngestionStatus(): UseDocumentIngestionStatusResult {
  const [task, setTask] = useState<DocumentIngestionTask | null>(() =>
    getDocumentIngestionTask()
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "lightgraph.document.ingestion.task") {
        setTask(getDocumentIngestionTask());
      }
    };
    const onTaskUpdate = () => {
      setTask(getDocumentIngestionTask());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(documentIngestionTaskEvent, onTaskUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(documentIngestionTaskEvent, onTaskUpdate);
    };
  }, []);

  const docsQuery = useQuery({
    queryKey: ["document-ingestion-check", task?.groupId],
    queryFn: () => documentService.list(task!.groupId),
    enabled: !!task,
    refetchInterval: task ? 2000 : false,
    retry: 2,
  });

  useEffect(() => {
    if (!task || !docsQuery.data) return;

    if (docsQuery.data.total >= task.expectedMinDocuments) {
      clearDocumentIngestionTask();
    }
  }, [task, docsQuery.data]);

  const clearTask = () => {
    clearDocumentIngestionTask();
    setTask(null);
  };

  return {
    task,
    isBlocking: !!task,
    hasError: docsQuery.isError,
    currentDocuments: docsQuery.data?.total ?? 0,
    clearTask,
  };
}
