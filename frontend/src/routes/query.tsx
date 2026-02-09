import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  FolderOpen, 
  Send, 
  Loader2, 
  Sparkles,
  ChevronDown
} from "lucide-react";
import { 
  Button, 
  Card, 
  CardContent,
  Textarea, 
  EmptyState, 
  Skeleton,
  Badge,
} from "../components";
import { groupService, queryService } from "../services";
import type { QueryMode } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/query")({
  component: QueryPage,
});

const QUERY_MODES: { value: QueryMode; label: string; desc: string }[] = [
  { value: "mix", label: "Mix", desc: "Graph + Vector (recommended)" },
  { value: "naive", label: "Naive", desc: "Vector only (fast)" },
  { value: "local", label: "Local", desc: "Entity-focused" },
  { value: "global", label: "Global", desc: "Relationship-focused" },
  { value: "hybrid", label: "Hybrid", desc: "Local + Global" },
];

interface QueryResult {
  query: string;
  response: string;
  mode: QueryMode;
  timestamp: Date;
}

function QueryPage() {
  const search = useSearch({ from: "/query" }) as { groupId?: string };
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(search.groupId || null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QueryMode>("mix");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupService.list(),
  });

  const { data: selectedGroup } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupService.get(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, streamingResponse]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading || !selectedGroupId) return;

    const currentQuery = query.trim();
    setQuery("");
    setIsLoading(true);
    setStreamingResponse("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let fullResponse = "";

    try {
      await queryService.query(
        selectedGroupId,
        { query: currentQuery, mode },
        (chunk) => {
          fullResponse += chunk;
          setStreamingResponse(fullResponse);
        },
        () => {
          setResults((prev) => [
            ...prev,
            { query: currentQuery, response: fullResponse, mode, timestamp: new Date() },
          ]);
          setStreamingResponse("");
          setIsLoading(false);
        },
        (error) => {
          setResults((prev) => [
            ...prev,
            { query: currentQuery, response: `Error: ${error}`, mode, timestamp: new Date() },
          ]);
          setStreamingResponse("");
          setIsLoading(false);
        }
      );
    } catch {
      setIsLoading(false);
    }
  };

  const groups = groupsData?.groups || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Query Knowledge Base
          </h1>
          <p className="text-muted-foreground">Ask questions and get AI-powered answers</p>
        </div>

        {/* Group Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Group:</span>
          {groupsLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="relative">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-background hover:bg-accent transition-colors min-w-[200px]"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left truncate">
                  {selectedGroup?.name || "Select a group..."}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {showModeDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowModeDropdown(false)}
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
                          setShowModeDropdown(false);
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
          {/* Sidebar - Mode Selection */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="h-fit">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">Query Mode</h3>
                <div className="space-y-1">
                  {QUERY_MODES.map((m) => (
                    <button
                      key={m.value}
                      className={`w-full flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                        mode === m.value
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => setMode(m.value)}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className={`text-xs ${mode === m.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {m.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2">Current Group</h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedGroup?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedGroup?.document_count} documents
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-6"
              >
                {results.length === 0 && !streamingResponse && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Ready to query</h3>
                    <p className="text-muted-foreground max-w-sm">
                      Ask a question about your documents. The AI will search through your knowledge graph to find relevant answers.
                    </p>
                  </div>
                )}

                {results.map((result, index) => (
                  <div key={index} className="space-y-4">
                    {/* User message */}
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">You</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm leading-relaxed">{result.query}</p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {result.mode} mode
                        </Badge>
                      </div>
                    </div>

                    {/* AI response */}
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result.response}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {streamingResponse && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">You</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm">{results[results.length - 1]?.query || query}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {streamingResponse}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <span className="text-xs text-muted-foreground">Generating response...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="border-t p-4 bg-muted/30">
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <Textarea
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question about your documents..."
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
                    type="submit" 
                    disabled={!query.trim() || isLoading}
                    className="h-auto px-4"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center">
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="Select a group"
            description="Choose a group to start querying its knowledge base"
          />
        </div>
      )}
    </div>
  );
}
