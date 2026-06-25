import { motion } from "framer-motion";

export default function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      aria-label={title}
      className="group flex min-h-28 items-center gap-4 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 text-left shadow-[0_10px_30px_rgba(31,41,55,0.05)] transition-all duration-300 hover:border-[#D65A9A]/30 hover:shadow-[0_18px_42px_rgba(214,90,154,0.14)] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/35"
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF0F7] text-[#D65A9A] transition-colors duration-300 group-hover:bg-gradient-to-br group-hover:from-[#D65A9A] group-hover:to-[#C85B95] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-bold text-[#1F2937]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[#6B7280]">
          {description}
        </span>
      </span>
    </motion.button>
  );
}
