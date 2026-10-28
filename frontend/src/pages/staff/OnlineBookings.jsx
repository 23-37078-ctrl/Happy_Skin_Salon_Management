import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HiOutlineCalendarDays, HiOutlineXMark } from "react-icons/hi2";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace } from "./StaffWorkspace";
import { formatCurrency, formatDateTime, getApiError, getAppointmentDateKey } from "./staffWorkspaceUtils";
import PaymentReceipt from "./PaymentReceipt";
import ListPagination from "../../components/common/ListPagination";
import { formatAppointmentDate } from "../../utils/appointmentTime";
import { recommendProvider } from "./providerAssignment";

const emptyPayment = { payment_method: "cash", amount_tendered: "", commission_amount: "", additional_charges: [] };
const BOOKING_PAGE_SIZE = 12;

function compareBookings(left, right) {
  const leftCreatedAt = Date.parse(left.created_at || left.appointment_date) || 0;
  const rightCreatedAt = Date.parse(right.created_at || right.appointment_date) || 0;
  return leftCreatedAt - rightCreatedAt || Number(left.id) - Number(right.id);
}

function groupBookingsByCustomer(bookings) {
  const groups = new Map();
  bookings.forEach((booking) => {
    const customer = booking.customer || {};
    const key = customer.id != null
      ? `customer:${customer.id}`
      : customer.email
        ? `email:${customer.email.trim().toLowerCase()}`
        : customer.phone_number
          ? `phone:${customer.phone_number.replace(/\D/g, "")}`
          : `booking:${booking.id}`;
    const group = groups.get(key) || {
      key,
      name: customer.full_name || "Guest customer",
      bookings: [],
    };
    group.bookings.push(booking);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    bookings: group.bookings.sort(compareBookings),
  })).sort((left, right) => compareBookings(left.bookings[0], right.bookings[0]));
}

export default function OnlineBookings() {
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [walkInBookings, setWalkInBookings] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [payment, setPayment] = useState(emptyPayment);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOtherDate, setSelectedOtherDate] = useState("");
  const [page, setPage] = useState(1);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const paymentIdempotencyKeys = useRef(new Map());
  const providersRef = useRef([]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [bookingData, walkInData] = await Promise.all([
        staffTransactionService.onlineBookings(),
        staffTransactionService.walkInBookings(),
      ]);
      setBookings(bookingData || []);
      setWalkInBookings(walkInData || []);
      let providerData = providersRef.current;
      if (!silent) {
        providerData = await staffTransactionService.posStaff();
        providersRef.current = providerData || [];
        setProviders(providersRef.current);
      }
      setAssignments((current) => Object.fromEntries((bookingData || []).map((booking) => {
        const services = booking.services?.length ? booking.services : [booking.service].filter(Boolean);
        const previous = current[booking.id] || {};
        const assignedCounts = {};
        const bookingAssignments = Object.fromEntries(services.map((service) => {
          const key = String(service.booking_service_item_id || service.id);
          const providerId = previous[key] || service.service_provider?.id || recommendProvider(service, providerData, assignedCounts);
          if (providerId) assignedCounts[providerId] = (assignedCounts[providerId] || 0) + 1;
          return [key, providerId ? String(providerId) : ""];
        }));
        return [booking.id, bookingAssignments];
      })));
    } catch (err) {
      setError(getApiError(err, "Bookings could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
    const refreshTimer = window.setInterval(() => load({ silent: true }), 30000);
    return () => window.clearInterval(refreshTimer);
  }, [load]);

  const allBookings = useMemo(() => [
    ...bookings.map((booking) => ({ ...booking, booking_type: "online" })),
    ...walkInBookings.map((booking) => ({ ...booking, booking_type: "walk-in" })),
  ].sort(compareBookings), [bookings, walkInBookings]);
  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allBookings.filter((booking) => {
      const searchable = [booking.id, booking.booking_type, booking.customer?.full_name, booking.customer?.email, booking.customer?.phone_number, booking.service?.name, booking.service_provider?.full_name].filter(Boolean).join(" ").toLowerCase();
      const statusMatches = statusFilter === "all"
        || (statusFilter === "pending" && booking.booking_type === "online" && booking.status === "pending")
        || (statusFilter === "confirmed" && booking.booking_type === "online" && booking.status === "confirmed")
        || (statusFilter === "in_treatment" && booking.booking_type === "walk-in" && booking.status === "confirmed")
        || (statusFilter === "treatment_done" && booking.status === "treatment_done");
      return statusMatches && (!term || searchable.includes(term));
    });
  }, [allBookings, search, statusFilter]);
  const todayDateKey = getAppointmentDateKey(new Date().toISOString());
  const todayBookings = useMemo(
    () => filteredBookings.filter((booking) => getAppointmentDateKey(booking.appointment_date) === todayDateKey),
    [filteredBookings, todayDateKey]
  );
  const otherBookingsByDate = useMemo(() => {
    const byDate = new Map();
    filteredBookings.forEach((booking) => {
      const date = getAppointmentDateKey(booking.appointment_date);
      if (!date || date === todayDateKey) return;
      const dateBookings = [...(byDate.get(date) || []), booking];
      dateBookings.sort(compareBookings);
      byDate.set(date, dateBookings);
    });
    return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filteredBookings, todayDateKey]);
  const selectedDateBookings = otherBookingsByDate.find(([date]) => date === selectedOtherDate)?.[1] || [];
  const todayCustomerGroups = useMemo(() => groupBookingsByCustomer(todayBookings), [todayBookings]);
  const selectedDateCustomerGroups = useMemo(() => groupBookingsByCustomer(selectedDateBookings), [selectedDateBookings]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(todayCustomerGroups.length / BOOKING_PAGE_SIZE)));
  const visibleCustomerGroups = useMemo(() => todayCustomerGroups.slice((safePage - 1) * BOOKING_PAGE_SIZE, safePage * BOOKING_PAGE_SIZE), [todayCustomerGroups, safePage]);

  const runAction = async (action) => {
    setBusy(true);
    setError("");
    try { await action(); await load(); }
    catch (err) { setError(getApiError(err, "The booking could not be updated.")); }
    finally { setBusy(false); }
  };

  const basePrice = paymentBooking?.services?.length ? paymentBooking.services.reduce((sum, service) => sum + Number(service.price || 0), 0) : Number(paymentBooking?.service?.price || 0);
  const commission = Number(payment.commission_amount || 0);
  const additionalTotal = payment.additional_charges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = basePrice + additionalTotal + commission;
  const tendered = Number(payment.amount_tendered || 0);

  const submitPayment = async (event) => {
    event.preventDefault();
    if (payment.payment_method === "cash" && tendered < total) return setError("Cash received must cover the total amount.");
    setBusy(true);
    setError("");
    try {
      const paymentKey = paymentIdempotencyKeys.current.get(paymentBooking.id) || crypto.randomUUID();
      paymentIdempotencyKeys.current.set(paymentBooking.id, paymentKey);
      const result = await staffTransactionService.create({
        booking_id: paymentBooking.id,
        idempotency_key: paymentKey,
        service_provider_id: paymentBooking.service_provider?.id,
        payment_method: payment.payment_method,
        amount_tendered: payment.payment_method === "cash" ? tendered : total,
        additional_charges: payment.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) })),
        commission_amount: commission,
      });
      setReceipt(result);
      paymentIdempotencyKeys.current.delete(paymentBooking.id);
      setPaymentBooking(null);
      setPayment(emptyPayment);
      await load();
    } catch (err) {
      setError(getApiError(err, "Payment could not be completed."));
    } finally {
      setBusy(false);
    }
  };
  const submitCancellation = async () => {
    if (!cancelReason.trim()) return setCancelError("Please provide a cancellation reason.");
    await runAction(() => staffTransactionService.cancelOnlineBooking(cancelBooking.id, cancelReason.trim()));
    setCancelBooking(null); setCancelReason(""); setCancelError("");
  };

  const renderBookingCard = (booking) => <article key={booking.id} className="rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2"><p className="font-extrabold text-[#1F2937]">{booking.customer?.full_name || "Guest customer"}</p>{booking.customer?.id == null && <span className="rounded-full bg-[#FFF0F7] px-2 py-0.5 text-[10px] font-bold text-[#A83F78]">Guest</span>}</div>
        <p className="mt-1 text-xs text-[#9CA3AF]">{formatDateTime(booking.appointment_date)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${booking.booking_type === "walk-in" ? "bg-[#F3E8FF] text-[#7E22CE]" : "bg-[#FFF0F7] text-[#A83F78]"}`}>{booking.booking_type === "walk-in" ? "Walk-in" : "Online"}</span><Status status={booking.status} bookingType={booking.booking_type} /></div>
    </div>
    {booking.booking_type === "online" && booking.status === "pending" && <div className="mt-4 space-y-3">{(booking.services?.length ? booking.services : [booking.service].filter(Boolean)).map((service) => { const assignmentKey = String(service.booking_service_item_id || service.id); return <label key={assignmentKey} className="block text-xs font-bold text-[#374151]">{service.name || "Service provider"}<select value={assignments[booking.id]?.[assignmentKey] || ""} onChange={(event) => setAssignments((current) => ({ ...current, [booking.id]: { ...(current[booking.id] || {}), [assignmentKey]: event.target.value } }))} className="form-input mt-1"><option value="">Choose provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name} ({provider.job_title}) - {provider.active_customer_count || 0} active bookings</option>)}</select></label>; })}</div>}
    {booking.status === "treatment_done" && <p className="mt-4 text-xs font-bold text-[#166534]">Treatment is complete. Record payment below.</p>}
    <div className="mt-4 flex gap-2">
      {booking.booking_type === "online" && ["pending", "confirmed"].includes(booking.status) && !booking.checked_in_at && <button disabled={busy} onClick={() => runAction(() => staffTransactionService.checkInOnlineBooking(booking.id))} className="min-h-10 rounded-xl border border-[#166534]/30 px-3 text-xs font-bold text-[#166534] hover:bg-[#DCFCE7]">Mark arrived</button>}
      {booking.booking_type === "online" && booking.status === "pending" && <button disabled={busy || !(booking.services?.length ? booking.services : [booking.service].filter(Boolean)).every((service) => assignments[booking.id]?.[String(service.booking_service_item_id || service.id)])} onClick={() => { const services = booking.services?.length ? booking.services : [booking.service].filter(Boolean); const serviceProviderIds = Object.fromEntries(services.map((service) => [String(service.booking_service_item_id || service.id), Number(assignments[booking.id][String(service.booking_service_item_id || service.id)])])); const primaryProviderId = Number(Object.values(serviceProviderIds)[0]); return runAction(() => staffTransactionService.confirmOnlineBooking(booking.id, primaryProviderId, serviceProviderIds)); }} className="min-h-10 flex-1 rounded-xl bg-[#C85B95] px-3 text-xs font-bold text-white disabled:opacity-40">Confirm booking</button>}
      {booking.status === "confirmed" && <button disabled={busy} onClick={() => runAction(() => booking.booking_type === "walk-in" ? staffTransactionService.markTreatmentDone(booking.id) : staffTransactionService.markOnlineTreatmentDone(booking.id))} className="min-h-10 flex-1 rounded-xl bg-[#1F2937] px-3 text-xs font-bold text-white">Treatment done</button>}
      {booking.status === "treatment_done" && <button disabled={busy} onClick={() => { setSelectedOtherDate(""); setPaymentBooking(booking); setPayment(emptyPayment); setReceipt(null); }} className="min-h-10 flex-1 rounded-xl bg-[#166534] px-3 text-xs font-bold text-white">Collect payment</button>}
      {["pending", "confirmed"].includes(booking.status) && <button type="button" disabled={busy} onClick={() => { setCancelBooking(booking); setCancelReason(""); setCancelError(""); }} className="min-h-10 rounded-xl border border-[#DC2626] px-3 text-xs font-bold text-[#B91C1C] hover:bg-[#FEE2E2]">Cancel</button>}
    </div>
  </article>;

  const renderCustomerGroup = (group) => group.bookings.length === 1
    ? renderBookingCard(group.bookings[0])
    : <section key={group.key} className="rounded-2xl border-2 border-[#E9B7D0] bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-[#F3E8EF] pb-3">
        <div><p className="font-extrabold text-[#1F2937]">{group.name}</p><p className="mt-1 text-xs text-[#9A6380]">Bookings for this customer</p></div>
        <span className="shrink-0 rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#A83F78]">{group.bookings.length} bookings</span>
      </header>
      <div className="space-y-3">{group.bookings.map(renderBookingCard)}</div>
    </section>;

  return <StaffWorkspace title="Bookings" eyebrow="All branch reservations">
    {error && <ErrorNotice message={error} onRetry={load} />}

    <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Branch schedule</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Online and walk-in bookings in booking order</h2>
        </div>
        <span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#C85B95]">{todayBookings.length} today</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem]">
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search customer, service, provider, or booking #" className="form-input" />
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="form-input">
          <option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in_treatment">In treatment</option><option value="treatment_done">Treatment done</option>
        </select>
      </div>
      <h3 className="mt-5 font-bold text-[#1F2937]">Today's bookings</h3>
      {loading ? <p className="mt-4 text-sm text-[#6B7280]">Loading bookings...</p> : todayBookings.length ? <>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{visibleCustomerGroups.map(renderCustomerGroup)}</div>
        <ListPagination page={page} pageSize={BOOKING_PAGE_SIZE} totalItems={todayCustomerGroups.length} onPageChange={setPage} itemLabel="today's customers" />
      </> : <p className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-8 text-center text-sm text-[#6B7280]">No bookings scheduled for today.</p>}

      <div className="mt-7 border-t border-[#F3E8EF] pt-5">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-bold text-[#1F2937]">Other booking dates</h3><p className="mt-1 text-xs text-[#6B7280]">Online and walk-in bookings, grouped by date.</p></div>
          <span className="rounded-full bg-[#F8F1F5] px-3 py-1 text-xs font-bold text-[#6B7280]">{otherBookingsByDate.length} dates</span>
        </div>
        {otherBookingsByDate.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {otherBookingsByDate.map(([date, dateBookings]) => <button key={date} type="button" onClick={() => setSelectedOtherDate(date)} className="flex min-h-20 items-center gap-3 rounded-xl border border-[#F0DCE7] bg-[#FFF8FB] p-4 text-left transition hover:border-[#D65A9A] hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#C85B95]"><HiOutlineCalendarDays className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-[#374151]">{formatAppointmentDate(`${date}T12:00:00+08:00`)}</span><span className="mt-1 block text-xs text-[#6B7280]">{dateBookings.length} {dateBookings.length === 1 ? "booking" : "bookings"}</span></span>
          </button>)}
        </div> : <p className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-6 text-center text-sm text-[#6B7280]">No other dated bookings.</p>}
      </div>
    </section>

    {selectedOtherDate && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#172033]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOtherDate(""); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="other-date-bookings-title" className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-[#F3E8EF] p-5">
          <div><p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Bookings for</p><h2 id="other-date-bookings-title" className="mt-1 text-xl font-extrabold text-[#1F2937]">{formatAppointmentDate(`${selectedOtherDate}T12:00:00+08:00`)}</h2><p className="mt-1 text-sm text-[#6B7280]">{selectedDateBookings.length} {selectedDateBookings.length === 1 ? "booking" : "bookings"}</p></div>
          <button type="button" onClick={() => setSelectedOtherDate("")} aria-label="Close date bookings" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#6B7280] hover:bg-[#FFF0F7] hover:text-[#A83F78]"><HiOutlineXMark className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[calc(90vh-112px)] overflow-y-auto p-5">
          {selectedDateBookings.length ? <div className="grid gap-4 lg:grid-cols-2">{selectedDateCustomerGroups.map(renderCustomerGroup)}</div> : <p className="rounded-xl bg-[#FFF8FB] px-4 py-8 text-center text-sm text-[#6B7280]">No bookings for this date.</p>}
        </div>
      </section>
    </div>}

    {paymentBooking && <form onSubmit={submitPayment} role="dialog" aria-modal="true" aria-label="Complete booking payment" className="staff-payment-dialog mt-5 rounded-[1.5rem] border-2 border-[#D65A9A]/30 bg-white p-5 shadow-lg"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-[#D65A9A]">Payment</p><h2 className="mt-1 text-lg font-extrabold">{paymentBooking.customer.full_name} · {paymentBooking.service.name}</h2></div><button type="button" onClick={() => setPaymentBooking(null)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Payment method<select value={payment.payment_method} onChange={(e) => setPayment((p) => ({ ...p, payment_method: e.target.value }))} className="form-input mt-2"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><label className="text-sm font-bold">{payment.payment_method === "cash" ? "Cash received" : "Amount"}<input required type="number" min={total} step="0.01" value={payment.payment_method === "cash" ? payment.amount_tendered : total} disabled={payment.payment_method !== "cash"} onChange={(e) => setPayment((p) => ({ ...p, amount_tendered: e.target.value }))} className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label></div><OnlineAdditionalPayments items={payment.additional_charges} onChange={(additional_charges) => setPayment((current) => ({ ...current, additional_charges, amount_tendered: current.payment_method === "cash" ? "" : current.amount_tendered }))} /><label className="mt-4 block text-sm font-bold">Staff commission / tip <span className="font-normal text-[#6B7280]">(optional amount paid separately by customer)</span><input type="number" min="0" step="0.01" value={payment.commission_amount} onChange={(e) => setPayment((p) => ({ ...p, commission_amount: e.target.value, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} placeholder="0.00" className="form-input mt-2" /></label><div className="mt-4 rounded-xl bg-[#FFF8FB] p-4 text-sm"><p className="flex justify-between"><span>Service</span><strong>{formatCurrency(basePrice)}</strong></p><p className="mt-2 flex justify-between"><span>Additional payments</span><strong>{formatCurrency(additionalTotal)}</strong></p><p className="mt-2 flex justify-between text-[#C85B95]"><span>Staff commission / tip</span><strong>{formatCurrency(commission)}</strong></p><p className="mt-3 flex justify-between border-t pt-3 text-base"><span>Customer total</span><strong>{formatCurrency(total)}</strong></p><p className="mt-2 flex justify-between"><span>Change</span><strong>{formatCurrency(Math.max(0, tendered - total))}</strong></p></div><button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-[#166534] font-bold text-white disabled:opacity-40">{busy ? "Processing…" : "Complete payment"}</button></form>}

    {receipt && <PaymentReceipt receipt={receipt} onClose={() => setReceipt(null)} autoPrint />}
    {cancelBooking && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#172033]/35 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-extrabold text-[#1F2937]">Cancel Appointment?</h2><p className="mt-2 text-sm text-[#6B7280]">Are you sure you want to cancel this appointment? This action will update the appointment status to Cancelled.</p><label className="mt-4 block text-sm font-bold text-[#1F2937]">Reason for Cancellation<select value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); setCancelError(""); }} className="form-input mt-2"><option value="">Select a reason</option><option>Customer Requested</option><option>Customer Unavailable</option><option>Staff Unavailable</option><option>Scheduling Conflict</option><option>Duplicate Appointment</option><option>No Longer Needed</option><option>Other</option></select></label>{cancelReason === "Other" && <textarea className="form-input mt-3" placeholder="Please specify the reason" onChange={(event) => setCancelReason(event.target.value)} />}{cancelError && <p className="mt-2 text-sm font-bold text-[#B91C1C]">{cancelError}</p>}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCancelBooking(null)} className="rounded-xl border px-4 py-2 font-bold">Keep Appointment</button><button type="button" onClick={submitCancellation} disabled={busy} className="rounded-xl bg-[#B91C1C] px-4 py-2 font-bold text-white">Cancel Appointment</button></div></section></div>}

  </StaffWorkspace>;
}

function OnlineAdditionalPayments({ items, onChange }) {
  return <section className="mt-4 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-[#1F2937]">Additional payments</h3><p className="mt-1 text-xs text-[#6B7280]">Optional extras paid by the customer.</p></div><button type="button" onClick={() => onChange([...items, { reason: "", amount: "" }])} className="rounded-xl border border-[#D65A9A]/30 bg-white px-3 py-2 text-xs font-bold text-[#C85B95]">+ Add payment</button></div>{items.length > 0 && <div className="mt-3 space-y-2">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_2.5rem]"><input required value={item.reason} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, reason: event.target.value } : entry))} placeholder="Reason" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount" className="form-input" /><button type="button" aria-label={`Remove additional payment ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-10 place-items-center rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div>}</section>;
}

function Status({ status, bookingType }) {
  const styles = { pending: "bg-[#FEF3C7] text-[#92400E]", confirmed: "bg-[#DBEAFE] text-[#1D4ED8]", treatment_done: "bg-[#DCFCE7] text-[#166534]", cancelled: "bg-[#FEE2E2] text-[#991B1B]" };
  const labels = { pending: "Pending", confirmed: bookingType === "walk-in" ? "In treatment" : "Confirmed", treatment_done: "Treatment done", cancelled: "Cancelled" };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status] || "bg-[#F3F4F6] text-[#374151]"}`}>{labels[status] || status}</span>;
}
