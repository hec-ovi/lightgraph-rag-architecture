import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";

function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8 lg:py-10 max-w-7xl">
          <Outlet />
        </div>
      </main>
      <footer className="border-t bg-muted/30 py-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>LightGraph RAG — Knowledge Graph Powered RAG System</p>
            <div className="flex items-center gap-6">
              <a 
                href="http://localhost:8000/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                API Docs
              </a>
              <span>v0.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { Layout };
