import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare,
  HiOutlineXMark,
} from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, formatDateTime, getApiError, getAppointmentDateKey } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatusBadge } from "./ManagerWorkspace";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination, { PAGE_SIZE } from "../../components/common/ListPagination";

const statuses = ["all", "pending", "confirmed", "completed", "cancelled"];
const rescheduleTimes = Array.from({ length: 21 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { value, label: new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) };
});

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function BranchBookings() {
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [editing, setEditing] = useState({ id: null, appointment_date: "" });
  const [busyId, setBusyId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [payload, providerRows] = await Promise.all([managerService.bookings({
        status_filter: statusFilter === "all" ? null : statusFilter,
      }), managerService.bookingProviders()]);
      setBookings(payload.bookings || []);
      setProviders(providerRows || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load branch bookings."));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    Promise.resolve().then(() => loadBookings());
  }, [loadBookings]);

  const visibleBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const appointmentDate = getAppointmentDateKey(booking.appointment_date);
      const matchesDate = !dateFilter || appointmentDate === dateFilter;
      const matchesSearch = !term || [booking.id, booking.group_reference, ...(booking.group_members || []).map((member) => member.member_name), booking.customer?.full_name, booking.customer?.email, booking.guest_name, booking.guest_email, booking.guest_phone, booking.service?.name, booking.status, booking.preferred_service_provider?.full_name].filter(Boolean).join(" ").toLowerCase().includes(term);
      return matchesDate && matchesSearch;
    });
  }, [bookings, search, dateFilter]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(visibleBookings.length / PAGE_SIZE)));
  const pagedBookings = useMemo(() => visibleBookings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [visibleBookings, safePage]);

  const updateStatus = async (bookingId, status) => {
    setBusyId(bookingId);
    setError("");
    setSuccess("");
    try {
      const updated = await managerService.updateBookingStatus(bookingId, status);
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? updated : booking)));
      setSuccess(`Booking #${bookingId} updated to ${status}.`);
    } catch (err) {
      setError(getApiError(err, "Couldn't update that booking."));
    } finally {
      setBusyId(null);
    }
  };

  const updateServiceStatus = async (bookingId, itemId, status) => {
    setBusyId(bookingId);
    setError("");
    setSuccess("");
    try {
      const result = await managerService.updateGroupServiceStatus(bookingId, itemId, status);
      setBookings((items) => items.map((booking) => booking.id !== bookingId ? booking : {
        ...booking,
        status: result.booking_status,
        service_items: booking.service_items.map((item) => item.id === itemId ? { ...item, status: result.service_status } : item),
      }));
      setSuccess(`Group service assignment updated to ${status}.`);
    } catch (err) {
      setError(getApiError(err, "Couldn't update that group service."));
    } finally {
      setBusyId(null);
    }
  };

  const updateServiceProvider = async (bookingId, itemId, providerId) => {
    setBusyId(bookingId);
    setError("");
    setSuccess("");
    try {
      await managerService.updateGroupServiceProvider(bookingId, itemId, providerId);
      setSuccess("Group service provider updated.");
      await loadBookings();
    } catch (err) {
      setError(getApiError(err, "Couldn't reassign that group service."));
    } finally {
      setBusyId(null);
    }
  };

  const reschedule = async (event) => {
    event.preventDefault();
    if (!editing.id || !editing.appointment_date) return;
    setBusyId(editing.id);
    setError("");
    setSuccess("");
    try {
      const updated = await managerService.rescheduleBooking(editing.id, new Date(editing.appointment_date).toISOString());
      setBookings((prev) => prev.map((booking) => (booking.id === editing.id ? updated : booking)));
      setSuccess(updated.payment_status === "paid"
        ? `Booking #${editing.id} rescheduled. Its verified payment remains attached and is non-refundable.`
        : `Booking #${editing.id} rescheduled.`);
      setEditing({ id: null, appointment_date: "" });
    } catch (err) {
      setError(getApiError(err, "Couldn't reschedule that booking."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ManagerWorkspace title="Branch Bookings" eyebrow="Confirm, reschedule, cancel, complete">
      {error && <Notice message={error} onRetry={loadBookings} />}
      {success && <Notice tone="success" message={success} />}

      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_auto] lg:items-center">
          <div className="relative min-w-0 flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
            <input maxLength={80} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, service, staff, email, or booking number" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
          </div>
          <ModernDatePicker value={dateFilter} onChange={setDateFilter} placeholder="Filter by date" ariaLabel="Filter branch bookings by date" />
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {statuses.map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${statusFilter === status ? "bg-[#C85B95] text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]" : "bg-[#FFF8FB] text-[#6B7280] hover:bg-[#FFF0F7] hover:text-[#1F2937]"}`}>
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : visibleBookings.length ? (
          <div className="space-y-4">
            {pagedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                busy={busyId === booking.id}
                editing={editing}
                onEdit={setEditing}
                onReschedule={reschedule}
                onStatus={updateStatus}
                onServiceStatus={updateServiceStatus}
                providers={providers}
                onServiceProvider={updateServiceProvider}
              />
            ))}
            <ListPagination page={page} totalItems={visibleBookings.length} onPageChange={setPage} itemLabel="bookings" />
          </div>
        ) : <EmptyState title="No matching bookings" description="Try another status, date, or search term. Only bookings from your assigned branch are shown." />}
      </section>
    </ManagerWorkspace>
  );
}

function BookingCard({ booking, busy, editing, onEdit, onReschedule, onStatus, onServiceStatus, providers, onServiceProvider }) {
  const canManage = !["completed", "cancelled"].includes(booking.status);
  const canUpdateGroupServices = ["confirmed", "treatment_done"].includes(booking.status);
  const isEditing = editing.id === booking.id;

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.9fr_auto] lg:items-center lg:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">{booking.group_reference || `Booking #${booking.id}`}{booking.group_reference && ` · ${booking.group_members?.length || 0} people`}</p>
            <StatusBadge status={booking.status} />
          </div>
          <h2 className="mt-3 truncate text-lg font-bold text-[#1F2937]">{booking.service?.name || "Service"}</h2>
          <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || booking.guest_name || "Customer"} • {booking.customer?.email || booking.guest_email || "No email"}</p>
          {(booking.customer?.phone_number || booking.guest_phone) && <p className="mt-1 text-xs text-[#667085]">{booking.customer?.phone_number || booking.guest_phone}</p>}
          {booking.preferred_service_provider && (
            <p className="mt-2 text-sm font-semibold text-[#7C3F62]">
              Customer preference: {booking.preferred_service_provider.full_name}
              <span className="font-normal text-[#6B7280]"> · subject to availability</span>
            </p>
          )}
          {booking.notes && <p className="mt-3 rounded-xl bg-[#FFF8FB] px-3 py-2 text-sm text-[#6B7280]">{booking.notes}</p>}
          {booking.group_reference && <details className="mt-3 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-3"><summary className="cursor-pointer text-sm font-bold text-[#A83F78]">View group details and service assignments</summary><div className="mt-3 space-y-3">{(booking.group_members || []).map((member) => <section key={member.id} className="rounded-lg bg-white p-3"><p className="text-sm font-extrabold text-[#344054]">{member.member_name}{member.is_booker ? " · Main booker" : ""}{member.contact_number ? ` · ${member.contact_number}` : ""}</p><div className="mt-2 space-y-2">{(booking.service_items || []).filter((item) => item.member_id === member.id).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3E8EF] pt-2 text-xs"><span>{item.service.name} · {item.appointment_start ? formatDateTime(item.appointment_start) : formatDateTime(booking.appointment_date)} · {formatCurrency(item.service_price ?? item.service.price)}</span><select aria-label={`Staff for ${item.service.name} assigned to ${member.member_name}`} value={item.service_provider?.id || ""} onChange={(event) => onServiceProvider(booking.id, item.id, event.target.value)} disabled={busy || !canUpdateGroupServices || item.status === "completed" || item.status === "cancelled"} className="rounded-lg border border-[#F0DCE7] bg-white px-2 py-1 text-xs"><option value="">Choose staff</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name} · {provider.job_title}</option>)}</select><span className="rounded-full bg-[#FFF0F7] px-2 py-1 capitalize text-[#A83F78]">{item.status}</span>{canUpdateGroupServices && item.status !== "cancelled" && <div className="flex gap-1"><button type="button" disabled={busy || item.status === "completed"} onClick={() => onServiceStatus(booking.id, item.id, "completed")} className="rounded-lg bg-[#DCFCE7] px-2 py-1 font-bold text-[#166534] disabled:opacity-50">Done</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Cancel ${item.service.name} for ${member.member_name}? Other group services will stay booked and paid amounts are unchanged.`)) onServiceStatus(booking.id, item.id, "cancelled"); }} className="rounded-lg bg-[#FEE2E2] px-2 py-1 font-bold text-[#991B1B] disabled:opacity-50">Cancel service</button></div>}</div>)}</div></section>)}</div></details>}
        </div>

        <div className="grid gap-3 text-sm text-[#6B7280] sm:grid-cols-2 lg:grid-cols-1">
          <span className="inline-flex items-center gap-2"><HiOutlineCalendarDays className="h-5 w-5 text-[#D65A9A]" /> {formatDateTime(booking.appointment_date)}</span>
          <span className="inline-flex items-center gap-2"><HiOutlineClock className="h-5 w-5 text-[#D65A9A]" /> {booking.service?.duration_minutes || 0} minutes</span>
          <span className="text-sm font-bold text-[#166534]">{formatCurrency(booking.service?.price)}</span>
          {booking.payment_status && <span className={`rounded-lg px-3 py-2 text-xs font-bold ${booking.payment_status === "paid" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FFF4E5] text-[#9A5B13]"}`}>{booking.payment_status === "paid" ? "Paid · non-refundable" : `Payment ${booking.payment_status}`}</span>}
        </div>

        <div className="flex flex-wrap gap-2 lg:w-64 lg:justify-end">
          {booking.status === "pending" && <ActionButton disabled={busy} onClick={() => onStatus(booking.id, "confirmed")} icon={HiOutlineCheck}>Confirm</ActionButton>}
          {canManage && <ActionButton disabled={busy} onClick={() => onEdit({ id: booking.id, appointment_date: toDateTimeLocal(booking.appointment_date) })} icon={HiOutlinePencilSquare}>Reschedule</ActionButton>}
          {canManage && !booking.group_reference && <ActionButton disabled={busy} onClick={() => onStatus(booking.id, "completed")} icon={HiOutlineCheck}>Complete & Record Sale</ActionButton>}
          {canManage && <ActionButton disabled={busy} variant="danger" onClick={() => onStatus(booking.id, "cancelled")} icon={HiOutlineXMark}>Cancel</ActionButton>}
        </div>
      </div>

      {isEditing && (
        <form onSubmit={onReschedule} className="border-t border-[#F3E8EF] bg-[#FFF8FB] p-4 lg:p-5">
          {booking.payment_status === "paid" && <p className="mb-3 rounded-xl border border-[#F2D8B7] bg-[#FFFAF2] p-3 text-xs leading-5 text-[#755B3B]">Rescheduling updates this original booking. Its verified payment stays attached to the new appointment date and is non-refundable. No new payment is collected for the reschedule.</p>}
          <div className="grid gap-3 md:grid-cols-[minmax(15rem,1fr)_13rem_auto] md:items-end">
            <div className="text-sm font-bold text-[#1F2937]">
              <span>New appointment date</span>
              <ModernDatePicker value={editing.appointment_date.split("T")[0] || ""} onChange={(date) => onEdit((prev) => ({ ...prev, appointment_date: date ? `${date}T${prev.appointment_date.split("T")[1] || "09:00"}` : "" }))} placeholder="Choose new date" className="mt-2" />
            </div>
            <label className="text-sm font-bold text-[#1F2937]">Time<select required value={editing.appointment_date.split("T")[1] || ""} onChange={(event) => onEdit((prev) => ({ ...prev, appointment_date: `${prev.appointment_date.split("T")[0]}T${event.target.value}` }))} className="form-input mt-2 bg-white"><option value="">Choose time</option>{rescheduleTimes.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button>
              <button type="button" onClick={() => onEdit({ id: null, appointment_date: "" })} className="min-h-11 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937]">Close</button>
            </div>
          </div>
        </form>
      )}
    </article>
  );
}

function ActionButton({ children, icon: Icon, variant = "default", ...props }) {
  const className = variant === "danger" ? "border-[#EF4444]/20 bg-white text-[#B91C1C] hover:bg-[#FEF2F2]" : "border-[#D65A9A]/25 bg-white text-[#1F2937] hover:bg-[#FFF0F7]";
  return (
    <button type="button" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${className}`} {...props}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
