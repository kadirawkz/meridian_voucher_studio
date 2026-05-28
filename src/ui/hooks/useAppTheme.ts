import { useState, useEffect } from "react";

export function useAppTheme() {
  const [activeTheme, setActiveTheme] = useState<"light" | "dark" | "system">(
    () => (localStorage.getItem("meridian-theme") as "light" | "dark" | "system") || "system"
  );
  const [systemIsDark, setSystemIsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Load theme on startup
  useEffect(() => {
    if (window.meridian?.getSettings) {
      void window.meridian.getSettings().then((settings) => {
        if (settings?.theme) {
          setActiveTheme(settings.theme as "light" | "dark" | "system");
        }
      });
    }
  }, []);

  // Listen to system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const isDark = activeTheme === "dark" || (activeTheme === "system" && systemIsDark);
  const themeClass = isDark ? "dark" : "light";

  // Sync theme changes to localStorage and DOM
  useEffect(() => {
    localStorage.setItem("meridian-theme", activeTheme);
    document.documentElement.style.backgroundColor = isDark ? "#090d16" : "#f6f8fb";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [activeTheme, isDark]);

  return {
    activeTheme,
    setActiveTheme,
    themeClass
  };
}
