import Spinner from "./Spinner";

export default function Button({
  children,
  type = "button",
  loading = false,
  fullWidth = false,
  onClick,
  disabled,
  variant = "primary",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[var(--color-action-bg)] text-[var(--color-action-text)] shadow-sm hover:brightness-95 hover:shadow-md active:translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
    secondary: "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
    quiet: "bg-transparent text-[var(--color-brand-strong)] hover:bg-[var(--color-brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
    danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-300",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`${base} ${variants[variant] || variants.primary} ${fullWidth ? "w-full" : ""} ${loading || disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
