import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FolderOpen } from "lucide-react";
import { QueryPanel, Select, EmptyState, Skeleton } from "../components";
import { groupService } from "../services";


export const Route = createFileRoute("/query")({
  component: QueryPage,
});

function QueryPage() {
  const search = useSearch({ from: "/query" }) as { groupId?: string };
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    search.groupId || null
  );

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const { isLoading: groupLoading } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupService.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const groups = groupsData?.groups || [];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Query Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Ask questions and get AI-powered answers from your documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group:</span>
          {groupsLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : groups.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No groups available
            </span>
          ) : (
            <Select
              value={selectedGroupId || ""}
              onChange={(e) => setSelectedGroupId(e.target.value || null)}
              className="w-64"
            >
              <option value="">Select a group...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.document_count} docs)
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {selectedGroupId ? (
        groupLoading ? (
          <Skeleton className="flex-1" />
        ) : (
          <div className="flex-1 min-h-0">
            <QueryPanel groupId={selectedGroupId} />
          </div>
        )
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="Select a group"
            description="Choose a group to start querying its knowledge base."
          />
        </div>
      )}
    </div>
  );
}
