import { motion } from "framer-motion";
import {
  HiCheckCircle,
  HiOutlineCalendar,
  HiOutlineSparkles,
} from "react-icons/hi2";

export default function HeroBanner({
  firstName,
  upcoming,
  onBook,
  onBrowseServices,
}) {
  const appointmentSummary = upcoming
    ? `Your next appointment is ${upcoming.date} at ${upcoming.time}`
    : "Book your next glow-up in just a few taps.";

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#D65A9A] via-[#E879B0] to-[#FFF8FB] px-5 py-7 shadow-[0_24px_70px_rgba(214,90,154,0.24)] sm:px-8 sm:py-9 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.62),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent_42%)]" />

      <div className="relative grid grid-cols-1 items-end gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <span className="inline-flex rounded-full border border-white/45 bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
            Happy Skin Salon
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-5xl">
            Welcome back, {firstName || "there"}{" "}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/88 sm:text-base">
            {appointmentSummary}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onBook}
              aria-label="Book a new appointment"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#D65A9A] shadow-[0_14px_35px_rgba(31,41,55,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,41,55,0.22)] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#D65A9A]"
            >
              <HiOutlineCalendar className="h-5 w-5" />
              Book Appointment
            </button>
            <button
              onClick={onBrowseServices}
              aria-label="Browse available salon services"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/45 bg-white/15 px-6 py-3 text-sm font-bold text-white shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/24 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#D65A9A]"
            >
              <HiOutlineSparkles className="h-5 w-5" />
              Browse Services
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
          className="rounded-[1.75rem] border border-white/45 bg-white/18 p-4 text-white shadow-[0_18px_60px_rgba(31,41,55,0.16)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Upcoming Appointment
              </p>
              <p className="mt-2 text-lg font-bold">
                {upcoming?.service_name || "No appointment booked"}
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#D65A9A] shadow-sm">
              <HiCheckCircle className="h-6 w-6" />
            </span>
          </div>

          <div className="mt-5 rounded-[1.35rem] bg-white/88 p-4 text-[#1F2937] shadow-sm">
            <p className="text-sm font-semibold">
              {upcoming
                ? `${upcoming.date} at ${upcoming.time}`
                : "Choose your preferred branch and service"}
            </p>
            <p className="mt-1 text-sm text-[#6B7280]">
              {upcoming?.branch_name || "Fresh availability is ready for you."}
            </p>
            {upcoming?.status && (
              <span className="mt-4 inline-flex rounded-full bg-[#22C55E]/10 px-3 py-1 text-xs font-bold text-[#15803D]">
                {upcoming.status}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
