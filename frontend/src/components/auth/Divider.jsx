export default function Divider({ label = "or continue with" }) {
  return (
    <div className="flex items-center gap-3 my-4 sm:my-6" role="separator">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 to-pink-200" />
      <span
        className="text-xs tracking-wide uppercase"
        style={{ color: "#C2185B", fontFamily: "'Poppins', sans-serif", opacity: 0.6 }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-pink-200 to-pink-200" />
    </div>
  );
}