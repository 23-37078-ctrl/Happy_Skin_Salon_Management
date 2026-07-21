import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from "react-icons/hi2";
import staffBookingService from "../../services/staffBookingService";
import staffTransactionService from "../../services/staffTransactionService";
import ModernDatePicker from "../../components/common/ModernDatePicker";
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
  const [dateFilter, setDateFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState({ bookingId: null, base_price: 0, payment_method: "cash", service_provider_id: "", amount_tendered: "", additional_charges: [], commission_rate: "10" });
  const [providers, setProviders] = useState([]);
  const [providerAssignments, setProviderAssignments] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [staffContext, setStaffContext] = useState(null);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [payload, providerData, transactionData, contextData] = await Promise.all([
        staffBookingService.list({ page: 1, page_size: 100 }),
        staffBookingService.providers(),
        staffTransactionService.list({ page: 1, page_size: 100 }),
        staffTransactionService.posContext(),
      ]);
      setBookings(payload.bookings || []);
      setProviders(providerData || []);
      setTransactions(transactionData.transactions || []);
      setStaffContext(contextData);
      setProviderAssignments((previous) => Object.fromEntries((payload.bookings || []).map((booking) => [booking.id, previous[booking.id] || booking.service_provider?.id || ""])));
    } catch (err) {
      setError(getApiError(err, "We couldn't load branch bookings."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadBookings());
  }, [loadBookings]);

  const visibleBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const text = [
        booking.customer?.full_name,
        booking.customer?.email,
        booking.service?.name,
        booking.branch?.name,
        booking.status,
        booking.id,
      ].join(" ").toLowerCase();
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const appointmentDate = new Date(booking.appointment_date);
      const localDate = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, "0")}-${String(appointmentDate.getDate()).padStart(2, "0")}`;
      const matchesDate = !dateFilter || localDate === dateFilter;
      return matchesStatus && matchesDate && (!term || text.includes(term));
    });
  }, [bookings, search, statusFilter, dateFilter]);

  const headerStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayBookings = bookings.filter((booking) => new Date(booking.appointment_date).toDateString() === today).length;
    const openQueue = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status)).length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const todayRevenue = transactions.filter((transaction) => new Date(transaction.created_at).toDateString() === today).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    return [
      { label: "Today's Appointments", value: todayBookings, icon: HiOutlineCalendarDays, tone: "pink" },
      { label: "Open Queue", value: openQueue, icon: HiOutlineClock, tone: "amber" },
      { label: "Completed", value: completed, icon: HiOutlineCheckCircle, tone: "green" },
      { label: "Today Revenue", value: formatCurrency(todayRevenue), icon: HiOutlineBanknotes, tone: "blue" },
    ];
  }, [bookings, transactions]);

  const handleStatusUpdate = async (bookingId, status) => {
    setBusyId(bookingId);
    setError("");
    setSuccess("");
    try {
      const providerId = providerAssignments[bookingId] || null;
      if (["confirmed", "completed"].includes(status) && !providerId) {
        setError("Select the staff member who will perform the service first.");
        setBusyId(null);
        return;
      }
      const updated = await staffBookingService.updateStatus(bookingId, status, providerId ? Number(providerId) : null);
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
      const extras = paymentDraft.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) }));
      if (extras.some((item) => !item.reason || item.amount <= 0)) throw new Error("Every additional charge needs a reason and a valid amount.");
      const extrasTotal = extras.reduce((sum, item) => sum + item.amount, 0);
      const commission = Number(paymentDraft.base_price) * Number(paymentDraft.commission_rate || 0) / 100;
      const amountDue = Number(paymentDraft.base_price) + extrasTotal + commission;
      if (paymentDraft.payment_method === "cash" && Number(paymentDraft.amount_tendered || 0) < amountDue) throw new Error("Cash received must cover the total amount due.");
      await staffTransactionService.create({
        booking_id: paymentDraft.bookingId,
        payment_method: paymentDraft.payment_method,
        service_provider_id: Number(paymentDraft.service_provider_id),
        amount_tendered: paymentDraft.payment_method === "cash" ? Number(paymentDraft.amount_tendered) : amountDue,
        additional_charges: extras,
        commission_rate: Number(paymentDraft.commission_rate),
      });
      const updated = await staffBookingService.getById(paymentDraft.bookingId);
      setBookings((prev) => prev.map((booking) => (booking.id === paymentDraft.bookingId ? updated : booking)));
      setPaymentDraft({ bookingId: null, base_price: 0, payment_method: "cash", service_provider_id: "", amount_tendered: "", additional_charges: [], commission_rate: "10" });
      setSuccess(`Payment recorded for booking #${paymentDraft.bookingId}.`);
    } catch (err) {
      setError(getApiError(err, "Couldn't record that payment."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StaffWorkspace title="Booking Queue" eyebrow="Staff appointments" brandOnly headerStats={headerStats} identity={staffContext}>
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
          <ModernDatePicker value={dateFilter} onChange={setDateFilter} placeholder="Filter by date" ariaLabel="Filter bookings by date" className="lg:min-w-56" />
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
                providers={providers}
                providerId={providerAssignments[booking.id] || ""}
                onProviderChange={(providerId) => setProviderAssignments((previous) => ({ ...previous, [booking.id]: providerId }))}
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

function BookingCard({ booking, busy, paymentDraft, providers, providerId, onProviderChange, onStatusUpdate, onPaymentDraft, onRecordPayment }) {
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
          <label className="text-xs font-bold text-[#1F2937]">Service provider<select value={providerId} onChange={(event) => onProviderChange(event.target.value)} disabled={!canManage} className="mt-1 min-h-10 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 text-xs outline-none focus:border-[#D65A9A]"><option value="">Choose provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name} — {provider.job_title}</option>)}</select></label>
        </div>

        <div className="flex flex-wrap gap-2 lg:w-52 lg:justify-end">
          {booking.status === "pending" && (
            <ActionButton disabled={busy || !providerId} onClick={() => onStatusUpdate(booking.id, "confirmed")} icon={HiOutlineCheck}>Confirm</ActionButton>
          )}
          {canManage && (
            <ActionButton disabled={busy || !providerId} onClick={() => onPaymentDraft({ bookingId: booking.id, base_price: Number(booking.service?.price || 0), payment_method: "cash", service_provider_id: providerId, amount_tendered: "", additional_charges: [], commission_rate: "10" })} icon={HiOutlineBanknotes}>Checkout</ActionButton>
          )}
          {canManage && (
            <ActionButton disabled={busy} variant="danger" onClick={() => onStatusUpdate(booking.id, "cancelled")} icon={HiOutlineXMark}>Cancel</ActionButton>
          )}
        </div>
      </div>

      {isPaying && (
        <form onSubmit={onRecordPayment} className="border-t border-[#F3E8EF] bg-[#FFF8FB] p-4 lg:p-5">
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <label className="text-sm font-bold text-[#1F2937]">
              Cash received
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentDraft.amount_tendered}
                disabled={paymentDraft.payment_method !== "cash"}
                onChange={(event) => onPaymentDraft((prev) => ({ ...prev, amount_tendered: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-white px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
              />
            </label>
            <label className="text-sm font-bold text-[#1F2937]">Service Provider<select required value={paymentDraft.service_provider_id} onChange={(event) => { onPaymentDraft((prev) => ({ ...prev, service_provider_id: event.target.value })); onProviderChange(event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-white px-3 py-2 text-sm outline-none focus:border-[#D65A9A]">{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name} — {provider.job_title}</option>)}</select></label>
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
            <label className="text-sm font-bold text-[#1F2937]">Commission rate (%)<input type="number" min="0" max="100" step="0.5" value={paymentDraft.commission_rate} onChange={(event) => onPaymentDraft((prev) => ({ ...prev, commission_rate: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-white px-3 py-2 text-sm outline-none" /></label>
          </div>
          <div className="mt-4 rounded-xl border border-[#F3E8EF] bg-white p-3"><div className="flex items-center justify-between"><p className="text-sm font-bold">Additional charges</p><button type="button" onClick={() => onPaymentDraft((prev) => ({ ...prev, additional_charges: [...prev.additional_charges, { reason: "", amount: "" }] }))} className="rounded-lg border border-[#D65A9A]/25 px-3 py-2 text-xs font-bold text-[#C85B95]">+ Add charge</button></div><div className="mt-3 space-y-2">{paymentDraft.additional_charges.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_10rem_2.5rem]"><input required value={item.reason} onChange={(event) => onPaymentDraft((prev) => ({ ...prev, additional_charges: prev.additional_charges.map((charge, i) => i === index ? { ...charge, reason: event.target.value } : charge) }))} placeholder="Reason/design" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => onPaymentDraft((prev) => ({ ...prev, additional_charges: prev.additional_charges.map((charge, i) => i === index ? { ...charge, amount: event.target.value } : charge) }))} placeholder="Amount" className="form-input" /><button type="button" onClick={() => onPaymentDraft((prev) => ({ ...prev, additional_charges: prev.additional_charges.filter((_, i) => i !== index) }))} className="grid h-11 w-10 place-items-center text-[#B91C1C]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div></div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save Payment</button>
              <button type="button" onClick={() => onPaymentDraft({ bookingId: null, base_price: 0, payment_method: "cash", service_provider_id: "", amount_tendered: "", additional_charges: [], commission_rate: "10" })} className="min-h-11 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937]">Close</button>
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
