import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, FolderOpen, MessageSquare, Search, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, Button } from "../components";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const features = [
    {
      title: "Groups",
      description: "Organize your documents into isolated knowledge collections",
      icon: FolderOpen,
      href: "/groups",
      color: "bg-blue-500",
    },
    {
      title: "Query",
      description: "Ask questions and get answers from your knowledge base",
      icon: Search,
      href: "/query",
      color: "bg-green-500",
    },
    {
      title: "Conversations",
      description: "Chat with persistent context and memory",
      icon: MessageSquare,
      href: "/conversations",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="text-center py-12">
        <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-6">
          <Brain className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Welcome to LightGraph RAG
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          A powerful knowledge graph-powered RAG system. Upload documents,
          extract insights, and chat with your data using local LLMs.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/groups">
            <Button size="lg">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/query">
            <Button variant="outline" size="lg">
              Try Query
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.title} to={feature.href}>
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <div
                    className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="bg-muted rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              1
            </div>
            <h3 className="font-medium mb-2">Create a Group</h3>
            <p className="text-sm text-muted-foreground">
              Organize your documents into isolated collections
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              2
            </div>
            <h3 className="font-medium mb-2">Upload Documents</h3>
            <p className="text-sm text-muted-foreground">
              Add text files, PDFs, or paste content directly
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              3
            </div>
            <h3 className="font-medium mb-2">Build Knowledge Graph</h3>
            <p className="text-sm text-muted-foreground">
              LightRAG extracts entities and relationships automatically
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              4
            </div>
            <h3 className="font-medium mb-2">Query & Chat</h3>
            <p className="text-sm text-muted-foreground">
              Ask questions or have persistent conversations
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
