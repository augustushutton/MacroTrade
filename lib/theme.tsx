"use client";

import React from "react";

// Dark mode is the default for every visitor again — there's still no UI
// toggle control, this isn't a feature for end users. Light is the opt-in:
// set `localStorage.setItem("msp-theme", "light")` in devtools and reload to
// preview it. layout.tsx's inline pre-hydration script (see THEME_INIT
// there) mirrors this exact resolution so there's no flash of the wrong
// theme before this effect runs.

const STORAGE_KEY = "msp-theme";

export type Theme = "light" | "dark";

const ThemeContext = React.createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("dark");

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const resolved: Theme = stored === "light" ? "light" : "dark";
    setTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, []);

  const toggle = React.useCallback(() => {
    // No-op; still no UI control for this. Flip it via localStorage (see
    // the comment above) and reload.
  }, []);

  const value = React.useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
