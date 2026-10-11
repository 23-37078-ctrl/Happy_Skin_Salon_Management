import { useEffect } from "react";
import { ThemeContext } from "./theme-context";
import { useAuth } from "../hooks/useAuth";

function getUserKey(currentUser) {
  if (!currentUser) return "guest";
  return String(currentUser.id || currentUser.user_id || currentUser.email || "guest").toLowerCase();
}

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const userKey = getUserKey(currentUser);
  const theme = "light";

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.classList.remove("dark");
    localStorage.setItem(`happy-skin-theme:${userKey}`, "light");
  }, [userKey]);

  const value = {
    theme,
    isDark: false,
    toggleTheme: () => {},
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
