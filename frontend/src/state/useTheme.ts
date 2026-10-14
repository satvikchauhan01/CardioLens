// The light or the dark theme (PRODUCT_SPEC §11). It starts as the visitor's system has it and can
// be switched in the header. The choice is kept for the visit only: the app stores nothing in the
// browser (BR-12).

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";

export function systemTheme(): Theme {
  return window.matchMedia?.(SYSTEM_DARK).matches ? "dark" : "light";
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(systemTheme);

  // index.css reads this attribute; every colour of the page follows from it.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);

  return { theme, toggleTheme };
}
