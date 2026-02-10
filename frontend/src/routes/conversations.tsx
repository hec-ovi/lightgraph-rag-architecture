import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, 
  FolderOpen, 
  Send, 
  Plus,
  Trash2,
  ChevronDown,
  Bot,
  User,
  Square,
} from "lucide-react";
import { 
  Button, 
  Card, 
  Textarea, 
  EmptyState, 
  Skeleton,
  Badge,
} from "../components";
import { groupService, conversationService } from "../services";
import type { Conversation, Message, QueryMode } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/conversations")({
  component: ConversationsPage,
});

const QUERY_MODES: { value: QueryMode; label: string }[] = [
  { value: "mix", label: "Mix" },
  { value: "naive", label: "Naive" },
  { value: "local", label: "Local" },
  { value: "global", label: "Global" },
  { value: "hybrid", label: "Hybrid" },
];

function ConversationsPage() {
  const search = useSearch({ from: "/conversations" }) as { groupId?: string };
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(search.groupId || null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingInput, setPendingInput] = useState("");
  const [mode, setMode] = useState<QueryMode>("mix");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChatAbortRef = useRef<AbortController | null>(null);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations", selectedGroupId],
    queryFn: () => conversationService.list(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const { data: conversationData } = useQuery({
    queryKey: ["conversation", selectedGroupId, selectedConversation?.id],
    queryFn: () => conversationService.get(selectedGroupId!, selectedConversation!.id),
    enabled: !!selectedGroupId && !!selectedConversation,
  });

  const { data: selectedGroup } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupService.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const createConversationMutation = useMutation({
    mutationFn: (title: string) => conversationService.create(selectedGroupId!, { title }),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", selectedGroupId] });
      setSelectedConversation(conversation);
      setMessages([]);
      setShowNewChat(false);
      setNewChatTitle("");
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => conversationService.delete(selectedGroupId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", selectedGroupId] });
      if (selectedConversation && conversations) {
        const remaining = conversations.filter(c => c.id !== selectedConversation.id);
        setSelectedConversation(remaining[0] || null);
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (conversationData) {
      setMessages(conversationData.messages);
    }
  }, [conversationData]);

  useEffect(() => {
    return () => {
      activeChatAbortRef.current?.abort();
    };
  }, []);

  const handleCreateConversation = () => {
    if (!newChatTitle.trim()) return;
    createConversationMutation.mutate(newChatTitle.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedGroupId || !selectedConversation) return;

    const currentInput = input.trim();
    const abortController = new AbortController();
    activeChatAbortRef.current = abortController;
    setInput("");
    setPendingInput(currentInput);
    setIsLoading(true);
    setStreamingContent("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      role: "user",
      content: currentInput,
      query_mode: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    let fullResponse = "";

    try {
      await conversationService.chat(
        selectedGroupId,
        selectedConversation.id,
        { message: currentInput, mode },
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ["conversation", selectedGroupId, selectedConversation.id] 
          });
          activeChatAbortRef.current = null;
          setStreamingContent("");
          setPendingInput("");
          setIsLoading(false);
        },
        (error) => {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            conversation_id: selectedConversation.id,
            role: "assistant",
            content: `Error: ${error}`,
            query_mode: mode,
            created_at: new Date().toISOString(),
          }]);
          activeChatAbortRef.current = null;
          setStreamingContent("");
          setPendingInput("");
          setIsLoading(false);
        },
        abortController.signal
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        conversation_id: selectedConversation.id,
        role: "assistant",
        content: "Error: Request failed before stream initialization.",
        query_mode: mode,
        created_at: new Date().toISOString(),
      }]);
      activeChatAbortRef.current = null;
      setPendingInput("");
      setIsLoading(false);
    }
  };

  const handleCancelChat = () => {
    if (!isLoading || !selectedConversation) return;

    activeChatAbortRef.current?.abort();
    activeChatAbortRef.current = null;

    setMessages((prev) => [
      ...prev,
      {
        id: `interrupt-${Date.now()}`,
        conversation_id: selectedConversation.id,
        role: "assistant",
        content: streamingContent
          ? `${streamingContent}\n\n_Interrupted by user._`
          : `_Interrupted by user while processing: ${pendingInput || "request"}._`,
        query_mode: mode,
        created_at: new Date().toISOString(),
      },
    ]);

    setStreamingContent("");
    setPendingInput("");
    setIsLoading(false);
    queryClient.invalidateQueries({
      queryKey: ["conversation", selectedGroupId, selectedConversation.id],
    });
  };

  const groups = groupsData?.groups || [];
  const conversations = conversationsData?.conversations || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Conversations
          </h1>
          <p className="text-muted-foreground">Chat with persistent context and memory</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Group:</span>
          {groupsLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="relative">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors min-w-[200px]"
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left truncate">
                  {selectedGroup?.name || "Select a group..."}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {showGroupDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowGroupDropdown(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-full min-w-[240px] max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors ${
                          selectedGroupId === group.id 
                            ? "bg-accent text-accent-foreground" 
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setSelectedConversation(null);
                          setMessages([]);
                          setShowGroupDropdown(false);
                        }}
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <p className="font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">{group.document_count} docs</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedGroupId ? (
        <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
          {/* Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Button 
              className="w-full" 
              onClick={() => setShowNewChat(true)}
              disabled={!selectedGroupId}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Conversation
            </Button>

            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <h3 className="font-semibold text-sm">Conversations</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversationsLoading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedConversation?.id === conv.id
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {conv.message_count} messages • {" "}
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            {selectedConversation ? (
              <Card className="h-full flex flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{selectedConversation.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedGroup?.name} • {selectedConversation.message_count} messages
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as QueryMode)}
                      className="h-8 px-2 text-sm rounded-md border bg-background"
                    >
                      {QUERY_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteConversationMutation.mutate(selectedConversation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-6"
                >
                  {messages.length === 0 && !streamingContent && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Bot className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                      <p className="text-muted-foreground max-w-sm">
                        Send a message to start chatting with your knowledge base. The AI remembers context from previous messages.
                      </p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div key={message.id || index} className="flex gap-3">
                      {message.role === "user" ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {message.query_mode && (
                                <Badge variant="secondary" className="text-xs">
                                  {message.query_mode}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {streamingContent && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <span className="text-xs text-muted-foreground">Generating response...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t p-4 bg-muted/30">
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isLoading}
                      rows={1}
                      className="flex-1 min-h-[44px] max-h-[200px] resize-none py-3"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                    <Button
                      type={isLoading ? "button" : "submit"}
                      onClick={isLoading ? handleCancelChat : undefined}
                      variant={isLoading ? "destructive" : "default"}
                      disabled={isLoading ? false : !input.trim()}
                      className="h-auto px-4"
                      title={isLoading ? "Stop generation" : "Send message"}
                    >
                      {isLoading ? (
                        <Square className="h-5 w-5" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </form>
                </div>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8" />}
                  title="Select a conversation"
                  description="Choose a conversation or start a new one to begin chatting"
                  action={
                    <Button onClick={() => setShowNewChat(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Conversation
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center">
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="Select a group"
            description="Choose a group to view and manage its conversations"
          />
        </div>
      )}

      {/* New Chat Dialog */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">New Conversation</h3>
            <input
              type="text"
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder="Conversation title (optional)"
              className="w-full px-3 py-2 rounded-md border bg-background mb-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateConversation();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowNewChat(false);
                setNewChatTitle("");
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateConversation}
                disabled={createConversationMutation.isPending}
              >
                {createConversationMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
