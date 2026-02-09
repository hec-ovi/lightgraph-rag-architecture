import { Brain, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./ui";
import { useTheme } from "../stores/theme.store";

function Header() {
  const { theme, toggle } = useTheme();

  const ThemeIcon = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }[theme];

  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">LightGraph RAG</h1>
            <p className="text-xs text-muted-foreground">
              Knowledge Graph Powered RAG
            </p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={toggle} title={`Theme: ${theme}`}>
          <ThemeIcon className="h-5 w-5" />
          <span className="sr-only">Toggle theme (current: {theme})</span>
        </Button>
      </div>
    </header>
  );
}

export { Header };
