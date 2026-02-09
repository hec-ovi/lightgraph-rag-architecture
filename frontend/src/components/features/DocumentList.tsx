import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, Plus, File } from "lucide-react";
import { useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  EmptyState,
  Skeleton,
  Badge,
} from "../ui";
import { documentService } from "../../services";

import { formatDistanceToNow } from "date-fns";

interface DocumentListProps {
  groupId: string;

  onInsertText: () => void;
}

function DocumentList({ groupId, onInsertText }: DocumentListProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", groupId],
    queryFn: () => documentService.list(groupId),
    enabled: !!groupId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentService.upload(groupId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <File className="h-5 w-5 text-red-500" />;
    if (["md", "txt"].includes(ext || ""))
      return <FileText className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const documents = data?.documents || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Documents
          {documents.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {documents.length}
            </Badge>
          )}
        </h2>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".txt,.md,.csv,.json,.xml,.html,.py,.js,.ts,.yaml,.yml,.log,.pdf"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <Button size="sm" onClick={onInsertText}>
            <Plus className="h-4 w-4 mr-1" />
            Add Text
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload files or paste text to build your knowledge graph."
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload File
              </Button>
              <Button onClick={onInsertText}>
                <Plus className="h-4 w-4 mr-1" />
                Add Text
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      {getFileIcon(doc.filename)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {doc.filename}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {formatFileSize(doc.content_length)} •{" "}
                        {formatDistanceToNow(new Date(doc.created_at), {
                          addSuffix: true,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { DocumentList };
