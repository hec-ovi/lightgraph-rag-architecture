import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FolderOpen, 
  FileText, 
  MessageSquare, 
  Plus,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react";
import {
  GroupForm,
  DocumentForm,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  Badge,
} from "../components";
import { groupService, documentService } from "../services";
import type { Group } from "../types";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const search = useSearch({ from: "/groups" }) as { groupId?: string };
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  const createGroupMutation = useMutation({
    mutationFn: groupService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsGroupFormOpen(false);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof groupService.update>[1] }) =>
      groupService.update(id, data),
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
      queryClient.invalidateQueries({ queryKey: ["documents", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      setIsDocumentFormOpen(false);
    },
  });

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
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data });
    }
  };

  const handleCreateDocument = (data: { content: string; filename: string }) => {
    createDocumentMutation.mutate(data);
  };

  const activeGroup = selectedGroupData || selectedGroup;
  const groups = groupsData?.groups || [];
  const documents = documentsData?.documents || [];

  // Detail view
  if (activeGroup) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/groups" className="hover:text-foreground transition-colors">
            Groups
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{activeGroup.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <FolderOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{activeGroup.name}</h1>
              {activeGroup.description && (
                <p className="text-muted-foreground mt-1">{activeGroup.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{activeGroup.document_count} documents</span>
                <span>•</span>
                <span>Updated {formatDistanceToNow(new Date(activeGroup.updated_at), { addSuffix: true })}</span>
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

        {/* Documents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Documents</h2>
            <Button onClick={() => setIsDocumentFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </div>

          {docsLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              title="No documents yet"
              description="Upload files or paste text to build your knowledge graph"
              action={
                <Button onClick={() => setIsDocumentFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Document
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
                        {(doc.content_length / 1024).toFixed(1)} KB • {" "}
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DocumentForm
          open={isDocumentFormOpen}
          onClose={() => setIsDocumentFormOpen(false)}
          onSubmit={handleCreateDocument}
          isSubmitting={createDocumentMutation.isPending}
        />
      </div>
    );
  }

  // List view
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === group.id ? null : group.id);
                    }}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {menuOpenId === group.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setMenuOpenId(null)}
                        />
                        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border bg-popover p-1 shadow-lg">
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditGroup(group);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteGroupMutation.mutate(group.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                  {group.name}
                </h3>
                {group.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {group.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="secondary">
                    {group.document_count} docs
                  </Badge>
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
