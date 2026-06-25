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
    primary:
      "text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:ring-pink-300",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""}`}
      style={{
        background: loading || disabled
          ? "#E89BC0"
          : "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
