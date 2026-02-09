import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Badge,
  Select,
} from "../ui";
import { conversationService } from "../../services";
import type { Conversation, Message, QueryMode } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";

interface ConversationPanelProps {
  groupId: string;
  conversation: Conversation;
  messages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
}

const QUERY_MODES: { value: QueryMode; label: string; description: string }[] =
  [
    { value: "mix", label: "Mix", description: "Graph + vector (recommended)" },
    { value: "naive", label: "Naive", description: "Vector only (fast)" },
    { value: "local", label: "Local", description: "Entity-focused" },
    { value: "global", label: "Global", description: "Relationship-focused" },
    { value: "hybrid", label: "Hybrid", description: "Local + global" },
  ];

function ConversationPanel({
  groupId,
  conversation,
  messages,
  onMessagesUpdate,
}: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<QueryMode>("mix");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    // Optimistically add user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      role: "user",
      content: currentInput,
      query_mode: null,
      created_at: new Date().toISOString(),
    };

    onMessagesUpdate([...messages, userMessage]);

    let fullResponse = "";

    try {
      await conversationService.chat(
        groupId,
        conversation.id,
        { message: currentInput, mode },
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        () => {
          const assistantMessage: Message = {
            id: `msg-${Date.now()}`,
            conversation_id: conversation.id,
            role: "assistant",
            content: fullResponse,
            query_mode: mode,
            created_at: new Date().toISOString(),
          };
          onMessagesUpdate([
            ...messages.filter((m) => m.id !== userMessage.id),
            userMessage,
            assistantMessage,
          ]);
          setStreamingContent("");
          setIsLoading(false);
        },
        (error) => {
          const errorMessage: Message = {
            id: `msg-${Date.now()}`,
            conversation_id: conversation.id,
            role: "assistant",
            content: `Error: ${error}`,
            query_mode: mode,
            created_at: new Date().toISOString(),
          };
          onMessagesUpdate([
            ...messages.filter((m) => m.id !== userMessage.id),
            userMessage,
            errorMessage,
          ]);
          setStreamingContent("");
          setIsLoading(false);
        }
      );
    } catch {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{conversation.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode:</span>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as QueryMode)}
              className="w-40"
            >
              {QUERY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} - {m.description}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0 p-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 p-4"
        >
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">
                Ask questions about your documents with persistent context
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={message.id || index} className="space-y-2 animate-fade-in">
              <div className="flex items-start gap-3">
                {message.role === "user" ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        You
                      </span>
                    </div>
                    <div className="flex-1 bg-muted rounded-lg p-3">
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 bg-accent rounded-lg p-3">
                      <div className="markdown prose prose-sm max-w-none dark:prose-invert">
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
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 bg-accent rounded-lg p-3">
                  <div className="markdown prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={2}
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-auto px-4"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export { ConversationPanel };
