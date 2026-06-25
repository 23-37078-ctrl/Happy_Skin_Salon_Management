import {
  HiOutlineBellAlert,
  HiOutlineCalendarDays,
  HiOutlineGift,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";

const TYPE_CONFIG = {
  booking: { icon: HiOutlineCalendarDays, color: "text-[#22C55E]", bg: "bg-[#22C55E]/10" },
  reminder: { icon: HiOutlineBellAlert, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  promotion: { icon: HiOutlineGift, color: "text-[#D65A9A]", bg: "bg-[#FFE9F3]" },
  system: { icon: HiOutlineCog6Tooth, color: "text-[#6B7280]", bg: "bg-gray-100" },
};

/**
 * NotificationCard
 * A single row in the notifications panel. Icon and accent color are
 * derived from `type` (booking | reminder | promotion | system) so new
 * notification types degrade gracefully to a neutral style.
 *
 * @param {string} type
 * @param {string} message
 * @param {string} timestamp - pre-formatted, human readable
 * @param {boolean} isRead
 * @param {() => void} [onClick]
 */
export default function NotificationCard({
  type,
  message,
  timestamp,
  isRead,
  onClick,
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.system;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors duration-200 hover:bg-[#FFF7FB] ${
        !isRead ? "bg-[#FFF7FB]/60" : ""
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="flex-1">
        <p
          className={`text-sm ${
            isRead ? "text-[#6B7280]" : "font-medium text-[#1E2A4A]"
          }`}
        >
          {message}
        </p>
        <span className="mt-0.5 block text-xs text-[#6B7280]">
          {timestamp}
        </span>
      </span>
      {!isRead && (
        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#D65A9A]" />
      )}
    </button>
  );
}