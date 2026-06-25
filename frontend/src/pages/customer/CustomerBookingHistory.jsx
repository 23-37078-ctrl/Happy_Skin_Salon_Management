import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  cancelAppointment,
  getCustomerAppointments,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerBookAppointment";

const statusStyles = {
  pending: "bg-[#FEF3C7] text-[#92400E]",
  confirmed: "bg-[#DBEAFE] text-[#1D4ED8]",
  completed: "bg-[#DCFCE7] text-[#166534]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B]",
};

export default function CustomerBookingHistory() {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAppointments = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await getCustomerAppointments(signal);
      setAppointments(payload || []);
    } catch (err) {
      if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
        setError("We couldn't load your appointments.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => loadAppointments(controller.signal));
    return () => controller.abort();
  }, [loadAppointments]);

  const stats = useMemo(() => {
    const active = appointments.filter((item) => ["pending", "confirmed"].includes(item.status)).length;
    const completed = appointments.filter((item) => item.status === "completed").length;
    return [
      { label: "Active", value: active },
      { label: "Completed", value: completed },
      { label: "Total", value: appointments.length },
    ];
  }, [appointments]);

  const handleCancel = async (appointmentId) => {
    setBusyId(appointmentId);
    setError("");
    setSuccess("");
    try {
      const updated = await cancelAppointment(appointmentId);
      setAppointments((prev) => prev.map((item) => (item.id === appointmentId ? updated : item)));
      setSuccess(`Appointment #${appointmentId} was cancelled.`);
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't cancel that appointment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CustomerShell title="Booking History" subtitle="Track appointment status and completed visits.">
      {error && <Notice>{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <p className="text-2xl font-bold text-[#1F2937]">{stat.value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#6B7280]">{stat.label}</p>
          </article>
        ))}
      </section>

      <section className="mt-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[1.25rem] bg-white" />)}
          </div>
        ) : appointments.length ? (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                busy={busyId === appointment.id}
                onCancel={handleCancel}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-8 text-center shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <HiOutlineCalendarDays className="mx-auto h-10 w-10 text-[#D65A9A]" />
            <h2 className="mt-3 text-lg font-bold text-[#1F2937]">No appointments yet</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Your online bookings will appear here after you submit a request.</p>
          </div>
        )}
      </section>
    </CustomerShell>
  );
}

function AppointmentCard({ appointment, busy, onCancel }) {
  const canCancel = ["pending", "confirmed"].includes(appointment.status);
  const canReview = appointment.status === "completed";

  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Booking #{appointment.id}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusStyles[appointment.status] || statusStyles.pending}`}>{appointment.status}</span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#1F2937]">{appointment.service?.name || "Service"}</h2>
          <p className="mt-1 text-sm text-[#6B7280]">{appointment.branch?.name || "Branch"}</p>
          {appointment.notes && <p className="mt-3 rounded-xl bg-[#FFF8FB] px-3 py-2 text-sm text-[#6B7280]">{appointment.notes}</p>}
        </div>

        <div className="grid gap-2 text-sm text-[#6B7280]">
          <span className="inline-flex items-center gap-2"><HiOutlineCalendarDays className="h-5 w-5 text-[#D65A9A]" /> {new Date(appointment.appointment_date).toLocaleDateString()}</span>
          <span className="inline-flex items-center gap-2"><HiOutlineClock className="h-5 w-5 text-[#D65A9A]" /> {new Date(appointment.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReview && (
            <a href={`/customer/feedback?booking=${appointment.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-3 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7]">
              <HiOutlineChatBubbleLeftRight className="h-5 w-5 text-[#D65A9A]" />
              Review
            </a>
          )}
          {canCancel && (
            <button type="button" disabled={busy} onClick={() => onCancel(appointment.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#EF4444]/20 bg-white px-3 py-2 text-sm font-bold text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:opacity-60">
              <HiOutlineXMark className="h-5 w-5" />
              Cancel
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
