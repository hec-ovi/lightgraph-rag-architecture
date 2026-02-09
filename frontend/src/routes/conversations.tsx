import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageSquare, FolderOpen } from "lucide-react";
import {
  ConversationList,
  ConversationPanel,
  ConversationForm,
  Select,
  EmptyState,
  Skeleton,
} from "../components";
import { groupService, conversationService } from "../services";
import type { Conversation, Message } from "../types";

export const Route = createFileRoute("/conversations")({
  component: ConversationsPage,
});

function ConversationsPage() {
  const search = useSearch({ from: "/conversations" }) as { groupId?: string };
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    search.groupId || null
  );
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConversationFormOpen, setIsConversationFormOpen] = useState(false);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const { isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations", selectedGroupId],
    queryFn: () => conversationService.list(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ["conversation", selectedGroupId, selectedConversation?.id],
    queryFn: () =>
      conversationService.get(selectedGroupId!, selectedConversation!.id),
    enabled: !!selectedGroupId && !!selectedConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: (data: Parameters<typeof conversationService.create>[1]) =>
      conversationService.create(selectedGroupId!, data),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: ["conversations", selectedGroupId],
      });
      setIsConversationFormOpen(false);
      setSelectedConversation(conversation);
      setMessages([]);
    },
  });

  const groups = groupsData?.groups || [];

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleCreateConversation = (data: { title: string }) => {
    createConversationMutation.mutate(data);
  };

  const handleMessagesUpdate = (newMessages: Message[]) => {
    setMessages(newMessages);
  };

  // Update messages when conversation data changes
  if (conversationData && conversationData.messages !== messages) {
    setMessages(conversationData.messages);
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Conversations
          </h1>
          <p className="text-muted-foreground">
            Chat with your knowledge base with persistent memory
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
              onChange={(e) => {
                setSelectedGroupId(e.target.value || null);
                setSelectedConversation(null);
                setMessages([]);
              }}
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
        <div className="flex-1 grid lg:grid-cols-4 gap-4 min-h-0">
          <div className="lg:col-span-1 overflow-auto">
            {conversationsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <ConversationList
                groupId={selectedGroupId}
                selectedConversationId={selectedConversation?.id || null}
                onSelectConversation={handleSelectConversation}
                onCreateConversation={() => setIsConversationFormOpen(true)}
              />
            )}
          </div>

          <div className="lg:col-span-3 min-h-0">
            {selectedConversation && selectedGroupId ? (
              conversationLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ConversationPanel
                  groupId={selectedGroupId}
                  conversation={selectedConversation}
                  messages={messages}
                  onMessagesUpdate={handleMessagesUpdate}
                />
              )
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title="Select a conversation"
                description="Choose a conversation or start a new one to begin chatting."
                action={
                  <button
                    onClick={() => setIsConversationFormOpen(true)}
                    className="text-primary hover:underline"
                  >
                    Start a new conversation
                  </button>
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="Select a group"
            description="Choose a group to view and manage its conversations."
          />
        </div>
      )}

      <ConversationForm
        open={isConversationFormOpen}
        onClose={() => setIsConversationFormOpen(false)}
        onSubmit={handleCreateConversation}
        isSubmitting={createConversationMutation.isPending}
      />
    </div>
  );
}
