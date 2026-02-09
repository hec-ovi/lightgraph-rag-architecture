import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, MoreHorizontal, Trash2 } from "lucide-react";
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
import { conversationService } from "../../services";
import type { Conversation } from "../../types";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  groupId: string;
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onCreateConversation: () => void;
}

function ConversationList({
  groupId,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
}: ConversationListProps) {
  const queryClient = useQueryClient();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", groupId],
    queryFn: () => conversationService.list(groupId),
    enabled: !!groupId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => conversationService.delete(groupId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", groupId] });
      setOpenMenuId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const conversations = data?.conversations || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <Button size="sm" onClick={onCreateConversation}>
          <Plus className="h-4 w-4 mr-1" />
          New Chat
        </Button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start a new conversation to chat with your knowledge base."
          action={
            <Button onClick={onCreateConversation}>
              <Plus className="h-4 w-4 mr-1" />
              Start Chat
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <Card
              key={conversation.id}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                selectedConversationId === conversation.id
                  ? "border-primary bg-accent"
                  : ""
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {conversation.title}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {conversation.message_count} messages •{" "}
                        {formatDistanceToNow(new Date(conversation.updated_at), {
                          addSuffix: true,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(
                          openMenuId === conversation.id ? null : conversation.id
                        );
                      }}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMenuId === conversation.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 w-32 rounded-md border bg-popover p-1 shadow-md">
                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(conversation.id);
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

export { ConversationList };
