import { useEffect } from "react";

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.classList.remove("dark");
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("happy-skin-theme:")) localStorage.removeItem(key);
      }
    } catch { /* The app remains light even when browser storage is unavailable. */ }
  }, []);
  return children;
}
