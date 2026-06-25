import {
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineStar,
  HiOutlineCreditCard,
  HiOutlineSparkles,
} from "react-icons/hi2";

const ACTIVITY_CONFIG = {
  booked: { icon: HiOutlineCalendarDays, color: "text-[#D65A9A]", bg: "bg-[#FFE9F3]" },
  confirmed: { icon: HiOutlineCheckCircle, color: "text-[#22C55E]", bg: "bg-[#22C55E]/10" },
  feedback: { icon: HiOutlineStar, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  completed: { icon: HiOutlineSparkles, color: "text-[#D65A9A]", bg: "bg-[#FFE9F3]" },
  paid: { icon: HiOutlineCreditCard, color: "text-[#1E2A4A]", bg: "bg-gray-100" },
};

/**
 * RecentActivityCard
 * One entry in the "Recent Activity" timeline (newest first). The left
 * rail dot + connecting line is drawn via `isLast` to omit the trailing
 * line segment on the final item.
 *
 * @param {string} type - booked | confirmed | feedback | completed | paid
 * @param {string} description
 * @param {string} timestamp - pre-formatted, human readable
 * @param {boolean} [isLast]
 */
export default function RecentActivityCard({
  type,
  description,
  timestamp,
  isLast = false,
}) {
  const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.booked;
  const Icon = config.icon;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        {!isLast && <span className="mt-1 h-full w-px flex-1 bg-[#F3E8EF]" />}
      </div>
      <div className="pb-6">
        <p className="text-sm font-medium text-[#1E2A4A]">{description}</p>
        <p className="mt-0.5 text-xs text-[#6B7280]">{timestamp}</p>
      </div>
    </div>
  );
}