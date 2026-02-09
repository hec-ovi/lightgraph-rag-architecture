import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "theme";

const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored || "system";
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;

  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  return resolved;
};

export const useTheme = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  resolvedTheme: "light",

  toggle: () =>
    set((state) => {
      const themes: Theme[] = ["light", "dark", "system"];
      const currentIndex = themes.indexOf(state.theme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      const resolved = applyTheme(nextTheme);
      localStorage.setItem(STORAGE_KEY, nextTheme);
      return { theme: nextTheme, resolvedTheme: resolved };
    }),

  setTheme: (theme) =>
    set(() => {
      const resolved = applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      return { theme, resolvedTheme: resolved };
    }),
}));

// Initialize theme on load
if (typeof window !== "undefined") {
  const theme = getInitialTheme();
  const resolved = applyTheme(theme);
  useTheme.setState({ theme, resolvedTheme: resolved });

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    const currentTheme = useTheme.getState().theme;
    if (currentTheme === "system") {
      const resolved = applyTheme("system");
      useTheme.setState({ resolvedTheme: resolved });
    }
  });
}
