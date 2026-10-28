import {
  HiOutlineBellAlert,
  HiOutlineCalendarDays,
  HiOutlineGift,
  HiOutlineCog6Tooth,
  HiOutlineReceiptPercent,
} from "react-icons/hi2";
import { formatTimestamp } from "../../utils/formatTimestamp";

const TYPE_CONFIG = {
  booking: { icon: HiOutlineCalendarDays, color: "text-[#22C55E]", bg: "bg-[#22C55E]/10" },
  reminder: { icon: HiOutlineBellAlert, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  promotion: { icon: HiOutlineGift, color: "text-[#D65A9A]", bg: "bg-[#FFE9F3]" },
  system: { icon: HiOutlineCog6Tooth, color: "text-[#6B7280]", bg: "bg-gray-100" },
  receipt: { icon: HiOutlineReceiptPercent, color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
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
  isMarking = false,
  onMarkAsRead,
  onClick,
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.system;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-3 transition-colors duration-200 hover:bg-[#FFF7FB] ${
        !isRead ? "bg-[#FFF7FB]/60" : ""
      }`}
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}><Icon className="h-4.5 w-4.5" /></span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onClick} disabled={!onClick} className={`w-full text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}>
          <p className={`text-sm ${isRead ? "text-[#6B7280]" : "font-medium text-[#1E2A4A]"}`}>{message}</p>
          <span className="mt-0.5 block text-xs text-[#6B7280]">{formatTimestamp(timestamp)}</span>
        </button>
        {!isRead && onMarkAsRead && <button type="button" disabled={isMarking} onClick={onMarkAsRead} className="mt-2 min-h-8 rounded-lg border border-[#E8B7D0] bg-white px-2.5 text-xs font-bold text-[#A83F78] transition hover:bg-[#FFF0F7] disabled:cursor-wait disabled:opacity-60">{isMarking ? "Saving…" : "Mark as read"}</button>}
      </div>
      {!isRead && <span aria-label="Unread" className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#D65A9A]" />}
    </div>
  );
}
