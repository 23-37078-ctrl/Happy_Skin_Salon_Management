import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { useTheme } from "../../hooks/useTheme";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="theme-toggle grid h-11 w-11 place-items-center rounded-xl bg-transparent text-[#B94B86] transition hover:text-[#923364] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/25"
    >
      {isDark ? <HiOutlineSun className="h-6 w-6" /> : <HiOutlineMoon className="h-6 w-6" />}
    </button>
  );
}
