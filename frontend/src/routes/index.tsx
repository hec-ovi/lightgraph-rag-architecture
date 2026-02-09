import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  Brain, 
  FolderOpen, 
  MessageSquare, 
  Search, 
  ArrowRight,
  Sparkles,
  FileText,
  Zap,
  Database
} from "lucide-react";
import { Card, CardContent, Button } from "../components";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const features = [
    {
      title: "Groups",
      description: "Organize documents into isolated knowledge collections with separate graphs",
      icon: FolderOpen,
      href: "/groups",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Query",
      description: "Ask questions using 5 RAG modes including knowledge graph + vector hybrid",
      icon: Search,
      href: "/query",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Chat",
      description: "Have persistent conversations with memory-aware context and streaming",
      icon: MessageSquare,
      href: "/conversations",
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  const stats = [
    { label: "RAG Modes", value: "5", icon: Zap },
    { label: "Query Types", value: "Graph + Vector", icon: Database },
    { label: "Memory", value: "Persistent", icon: Brain },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative text-center py-12 md:py-16">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <Sparkles className="h-4 w-4" />
          <span>Powered by LightRAG + Ollama</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Knowledge Graph{" "}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            RAG System
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload documents, build knowledge graphs automatically, and query with 
          AI-powered retrieval using local LLMs. Fully private, fully local.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/groups">
            <Button size="lg" className="h-12 px-8 text-base">
              <FolderOpen className="mr-2 h-5 w-5" />
              Create Group
            </Button>
          </Link>
          <Link to="/query">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              <Search className="mr-2 h-5 w-5" />
              Start Query
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 mt-16">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Get Started</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Choose a feature to begin exploring your documents with AI
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} to={feature.href}>
                <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/50 cursor-pointer overflow-hidden">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}>
                      <div className={`bg-gradient-to-br ${feature.color} p-2.5 rounded-lg`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <div className="flex items-center text-sm font-medium text-primary">
                      Get started
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 rounded-2xl p-8 md:p-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            From documents to insights in four simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {[
            { 
              step: "01", 
              title: "Create Group", 
              desc: "Organize documents into isolated knowledge collections",
              icon: FolderOpen
            },
            { 
              step: "02", 
              title: "Upload Docs", 
              desc: "Add files or paste text to populate your knowledge base",
              icon: FileText
            },
            { 
              step: "03", 
              title: "Build Graph", 
              desc: "LightRAG extracts entities and relationships automatically",
              icon: Database
            },
            { 
              step: "04", 
              title: "Query & Chat", 
              desc: "Ask questions with graph + vector hybrid retrieval",
              icon: Sparkles
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative text-center">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent" />
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background border-2 border-primary/20 shadow-sm mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-xs font-bold text-primary/60 mb-2">{item.step}</div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Query Modes */}
      <section>
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Query Modes</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Choose the right retrieval strategy for your question
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { name: "Naive", desc: "Vector only", use: "Simple search", color: "bg-slate-500" },
            { name: "Local", desc: "Entity-focused", use: "Specific facts", color: "bg-blue-500" },
            { name: "Global", desc: "Relationship-focused", use: "Broad concepts", color: "bg-indigo-500" },
            { name: "Hybrid", desc: "Local + Global", use: "Complex queries", color: "bg-violet-500" },
            { name: "Mix", desc: "Graph + Vector", use: "Best overall ✓", color: "bg-emerald-500" },
          ].map((mode) => (
            <div 
              key={mode.name} 
              className="p-5 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className={`w-3 h-3 rounded-full ${mode.color} mb-3`} />
              <h4 className="font-semibold mb-1">{mode.name}</h4>
              <p className="text-xs text-muted-foreground mb-2">{mode.desc}</p>
              <p className="text-xs font-medium text-primary/80">{mode.use}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
