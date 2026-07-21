import { useEffect, useMemo, useRef, useState } from "react";
import { HiChevronLeft, HiChevronRight, HiOutlineCalendarDays, HiOutlineXMark } from "react-icons/hi2";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(value) {
  if (!DATE_PATTERN.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function toValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(left, right) {
  return left && right && toValue(left) === toValue(right);
}

export default function ModernDatePicker({ value = "", onChange, min, max, placeholder = "Select date", ariaLabel = "Select date", className = "" }) {
  const selectedDate = parseDate(value);
  const minDate = parseDate(min);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState("bottom");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedDate || minDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => !rootRef.current?.contains(event.target) && setOpen(false);
    const closeWithKeyboard = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const start = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [visibleMonth]);

  const choose = (date) => {
    const nextValue = toValue(date);
    if ((min && nextValue < min) || (max && nextValue > max)) return;
    onChange?.(nextValue);
    setOpen(false);
  };

  const togglePicker = () => {
    if (!open) {
      if (selectedDate) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      const bounds = rootRef.current?.getBoundingClientRect();
      if (bounds) {
        const spaceBelow = window.innerHeight - bounds.bottom;
        setPlacement(spaceBelow < 390 && bounds.top > spaceBelow ? "top" : "bottom");
      }
    }
    setOpen((current) => !current);
  };

  const formattedValue = selectedDate?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const today = new Date();

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button type="button" onClick={togglePicker} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#E8DCE3] bg-[#FFF8FB] px-3.5 text-left text-sm font-semibold text-[#1F2937] outline-none transition hover:border-[#D65A9A]/60 focus:border-[#D65A9A] focus:ring-4 focus:ring-[#D65A9A]/10">
        <HiOutlineCalendarDays className="h-5 w-5 shrink-0 text-[#D65A9A]" />
        <span className={`flex-1 ${formattedValue ? "" : "text-[#98A2B3]"}`}>{formattedValue || placeholder}</span>
        {value && <span role="button" tabIndex={-1} onClick={(event) => { event.stopPropagation(); onChange?.(""); }} aria-label="Clear date" className="grid h-7 w-7 place-items-center rounded-full text-[#6B7280] hover:bg-white hover:text-[#D65A9A]"><HiOutlineXMark className="h-4 w-4" /></span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Calendar" className={`fixed inset-x-4 bottom-4 z-[120] rounded-2xl border border-[#F0DCE7] bg-white p-4 shadow-[0_22px_60px_rgba(31,41,55,0.18)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:w-[min(21rem,calc(100vw-2rem))] ${placement === "top" ? "sm:bottom-[calc(100%+0.6rem)] sm:top-auto" : "sm:top-[calc(100%+0.6rem)]"}`}>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-xl text-[#6B7280] hover:bg-[#FFF0F7] hover:text-[#D65A9A]"><HiChevronLeft className="h-5 w-5" /></button>
            <p className="font-extrabold text-[#1F2937]">{visibleMonth.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p>
            <button type="button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-xl text-[#6B7280] hover:bg-[#FFF0F7] hover:text-[#D65A9A]"><HiChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {weekdays.map((day) => <span key={day} className="py-1 text-[10px] font-bold uppercase text-[#98A2B3]">{day.slice(0, 2)}</span>)}
            {days.map((date) => {
              const dayValue = toValue(date);
              const disabled = (min && dayValue < min) || (max && dayValue > max);
              const outside = date.getMonth() !== visibleMonth.getMonth();
              const selected = sameDay(date, selectedDate);
              return <button key={dayValue} type="button" disabled={disabled} onClick={() => choose(date)} aria-label={date.toLocaleDateString("en-PH", { dateStyle: "full" })} aria-pressed={selected} className={`aspect-square rounded-xl text-xs font-bold transition ${selected ? "bg-[#C9558F] text-white shadow-md" : sameDay(date, today) ? "bg-[#FFF0F7] text-[#C9558F] ring-1 ring-[#E8B7D0]" : outside ? "text-[#C7CDD6] hover:bg-[#FFF8FB]" : "text-[#374151] hover:bg-[#FFF0F7] hover:text-[#C9558F]"} disabled:cursor-not-allowed disabled:opacity-25`}>{date.getDate()}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#F3E8EF] pt-3">
            <button type="button" onClick={() => { onChange?.(""); setOpen(false); }} className="rounded-lg px-3 py-2 text-xs font-bold text-[#6B7280] hover:bg-[#FFF8FB]">Clear</button>
            <button type="button" onClick={() => choose(today)} disabled={(min && toValue(today) < min) || (max && toValue(today) > max)} className="rounded-lg bg-[#FFF0F7] px-3 py-2 text-xs font-bold text-[#C9558F] disabled:opacity-40">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
