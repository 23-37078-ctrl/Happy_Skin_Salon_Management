import { useEffect, useState } from "react";
import { ThemeContext } from "./theme-context";
import { useAuth } from "../hooks/useAuth";

function getUserKey(currentUser) {
  if (!currentUser) return "guest";
  return String(currentUser.id || currentUser.user_id || currentUser.email || "guest").toLowerCase();
}

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const userKey = getUserKey(currentUser);
  const [themeState, setThemeState] = useState(() => ({
    userKey,
    value: localStorage.getItem(`happy-skin-theme:${userKey}`) === "dark" ? "dark" : "light",
  }));
  const theme = themeState.userKey === userKey
    ? themeState.value
    : localStorage.getItem(`happy-skin-theme:${userKey}`) === "dark" ? "dark" : "light";
  const setTheme = (update) => setThemeState((previous) => ({
    userKey,
    value: typeof update === "function" ? update(previous.userKey === userKey ? previous.value : theme) : update,
  }));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(`happy-skin-theme:${userKey}`, theme);
  }, [theme, userKey]);

  const value = {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
