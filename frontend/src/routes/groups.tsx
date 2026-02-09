import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, FileText, MessageSquare } from "lucide-react";
import {
  GroupList,
  GroupForm,
  DocumentList,
  DocumentForm,
  Button,
  EmptyState,
} from "../components";
import { groupService, documentService } from "../services";
import type { Group } from "../types";

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

  const selectedGroupId = search.groupId ?? selectedGroup?.id ?? null;

  const { data: selectedGroupData } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupService.get(selectedGroupId!),
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

  if (activeGroup) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/groups">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Groups
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              {activeGroup.name}
            </h1>
            {activeGroup.description && (
              <p className="text-muted-foreground mt-1">
                {activeGroup.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/query" search={{ groupId: activeGroup.id }}>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-1" />
                Query
              </Button>
            </Link>
            <Link to="/conversations" search={{ groupId: activeGroup.id }}>
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-1" />
                Chat
              </Button>
            </Link>
          </div>
        </div>

        <DocumentList
          groupId={activeGroup.id}
          onInsertText={() => setIsDocumentFormOpen(true)}
        />

        <DocumentForm
          open={isDocumentFormOpen}
          onClose={() => setIsDocumentFormOpen(false)}
          onSubmit={handleCreateDocument}
          isSubmitting={createDocumentMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-muted-foreground">
          Manage your document collections
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <GroupList
            selectedGroupId={selectedGroupId}
            onSelectGroup={handleSelectGroup}
            onCreateGroup={() => {
              setEditingGroup(null);
              setIsGroupFormOpen(true);
            }}
            onEditGroup={handleEditGroup}
          />
        </div>

        <div className="lg:col-span-2">
          <EmptyState
            title="Select a group"
            description="Choose a group from the list to view its documents and details."
          />
        </div>
      </div>

      <GroupForm
        open={isGroupFormOpen}
        onClose={() => {
          setIsGroupFormOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
        group={editingGroup}
        isSubmitting={
          createGroupMutation.isPending || updateGroupMutation.isPending
        }
      />
    </div>
  );
}
