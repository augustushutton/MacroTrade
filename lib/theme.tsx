"use client";

import React from "react";

// Dark mode only, locked on. layout.tsx runs an inline script before
// hydration that sets the "dark" class on <html> so there's no light-mode
// flash on load.

const STORAGE_KEY = "msp-theme";

export type Theme = "light" | "dark";

const ThemeContext = React.createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("dark");

  React.useEffect(() => {
    setTheme("dark");
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const toggle = React.useCallback(() => {
    // No-op; dark mode is locked.
  }, []);

  const value = React.useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
