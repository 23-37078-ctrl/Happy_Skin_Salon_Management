import { motion } from "framer-motion";
import { HiOutlineMapPin, HiOutlineSparkles } from "react-icons/hi2";

export default function RecommendedServiceCard({
  name,
  image,
  reason,
  branchName,
  onBook,
}) {
  return (
    <motion.button
      type="button"
      onClick={onBook}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="group flex h-full w-full overflow-hidden rounded-[1.75rem] border border-[#F3E8EF] bg-white text-left shadow-[0_14px_40px_rgba(31,41,55,0.06)] transition duration-300 hover:border-[#D65A9A]/30 hover:shadow-[0_20px_48px_rgba(214,90,154,0.14)] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15"
    >
      <div className="h-auto w-28 flex-shrink-0 overflow-hidden sm:w-36">
        <img
          src={image || "/images/salon-hero.jpg"}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex min-h-40 flex-1 flex-col p-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#FFF0F7] px-2.5 py-1 text-[11px] font-bold text-[#D65A9A]">
          <HiOutlineSparkles className="h-3.5 w-3.5" />
          Recommended
        </span>
        <h3 className="mt-3 line-clamp-2 text-base font-bold text-[#1F2937]">{name}</h3>
        {branchName && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#C85B95]"><HiOutlineMapPin className="h-3.5 w-3.5" /> {branchName}</p>}
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B7280]">
          {reason || "A customer favorite selected for your next visit."}
        </p>
      </div>
    </motion.button>
  );
}
