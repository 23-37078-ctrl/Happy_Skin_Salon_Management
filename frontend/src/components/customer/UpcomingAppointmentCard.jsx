import { motion } from "framer-motion";
import {
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineUser,
} from "react-icons/hi2";
import EmptyState from "../../components/customer/EmptyState";

const STATUS_STYLES = {
  Confirmed: "bg-[#DCFCE7] text-[#15803D]",
  Pending: "bg-[#FEF3C7] text-[#B45309]",
  Cancelled: "bg-[#FEE2E2] text-[#B91C1C]",
};

export default function UpcomingAppointmentCard({
  appointment,
  onBook,
  onViewDetails,
  onReschedule,
  onCancel,
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#F3E8EF] bg-white shadow-[0_18px_55px_rgba(31,41,55,0.07)]">
      <div className="border-b border-[#F3E8EF] bg-gradient-to-r from-[#FFF8FB] to-white px-5 py-5 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">
              Next Visit
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#1F2937]">
              Upcoming Appointment
            </h2>
          </div>
          {appointment?.status && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                STATUS_STYLES[appointment.status] ||
                "bg-[#FFE9F3] text-[#D65A9A]"
              }`}
            >
              {appointment.status}
            </span>
          )}
        </div>
      </div>

      {!appointment ? (
        <EmptyState
          title="No upcoming appointments"
          description="Find a time that fits your day and reserve your next salon visit."
          actionLabel="Book Appointment"
          onAction={onBook}
          icon={<HiOutlineCalendarDays className="h-9 w-9" />}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-5 sm:p-7"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-[#1F2937]">
                {appointment.service_name}
              </h3>
              <p className="mt-2 text-sm text-[#6B7280]">
                with {appointment.therapist_name || "any available specialist"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[58%]">
              <DetailItem
                icon={HiOutlineCalendarDays}
                label="Date"
                value={appointment.date}
              />
              <DetailItem
                icon={HiOutlineClock}
                label="Time"
                value={appointment.time}
              />
              <DetailItem
                icon={HiOutlineMapPin}
                label="Branch"
                value={appointment.branch_name}
              />
              <DetailItem
                icon={HiOutlineUser}
                label="Staff"
                value={appointment.therapist_name || "Any available"}
              />
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onViewDetails}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#D65A9A] to-[#C85B95] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(214,90,154,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(214,90,154,0.3)] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/35"
            >
              View Details
            </button>
            <button
              onClick={onReschedule}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D65A9A]/25 bg-white px-5 py-2.5 text-sm font-bold text-[#1F2937] transition-all duration-300 hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
            >
              Reschedule
            </button>
            <button
              onClick={onCancel}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold text-[#B91C1C] transition-all duration-300 hover:bg-[#FEE2E2]/70 focus:outline-none focus:ring-2 focus:ring-[#EF4444]/25"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </article>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="min-h-24 rounded-[1.25rem] border border-[#F3E8EF] bg-[#FFF8FB] p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#D65A9A] shadow-sm">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-bold text-[#1F2937]">
        {value || "TBA"}
      </p>
    </div>
  );
}
