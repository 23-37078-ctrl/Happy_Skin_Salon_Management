import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme-context";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "react-router-dom";

function getUserKey(currentUser) {
  if (!currentUser) return "guest";
  return String(currentUser.id || currentUser.user_id || currentUser.email || "guest").toLowerCase();
}

function getInitialTheme(userKey) {
  const savedTheme = localStorage.getItem(`happy-skin-theme:${userKey}`);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const userKey = getUserKey(currentUser);
  const [theme, setTheme] = useState(() => getInitialTheme(userKey));
  const forceLight = pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/verify-email";
  const appliedTheme = forceLight ? "light" : theme;

  useEffect(() => {
    setTheme(getInitialTheme(userKey));
  }, [userKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme;
    document.documentElement.classList.toggle("dark", appliedTheme === "dark");
    localStorage.setItem(`happy-skin-theme:${userKey}`, theme);
  }, [appliedTheme, theme, userKey]);

  const value = useMemo(() => ({
    theme,
    isDark: appliedTheme === "dark",
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
  }), [appliedTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
