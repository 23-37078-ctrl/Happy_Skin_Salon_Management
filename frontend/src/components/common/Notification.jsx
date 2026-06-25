import { useEffect } from "react";

export default function Notification({ type = "info", message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: { bg: "#F0FDF4", border: "#86EFAC", text: "#166534", icon: "✓" },
    error:   { bg: "#FFF1F2", border: "#FECDD3", text: "#9F1239", icon: "✕" },
    info:    { bg: "#F8E5EE", border: "#E89BC0", text: "#6B3F5D", icon: "ℹ" },
  };

  const s = styles[type] || styles.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 p-4 rounded-xl mb-5 border text-sm animate-fadeIn"
      style={{
        background: s.bg,
        borderColor: s.border,
        color: s.text,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <span className="font-bold mt-0.5">{s.icon}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-current opacity-50 hover:opacity-100 transition-opacity font-bold"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
