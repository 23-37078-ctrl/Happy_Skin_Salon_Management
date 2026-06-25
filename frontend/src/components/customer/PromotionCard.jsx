import { motion } from "framer-motion";

export default function PromotionCard({ title, subtitle, image, onBook }) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="relative flex h-48 w-full flex-shrink-0 items-end overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#D65A9A] to-[#C85B95] p-5 shadow-[0_16px_45px_rgba(214,90,154,0.18)] sm:h-56 sm:p-7"
      style={
        image
          ? {
              backgroundImage: `linear-gradient(135deg, rgba(31,41,55,0.14), rgba(214,90,154,0.84)), url(${image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="relative z-10 max-w-sm text-white">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
          {subtitle}
        </span>
        <h3 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          {title}
        </h3>
        <button
          onClick={onBook}
          className="mt-5 min-h-10 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#D65A9A] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#D65A9A]"
        >
          Book Now
        </button>
      </div>
    </motion.article>
  );
}
