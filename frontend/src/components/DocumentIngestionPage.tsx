import { Loader2 } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "./ui";

interface DocumentIngestionPageProps {
  filename: string;
  source: "text" | "file";
  expectedMinDocuments: number;
  currentDocuments: number;
  hasError: boolean;
  onClear: () => void;
}

export function DocumentIngestionPage({
  filename,
  source,
  expectedMinDocuments,
  currentDocuments,
  hasError,
  onClear,
}: DocumentIngestionPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Loading Document...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Document ingestion is still running. This page stays blocked until the document is
            fully processed.
          </p>
          <div className="grid gap-2 rounded-lg border p-4 text-sm">
            <div>
              <span className="font-medium">Source:</span> {source}
            </div>
            <div>
              <span className="font-medium">Filename:</span> {filename}
            </div>
            <div>
              <span className="font-medium">Progress:</span>{" "}
              {currentDocuments} / at least {expectedMinDocuments} documents
            </div>
          </div>

          {hasError ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Could not verify ingestion progress from the API. You can clear this state and continue.
            </div>
          ) : null}

          <Button variant="outline" onClick={onClear}>
            Clear Ingestion State
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
