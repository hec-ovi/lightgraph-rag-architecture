import { Link, useLocation } from "@tanstack/react-router";
import { FolderOpen, MessageSquare, Search, Home } from "lucide-react";

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/groups", label: "Groups", icon: FolderOpen },
    { path: "/query", label: "Query", icon: Search },
    { path: "/conversations", label: "Conversations", icon: MessageSquare },
  ];

  return (
    <aside className="w-64 border-r bg-card hidden md:block">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export { Sidebar };
