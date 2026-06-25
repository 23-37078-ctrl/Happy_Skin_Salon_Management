import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from "react-icons/hi2";
import staffBookingService from "../../services/staffBookingService";
import staffTransactionService from "../../services/staffTransactionService";
import {
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  StaffWorkspace,
  StatusBadge,
} from "./StaffWorkspace";
import {
  formatCurrency,
  formatDateTime,
  getApiError,
  paymentLabels,
} from "./staffWorkspaceUtils";

const statuses = ["all", "pending", "confirmed", "completed", "cancelled"];
const paymentMethods = ["cash", "gcash", "card", "bank_transfer"];

export default function BookService() {
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState({ bookingId: null, amount: "", payment_method: "cash" });

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await staffBookingService.list({
        page: 1,
        page_size: 100,
        status_filter: statusFilter === "all" ? null : statusFilter,
      });
      setBookings(payload.bookings || []);
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
    if (!term) return bookings;
    return bookings.filter((booking) => {
      const text = [
        booking.customer?.full_name,
        booking.customer?.email,
        booking.service?.name,
        booking.branch?.name,
        booking.status,
        booking.id,
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [bookings, search]);

  const handleStatusUpdate = async (bookingId, status) => {
    setBusyId(bookingId);
    setError("");
    setSuccess("");
    try {
      const updated = await staffBookingService.updateStatus(bookingId, status);
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? updated : booking)));
      setSuccess(`Booking #${bookingId} marked as ${status}.`);
    } catch (err) {
      setError(getApiError(err, "Couldn't update that booking."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!paymentDraft.bookingId) return;

    setBusyId(paymentDraft.bookingId);
    setError("");
    setSuccess("");
    try {
      await staffTransactionService.create({
        booking_id: paymentDraft.bookingId,
        amount: paymentDraft.amount ? Number(paymentDraft.amount) : null,
        payment_method: paymentDraft.payment_method,
      });
      const updated = await staffBookingService.getById(paymentDraft.bookingId);
      setBookings((prev) => prev.map((booking) => (booking.id === paymentDraft.bookingId ? updated : booking)));
      setPaymentDraft({ bookingId: null, amount: "", payment_method: "cash" });
      setSuccess(`Payment recorded for booking #${paymentDraft.bookingId}.`);
    } catch (err) {
      setError(getApiError(err, "Couldn't record that payment."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StaffWorkspace title="Booking Queue" eyebrow="Staff appointments">
      {error && <ErrorNotice message={error} onRetry={loadBookings} />}
      {success && (
        <div className="mb-5 rounded-[1.25rem] border border-[#22C55E]/20 bg-white px-4 py-3 text-sm font-semibold text-[#166534] shadow-sm">
          {success}
        </div>
      )}

      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, service, email, or booking number"
              className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
                  statusFilter === status ? "bg-[#C85B95] text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]" : "bg-[#FFF8FB] text-[#6B7280] hover:bg-[#FFF0F7] hover:text-[#1F2937]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        {isLoading ? (
          <CardSkeleton rows={5} />
        ) : visibleBookings.length ? (
          <div className="space-y-4">
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                busy={busyId === booking.id}
                paymentDraft={paymentDraft}
                onStatusUpdate={handleStatusUpdate}
                onPaymentDraft={setPaymentDraft}
                onRecordPayment={handleRecordPayment}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No matching bookings" description="Try another status tab or search term. Branch appointments will appear here once they are scheduled." />
        )}
      </section>
    </StaffWorkspace>
  );
}

function BookingCard({ booking, busy, paymentDraft, onStatusUpdate, onPaymentDraft, onRecordPayment }) {
  const canManage = !["completed", "cancelled"].includes(booking.status);
  const isPaying = paymentDraft.bookingId === booking.id;

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.9fr_auto] lg:items-center lg:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Booking #{booking.id}</p>
            <StatusBadge status={booking.status} />
          </div>
          <h2 className="mt-3 truncate text-lg font-bold text-[#1F2937]">{booking.service?.name || "Service"}</h2>
          <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || "Customer"} • {booking.customer?.email || "No email"}</p>
          {booking.notes && <p className="mt-3 rounded-xl bg-[#FFF8FB] px-3 py-2 text-sm text-[#6B7280]">{booking.notes}</p>}
        </div>

        <div className="grid gap-3 text-sm text-[#6B7280] sm:grid-cols-2 lg:grid-cols-1">
          <span className="inline-flex items-center gap-2"><HiOutlineCalendarDays className="h-5 w-5 text-[#D65A9A]" /> {formatDateTime(booking.appointment_date)}</span>
          <span className="inline-flex items-center gap-2"><HiOutlineClock className="h-5 w-5 text-[#D65A9A]" /> {booking.service?.duration_minutes || 0} minutes</span>
          <span className="inline-flex items-center gap-2"><HiOutlineBanknotes className="h-5 w-5 text-[#D65A9A]" /> {formatCurrency(booking.service?.price)}</span>
        </div>

        <div className="flex flex-wrap gap-2 lg:w-52 lg:justify-end">
          {booking.status === "pending" && (
            <ActionButton disabled={busy} onClick={() => onStatusUpdate(booking.id, "confirmed")} icon={HiOutlineCheck}>Confirm</ActionButton>
          )}
          {canManage && (
            <ActionButton disabled={busy} onClick={() => onPaymentDraft({ bookingId: booking.id, amount: booking.service?.price || "", payment_method: "cash" })} icon={HiOutlineBanknotes}>Record Pay</ActionButton>
          )}
          {canManage && (
            <ActionButton disabled={busy} variant="danger" onClick={() => onStatusUpdate(booking.id, "cancelled")} icon={HiOutlineXMark}>Cancel</ActionButton>
          )}
        </div>
      </div>

      {isPaying && (
        <form onSubmit={onRecordPayment} className="border-t border-[#F3E8EF] bg-[#FFF8FB] p-4 lg:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-bold text-[#1F2937]">
              Amount
              <input
                type="number"
                min="1"
                step="0.01"
                value={paymentDraft.amount}
                onChange={(event) => onPaymentDraft((prev) => ({ ...prev, amount: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-white px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
              />
            </label>
            <label className="text-sm font-bold text-[#1F2937]">
              Payment Method
              <select
                value={paymentDraft.payment_method}
                onChange={(event) => onPaymentDraft((prev) => ({ ...prev, payment_method: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-white px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
              >
                {paymentMethods.map((method) => <option key={method} value={method}>{paymentLabels[method]}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save Payment</button>
              <button type="button" onClick={() => onPaymentDraft({ bookingId: null, amount: "", payment_method: "cash" })} className="min-h-11 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937]">Close</button>
            </div>
          </div>
        </form>
      )}
    </article>
  );
}

function ActionButton({ children, icon: Icon, variant = "default", ...props }) {
  const className = variant === "danger"
    ? "border-[#EF4444]/20 bg-white text-[#B91C1C] hover:bg-[#FEF2F2]"
    : "border-[#D65A9A]/25 bg-white text-[#1F2937] hover:bg-[#FFF0F7]";

  return (
    <button type="button" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${className}`} {...props}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
