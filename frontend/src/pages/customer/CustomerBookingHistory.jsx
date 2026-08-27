import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowPath,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlineReceiptPercent,
  HiOutlineUserGroup,
  HiOutlineXMark,
} from "react-icons/hi2";
import { Link } from "react-router-dom";
import {
  cancelAppointment,
  getCustomerAppointments,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerShell";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  getAppointmentDateKey,
} from "../../utils/appointmentTime";

const statusStyles = {
  pending: "bg-[#FEF3C7] text-[#92400E]",
  confirmed: "bg-[#DBEAFE] text-[#1D4ED8]",
  completed: "bg-[#DCFCE7] text-[#166534]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B]",
};
const statusDetails = {
  pending: { title: "Awaiting confirmation", description: "The salon is reviewing your appointment request." },
  confirmed: { title: "Appointment confirmed", description: "Your selected date and time are reserved." },
  completed: { title: "Service completed", description: "You can share feedback about your experience." },
  cancelled: { title: "Appointment cancelled", description: "No further action is required for this booking." },
};
const PAGE_SIZE = 15;

export default function CustomerBookingHistory() {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingCancelId, setPendingCancelId] = useState(null);
  const [page, setPage] = useState(1);

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

  const filteredAppointments = useMemo(() => {
    const term = query.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const matchesDate = !dateFilter || getAppointmentDateKey(appointment.appointment_date) === dateFilter;
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
      const searchable = [appointment.service?.name, ...(appointment.service_items || []).map((item) => item.service?.name), appointment.branch?.name, appointment.status, appointment.notes, appointment.preferred_service_provider?.full_name].filter(Boolean).join(" ").toLowerCase();
      return matchesDate && matchesStatus && (!term || searchable.includes(term));
    });
  }, [appointments, query, dateFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE));
  const visibleAppointments = useMemo(() => filteredAppointments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredAppointments, page]);

  const handleCancel = async (appointmentId) => {
    setBusyId(appointmentId);
    setError("");
    setSuccess("");
    try {
      const updated = await cancelAppointment(appointmentId);
      setAppointments((prev) => prev.map((item) => (item.id === appointmentId ? updated : item)));
      setSuccess(`Appointment #${appointmentId} was cancelled.`);
      setPendingCancelId(null);
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't cancel that appointment.");
    } finally {
      setBusyId(null);
    }
  };

  const hasFilters = Boolean(query.trim() || dateFilter || statusFilter !== "all");
  const clearFilters = () => { setQuery(""); setDateFilter(""); setStatusFilter("all"); setPage(1); };

  return (
    <CustomerShell title="History" stats={stats} showHeading={false} backTo="/customer/dashboard" backBesideLogo>
      {error && <Notice>{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="overflow-visible rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_13rem_auto]">
        <label className="relative">
          <span className="sr-only">Search booking history</span>
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input maxLength={80} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search service, branch, or staff" className="min-h-12 w-full rounded-xl border border-[#E8DCE3] bg-[#FFF8FB] py-3 pl-11 pr-4 text-sm text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-4 focus:ring-[#D65A9A]/10" />
        </label>
        <ModernDatePicker value={dateFilter} onChange={(value) => { setDateFilter(value); setPage(1); }} placeholder="Filter by date" ariaLabel="Filter by appointment date" />
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#E8DCE3] bg-[#FFF8FB] px-4 text-sm font-bold text-[#1F2937] transition focus-within:border-[#D65A9A] focus-within:ring-4 focus-within:ring-[#D65A9A]/10 sm:min-w-48">
          <HiOutlineFunnel className="h-5 w-5 shrink-0 text-[#D65A9A]" />
          <span className="sr-only">Filter by booking status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="w-full bg-transparent capitalize outline-none">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E8DCE3] px-4 text-sm font-bold text-[#6B7280] transition hover:border-[#D65A9A]/40 hover:bg-[#FFF0F7] hover:text-[#C9558F] disabled:cursor-not-allowed disabled:opacity-40"><HiOutlineArrowPath className="h-5 w-5" /> Reset</button>
        </div>
        <p className="mt-3 text-right text-xs font-semibold text-[#6B7280]">Showing <span className="font-extrabold text-[#1F2937]">{filteredAppointments.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredAppointments.length)}</span> of <span className="font-extrabold text-[#1F2937]">{filteredAppointments.length}</span></p>
      </section>

      <section className="mt-5">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-[1.25rem] border border-[#F3E8EF] bg-white" />)}
          </div>
        ) : filteredAppointments.length ? (
          <div className="grid gap-3">
            {visibleAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                busy={busyId === appointment.id}
                onCancel={setPendingCancelId}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[24rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#E8B7D0] bg-white/70 p-8 text-center">
            <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#FFF0F7]"><HiOutlineCalendarDays className="h-8 w-8 text-[#D65A9A]" /></span>
            <h2 className="mt-3 text-lg font-bold text-[#1F2937]">{appointments.length ? "No matching appointments" : "No appointments yet"}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{appointments.length ? "Try a different search, date, or status filter." : "Your online appointments will appear here after you submit a request."}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-[#C9558F] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>}</div>
          </div>
        )}
      </section>
      {!isLoading && totalPages > 1 && <nav aria-label="Booking history pages" className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#F3E8EF] bg-white p-3 shadow-sm"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#E8DCE3] px-3 text-sm font-bold text-[#374151] hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-40"><HiChevronLeft className="h-5 w-5" /> Previous</button><span className="px-3 text-sm font-semibold text-[#6B7280]">Page <strong className="text-[#1F2937]">{page}</strong> of {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#C9558F] px-3 text-sm font-bold text-white hover:bg-[#B94780] disabled:cursor-not-allowed disabled:opacity-40">Next <HiChevronRight className="h-5 w-5" /></button></nav>}
      {pendingCancelId && <CancelDialog busy={busyId === pendingCancelId} onClose={() => !busyId && setPendingCancelId(null)} onConfirm={() => handleCancel(pendingCancelId)} />}
    </CustomerShell>
  );
}

function AppointmentCard({ appointment, busy, onCancel }) {
  const canCancel = ["pending", "confirmed"].includes(appointment.status);
  const canReview = appointment.status === "completed";
  const statusDetail = statusDetails[appointment.status] || statusDetails.pending;
  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-[#EEDFE7] bg-white shadow-[0_8px_24px_rgba(31,41,55,0.045)] transition duration-200 hover:border-[#E3BDD1] hover:shadow-[0_14px_32px_rgba(31,41,55,0.08)]">
      <div className="grid lg:grid-cols-[minmax(13rem,0.8fr)_minmax(24rem,1.45fr)_minmax(18rem,0.9fr)]">
        <header className="border-b border-[#F3E8EF] p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-snug text-[#1F2937]">{appointment.service_items?.length ? appointment.service_items.map((item) => item.service?.name).filter(Boolean).join(", ") : appointment.service?.name || "Service"}</h2>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold capitalize lg:mt-3 lg:inline-flex ${statusStyles[appointment.status] || statusStyles.pending}`}>{appointment.status}</span>
          </div>
          {appointment.notes && <div className="mt-4 border-t border-[#F3E8EF] pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Customer note</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">{appointment.notes}</p></div>}
        </header>

        <section aria-label="Appointment schedule" className="border-b border-[#F3E8EF] p-5 lg:border-b-0 lg:border-r">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">Schedule and location</p>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2.5 text-sm font-bold text-[#374151]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF0F7]"><HiOutlineCalendarDays className="h-5 w-5 text-[#D65A9A]" /></span>{formatAppointmentDate(appointment.appointment_date)}</span>
            <span className="inline-flex items-center gap-2.5 text-sm font-bold text-[#374151]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF0F7]"><HiOutlineClock className="h-5 w-5 text-[#D65A9A]" /></span>{formatAppointmentTime(appointment.appointment_date)}</span>
            <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#4B5563]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF0F7]"><HiOutlineMapPin className="h-5 w-5 text-[#D65A9A]" /></span>{appointment.branch?.name || "Branch"}</span>
            {appointment.preferred_service_provider && <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#4B5563]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF0F7]"><HiOutlineUserGroup className="h-5 w-5 text-[#D65A9A]" /></span>{appointment.preferred_service_provider.full_name}</span>}
          </div>
        </section>

        <aside className="flex flex-col justify-between gap-4 bg-[#FFFCFD] p-5">
          {appointment.receipt ? (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-sm text-[#166534]">
              <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 font-extrabold"><HiOutlineReceiptPercent className="h-5 w-5" /> Receipt</span><span className="text-base font-black">{Number(appointment.receipt.amount || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#39734E]"><span>{appointment.receipt.service_provider || "Salon staff"}</span><span className="capitalize">{appointment.receipt.payment_method?.replace("_", " ")}</span>{appointment.receipt.additional_charges && <span className="w-full">Add-ons: {appointment.receipt.additional_charges}</span>}{Number(appointment.receipt.commission_amount || 0) > 0 && <span className="w-full">Staff commission / tip: {Number(appointment.receipt.commission_amount).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#F3E8EF] bg-white p-3.5"><p className="text-sm font-extrabold text-[#374151]">{statusDetail.title}</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">{statusDetail.description}</p></div>
          )}
          {(canReview || canCancel) && <div className="flex flex-wrap justify-end gap-2">
            {canReview && <Link to={`/customer/feedback?booking=${encodeURIComponent(String(appointment.id))}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C9558F] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B94780] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/20"><HiOutlineChatBubbleLeftRight className="h-5 w-5" /> Review service</Link>}
            {canCancel && <button type="button" disabled={busy} onClick={() => onCancel(appointment.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#F1C7D5] bg-white px-4 py-2 text-sm font-bold text-[#B42318] transition hover:border-[#FDA29B] hover:bg-[#FFF5F5] focus:outline-none focus:ring-4 focus:ring-[#EF4444]/10 disabled:opacity-60"><HiOutlineXMark className="h-5 w-5" /> Cancel booking</button>}
          </div>}
        </aside>
      </div>
    </article>
  );
}

function CancelDialog({ busy, onClose, onConfirm }) {
  return <div className="fixed inset-0 z-[240] grid place-items-center bg-[#172033]/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md rounded-[1.75rem] border border-[#F3E8EF] bg-white p-6 text-center shadow-[0_24px_80px_rgba(31,41,55,0.22)]"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF1F2] text-[#DC2626]"><HiOutlineXMark className="h-7 w-7" /></span><h2 id="cancel-title" className="mt-4 text-xl font-extrabold text-[#1F2937]">Cancel this appointment?</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">This will release your reserved schedule. This action is recorded and cannot be undone from this page.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-[#E8DCE3] px-4 text-sm font-bold text-[#374151]">Keep appointment</button><button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-xl bg-[#DC2626] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "Cancelling…" : "Yes, cancel"}</button></div></section></div>;
}
