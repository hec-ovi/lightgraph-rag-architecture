import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Folder, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  EmptyState,
  Skeleton,
} from "../ui";
import { groupService } from "../../services";
import type { Group } from "../../types";
import { formatDistanceToNow } from "date-fns";

interface GroupListProps {
  selectedGroupId: string | null;
  onSelectGroup: (group: Group) => void;
  onCreateGroup: () => void;
  onEditGroup: (group: Group) => void;
}

function GroupList({
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  onEditGroup,
}: GroupListProps) {
  const queryClient = useQueryClient();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => groupService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setOpenMenuId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const groups = data?.groups || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Groups</h2>
        <Button size="sm" onClick={onCreateGroup}>
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group to start organizing your documents."
          action={
            <Button onClick={onCreateGroup}>
              <Plus className="h-4 w-4 mr-1" />
              Create Group
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                selectedGroupId === group.id ? "border-primary bg-accent" : ""
              }`}
              onClick={() => onSelectGroup(group)}
            >
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {group.document_count} documents • Updated{" "}
                        {formatDistanceToNow(new Date(group.updated_at), {
                          addSuffix: true,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === group.id ? null : group.id);
                      }}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMenuId === group.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 w-32 rounded-md border bg-popover p-1 shadow-md">
                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditGroup(group);
                              setOpenMenuId(null);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(group.id);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
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

export { GroupList };
