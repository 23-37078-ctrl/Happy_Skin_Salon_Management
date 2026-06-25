import { motion } from "framer-motion";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center px-6 py-12 text-center"
    >
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#FFF0F7] to-white text-[#D65A9A] shadow-[0_14px_35px_rgba(214,90,154,0.12)]">
        <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-[#D65A9A]/15" />
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[#1F2937]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#6B7280]">
        {description}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-6 min-h-11 rounded-full bg-gradient-to-r from-[#D65A9A] to-[#C85B95] px-6 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(214,90,154,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(214,90,154,0.3)] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/35"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
