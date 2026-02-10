import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  FileText,
  FolderOpen,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  GroupForm,
  Input,
  Skeleton,
  Textarea,
} from "../components";
import { documentService, groupService } from "../services";
import type { Group } from "../types";
import {
  clearDocumentIngestionTask,
  setDocumentIngestionTask,
} from "../lib/documentIngestionTask";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const search = useSearch({ from: "/groups" }) as { groupId?: string };
  const queryClient = useQueryClient();

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [textFilename, setTextFilename] = useState("");
  const [textContent, setTextContent] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGroupId = search.groupId ?? selectedGroup?.id ?? null;

  const { data: selectedGroupData } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupService.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", selectedGroupId],
    queryFn: () => documentService.list(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const groups = groupsData?.groups || [];
  const documents = documentsData?.documents || [];

  const invalidateDocumentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["documents", selectedGroupId] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
  };

  const registerIngestionTask = (filename: string, source: "text" | "file") => {
    if (!selectedGroupId) return;

    setDocumentIngestionTask({
      groupId: selectedGroupId,
      expectedMinDocuments: (documentsData?.total ?? 0) + 1,
      filename,
      source,
      startedAt: new Date().toISOString(),
    });
  };

  const createGroupMutation = useMutation({
    mutationFn: groupService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsGroupFormOpen(false);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof groupService.update>[1];
    }) => groupService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      setIsGroupFormOpen(false);
      setEditingGroup(null);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: groupService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedGroup(null);
      setMenuOpenId(null);
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: (data: Parameters<typeof documentService.create>[1]) =>
      documentService.create(selectedGroupId!, data),
    onSuccess: () => {
      invalidateDocumentQueries();
      setTextFilename("");
      setTextContent("");
      setComposerError(null);
      clearDocumentIngestionTask();
    },
    onError: (error: Error) => {
      setComposerError(error.message || "Failed to insert text document.");
      clearDocumentIngestionTask();
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => documentService.upload(selectedGroupId!, file),
    onSuccess: () => {
      invalidateDocumentQueries();
      clearDocumentIngestionTask();
    },
    onError: (error: Error) => {
      setComposerError(error.message || "Failed to upload file.");
      clearDocumentIngestionTask();
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      documentService.delete(selectedGroupId!, documentId),
    onMutate: (documentId: string) => {
      setDeletingDocumentId(documentId);
    },
    onSuccess: () => {
      invalidateDocumentQueries();
    },
    onSettled: () => {
      setDeletingDocumentId(null);
    },
  });

  const isIngesting = createDocumentMutation.isPending || uploadDocumentMutation.isPending;

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setIsGroupFormOpen(true);
    setMenuOpenId(null);
  };

  const handleCreateGroup = (data: { name: string; description: string }) => {
    createGroupMutation.mutate(data);
  };

  const handleUpdateGroup = (data: { name: string; description: string }) => {
    if (!editingGroup) return;
    updateGroupMutation.mutate({ id: editingGroup.id, data });
  };

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGroupId) return;

    const trimmedContent = textContent.trim();
    if (!trimmedContent) {
      setComposerError("Content is required.");
      return;
    }

    const filename = textFilename.trim() || "manual_input.txt";
    setComposerError(null);
    registerIngestionTask(filename, "text");
    createDocumentMutation.mutate({
      filename,
      content: trimmedContent,
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedGroupId) return;

    setComposerError(null);
    registerIngestionTask(file.name, "file");
    uploadDocumentMutation.mutate(file);
    event.target.value = "";
  };

  const handleDeleteDocument = (documentId: string, filename: string) => {
    if (!selectedGroupId) return;

    const confirmed = window.confirm(`Delete document "${filename}"?`);
    if (!confirmed) return;

    deleteDocumentMutation.mutate(documentId);
  };

  const activeGroup = selectedGroupData || selectedGroup;

  if (activeGroup) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/groups" className="hover:text-foreground transition-colors">
            Groups
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{activeGroup.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <FolderOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{activeGroup.name}</h1>
              {activeGroup.description ? (
                <p className="text-muted-foreground mt-1">{activeGroup.description}</p>
              ) : null}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{activeGroup.document_count} documents</span>
                <span>•</span>
                <span>
                  Updated {formatDistanceToNow(new Date(activeGroup.updated_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/query" search={{ groupId: activeGroup.id }}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Query
              </Button>
            </Link>
            <Link to="/conversations" search={{ groupId: activeGroup.id }}>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add Documents</h2>

          <Card>
            <CardContent className="p-4 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".txt,.md,.csv,.json,.xml,.html,.py,.js,.ts,.yaml,.yml,.log,.pdf"
                disabled={isIngesting}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleUploadClick} disabled={isIngesting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadDocumentMutation.isPending ? "Uploading..." : "Upload File"}
                </Button>
                {isIngesting ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing document
                  </Badge>
                ) : null}
              </div>

              <form onSubmit={handleTextSubmit} className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filename</label>
                  <Input
                    value={textFilename}
                    onChange={(event) => setTextFilename(event.target.value)}
                    placeholder="manual_input.txt"
                    disabled={isIngesting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Content</label>
                  <Textarea
                    value={textContent}
                    onChange={(event) => setTextContent(event.target.value)}
                    rows={8}
                    disabled={isIngesting}
                    placeholder="Paste text to ingest..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{textContent.length} characters</p>
                </div>

                {composerError ? (
                  <p className="text-sm text-destructive">{composerError}</p>
                ) : null}

                <Button type="submit" disabled={isIngesting || !textContent.trim()}>
                  {createDocumentMutation.isPending ? "Adding..." : "Add Text Document"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Documents</h2>

          {docsLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              title="No documents yet"
              description="Upload files or paste text to build your knowledge graph."
              action={
                <Button variant="outline" onClick={handleUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {(doc.content_length / 1024).toFixed(1)} KB •{" "}
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                      disabled={deletingDocumentId === doc.id}
                    >
                      {deletingDocumentId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground">Manage your document collections</p>
        </div>
        <Button onClick={() => setIsGroupFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      {groupsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group to start organizing your documents"
          action={
            <Button onClick={() => setIsGroupFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => handleSelectGroup(group)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div
                    className="relative"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpenId(menuOpenId === group.id ? null : group.id);
                    }}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {menuOpenId === group.id ? (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border bg-popover p-1 shadow-lg">
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditGroup(group);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteGroupMutation.mutate(group.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                  {group.name}
                </h3>
                {group.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{group.description}</p>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="secondary">{group.document_count} docs</Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(group.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupForm
        open={isGroupFormOpen}
        onClose={() => {
          setIsGroupFormOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
        group={editingGroup}
        isSubmitting={createGroupMutation.isPending || updateGroupMutation.isPending}
      />
    </div>
  );
}
