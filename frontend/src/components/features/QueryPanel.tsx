import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Select,
  Badge,
} from "../ui";
import { queryService } from "../../services";
import type { QueryMode } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface QueryPanelProps {
  groupId: string;
}

interface QueryResult {
  query: string;
  response: string;
  mode: QueryMode;
  timestamp: Date;
}

const QUERY_MODES: { value: QueryMode; label: string; description: string }[] =
  [
    { value: "mix", label: "Mix", description: "Graph + vector (recommended)" },
    { value: "naive", label: "Naive", description: "Vector only (fast)" },
    { value: "local", label: "Local", description: "Entity-focused" },
    { value: "global", label: "Global", description: "Relationship-focused" },
    { value: "hybrid", label: "Hybrid", description: "Local + global" },
  ];

function QueryPanel({ groupId }: QueryPanelProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QueryMode>("mix");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [streamingResponse, setStreamingResponse] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, streamingResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const currentQuery = query.trim();
    setQuery("");
    setIsLoading(true);
    setStreamingResponse("");

    let fullResponse = "";

    try {
      await queryService.query(
        groupId,
        { query: currentQuery, mode },
        (chunk) => {
          fullResponse += chunk;
          setStreamingResponse(fullResponse);
        },
        () => {
          setResults((prev) => [
            ...prev,
            {
              query: currentQuery,
              response: fullResponse,
              mode,
              timestamp: new Date(),
            },
          ]);
          setStreamingResponse("");
          setIsLoading(false);
        },
        (error) => {
          setResults((prev) => [
            ...prev,
            {
              query: currentQuery,
              response: `Error: ${error}`,
              mode,
              timestamp: new Date(),
            },
          ]);
          setStreamingResponse("");
          setIsLoading(false);
        }
      );
    } catch {
      setIsLoading(false);
      setStreamingResponse("");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Query Knowledge Base</CardTitle>
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

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 pr-2"
        >
          {results.length === 0 && !streamingResponse && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Ask a question</p>
              <p className="text-sm">
                Query your knowledge base using natural language
              </p>
            </div>
          )}

          {results.map((result, index) => (
            <div key={index} className="space-y-2 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">You</span>
                </div>
                <div className="flex-1 bg-muted rounded-lg p-3">
                  <p className="text-sm">{result.query}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {result.mode}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 bg-accent rounded-lg p-3">
                  <div className="markdown prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.response}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {streamingResponse && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">You</span>
                </div>
                <div className="flex-1 bg-muted rounded-lg p-3">
                  <p className="text-sm">
                    {results.length > 0
                      ? results[results.length - 1].query
                      : query}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {mode}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 bg-accent rounded-lg p-3">
                  <div className="markdown prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingResponse}
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

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
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
      </CardContent>
    </Card>
  );
}

export { QueryPanel };
