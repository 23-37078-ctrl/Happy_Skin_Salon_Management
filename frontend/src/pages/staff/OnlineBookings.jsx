import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace } from "./StaffWorkspace";
import { WalkInPOS } from "./StaffDashboard";
import { formatCurrency, formatDateTime, getApiError } from "./staffWorkspaceUtils";
import PaymentReceipt from "./PaymentReceipt";
import ListPagination from "../../components/common/ListPagination";
import ModernDatePicker from "../../components/common/ModernDatePicker";

const emptyPayment = { payment_method: "cash", amount_tendered: "", commission_amount: "", additional_charges: [] };
const BOOKING_PAGE_SIZE = 12;

export default function OnlineBookings() {
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
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
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingData, providerData, serviceData, walkInData] = await Promise.all([
        staffTransactionService.onlineBookings(),
        staffTransactionService.posStaff(),
        staffTransactionService.posServices(),
        staffTransactionService.walkInBookings(),
      ]);
      setBookings(bookingData || []);
      setProviders(providerData || []);
      setServices(serviceData || []);
      setWalkInBookings(walkInData || []);
      setAssignments((current) => Object.fromEntries((bookingData || []).map((item) => [item.id, current[item.id] || item.service_provider?.id || ""])));
    } catch (err) {
      setError(getApiError(err, "Bookings could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const appointment = new Date(booking.appointment_date);
      const localDate = `${appointment.getFullYear()}-${String(appointment.getMonth() + 1).padStart(2, "0")}-${String(appointment.getDate()).padStart(2, "0")}`;
      return (!dateFilter || localDate === dateFilter) && (statusFilter === "all" || booking.status === statusFilter) && (!term || [booking.id, booking.customer?.full_name, booking.service?.name, booking.service_provider?.full_name].filter(Boolean).join(" ").toLowerCase().includes(term));
    });
  }, [bookings, search, statusFilter, dateFilter]);
  const visibleBookings = useMemo(() => filteredBookings.slice((page - 1) * BOOKING_PAGE_SIZE, page * BOOKING_PAGE_SIZE), [filteredBookings, page]);
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFilter]);

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
      const result = await staffTransactionService.create({
        booking_id: paymentBooking.id,
        service_provider_id: paymentBooking.service_provider?.id,
        payment_method: payment.payment_method,
        amount_tendered: payment.payment_method === "cash" ? tendered : total,
        additional_charges: payment.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) })),
        commission_amount: commission,
      });
      setReceipt(result);
      setPaymentBooking(null);
      setPayment(emptyPayment);
      await load();
    } catch (err) {
      setError(getApiError(err, "Payment could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  return <StaffWorkspace title="Bookings" eyebrow="All branch reservations">
    {error && <ErrorNotice message={error} onRetry={load} />}

    <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Online reservations</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Confirm, complete treatment, and collect payment</h2></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#C85B95]">{bookings.length} active</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_12rem]"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, service, provider, or booking #" className="form-input" /><ModernDatePicker value={dateFilter} onChange={setDateFilter} placeholder="Filter by appointment date" ariaLabel="Filter bookings by appointment date" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="form-input"><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="treatment_done">Treatment done</option></select></div>
      {loading ? <p className="mt-5 text-sm text-[#6B7280]">Loading bookings…</p> : filteredBookings.length ? <><div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{visibleBookings.map((booking) => <article key={booking.id} className="rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-[#1F2937]">{booking.customer.full_name}</p><p className="mt-1 text-sm text-[#6B7280]">{booking.service.name}</p><p className="mt-1 text-xs text-[#9CA3AF]">{formatDateTime(booking.appointment_date)}</p>{booking.notes && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#6B7280]"><strong className="text-[#374151]">Notes:</strong> {booking.notes}</p>}</div><Status status={booking.status} /></div>{booking.status === "pending" && <label className="mt-4 block text-xs font-bold text-[#374151]">Person who will do the service<select value={assignments[booking.id] || ""} onChange={(event) => setAssignments((current) => ({ ...current, [booking.id]: event.target.value }))} className="form-input mt-1"><option value="">Choose provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.full_name} — {provider.active_customer_count || 0} {(provider.active_customer_count || 0) === 1 ? "customer" : "customers"} currently accommodated</option>)}</select></label>}<div className="mt-4">{booking.status === "pending" ? <button disabled={busy || !assignments[booking.id]} onClick={() => runAction(() => staffTransactionService.confirmOnlineBooking(booking.id, assignments[booking.id]))} className="min-h-10 w-full rounded-xl bg-[#C85B95] px-3 text-xs font-bold text-white disabled:opacity-40">Confirm booking</button> : booking.status === "confirmed" ? <button disabled={busy} onClick={() => runAction(() => staffTransactionService.markOnlineTreatmentDone(booking.id))} className="min-h-10 w-full rounded-xl bg-[#1F2937] px-3 text-xs font-bold text-white">Treatment done</button> : <button disabled={busy} onClick={() => { setPaymentBooking(booking); setPayment(emptyPayment); setReceipt(null); }} className="min-h-10 w-full rounded-xl bg-[#166534] px-3 text-xs font-bold text-white">Collect payment</button>}</div></article>)}</div><ListPagination page={page} pageSize={BOOKING_PAGE_SIZE} totalItems={filteredBookings.length} onPageChange={setPage} itemLabel="bookings" /></> : <p className="mt-5 rounded-xl bg-[#FFF8FB] px-4 py-8 text-center text-sm text-[#6B7280]">No bookings match the selected filters.</p>}
    </section>

    {paymentBooking && <form onSubmit={submitPayment} className="mt-5 rounded-[1.5rem] border-2 border-[#D65A9A]/30 bg-white p-5 shadow-lg"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-[#D65A9A]">Payment</p><h2 className="mt-1 text-lg font-extrabold">{paymentBooking.customer.full_name} · {paymentBooking.service.name}</h2></div><button type="button" onClick={() => setPaymentBooking(null)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Payment method<select value={payment.payment_method} onChange={(e) => setPayment((p) => ({ ...p, payment_method: e.target.value }))} className="form-input mt-2"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><label className="text-sm font-bold">{payment.payment_method === "cash" ? "Cash received" : "Amount"}<input required type="number" min={total} step="0.01" value={payment.payment_method === "cash" ? payment.amount_tendered : total} disabled={payment.payment_method !== "cash"} onChange={(e) => setPayment((p) => ({ ...p, amount_tendered: e.target.value }))} className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label></div><OnlineAdditionalPayments items={payment.additional_charges} onChange={(additional_charges) => setPayment((current) => ({ ...current, additional_charges, amount_tendered: current.payment_method === "cash" ? "" : current.amount_tendered }))} /><label className="mt-4 block text-sm font-bold">Staff commission / tip <span className="font-normal text-[#6B7280]">(optional amount paid separately by customer)</span><input type="number" min="0" step="0.01" value={payment.commission_amount} onChange={(e) => setPayment((p) => ({ ...p, commission_amount: e.target.value, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} placeholder="0.00" className="form-input mt-2" /></label><div className="mt-4 rounded-xl bg-[#FFF8FB] p-4 text-sm"><p className="flex justify-between"><span>Service</span><strong>{formatCurrency(basePrice)}</strong></p><p className="mt-2 flex justify-between"><span>Additional payments</span><strong>{formatCurrency(additionalTotal)}</strong></p><p className="mt-2 flex justify-between text-[#C85B95]"><span>Staff commission / tip</span><strong>{formatCurrency(commission)}</strong></p><p className="mt-3 flex justify-between border-t pt-3 text-base"><span>Customer total</span><strong>{formatCurrency(total)}</strong></p><p className="mt-2 flex justify-between"><span>Change</span><strong>{formatCurrency(Math.max(0, tendered - total))}</strong></p></div><button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-[#166534] font-bold text-white disabled:opacity-40">{busy ? "Processing…" : "Complete payment"}</button></form>}

    {receipt && <PaymentReceipt receipt={receipt} onClose={() => setReceipt(null)} />}

    <div className="mt-5">
      <WalkInPOS services={services} staffMembers={providers} bookings={walkInBookings} onCompleted={load} showForm={false} />
    </div>
  </StaffWorkspace>;
}

function OnlineAdditionalPayments({ items, onChange }) {
  return <section className="mt-4 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-[#1F2937]">Additional payments</h3><p className="mt-1 text-xs text-[#6B7280]">Optional extras paid by the customer.</p></div><button type="button" onClick={() => onChange([...items, { reason: "", amount: "" }])} className="rounded-xl border border-[#D65A9A]/30 bg-white px-3 py-2 text-xs font-bold text-[#C85B95]">+ Add payment</button></div>{items.length > 0 && <div className="mt-3 space-y-2">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_2.5rem]"><input required value={item.reason} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, reason: event.target.value } : entry))} placeholder="Reason" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount" className="form-input" /><button type="button" aria-label={`Remove additional payment ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-10 place-items-center rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div>}</section>;
}

function Status({ status }) {
  const styles = { pending: "bg-[#FEF3C7] text-[#92400E]", confirmed: "bg-[#DBEAFE] text-[#1D4ED8]", treatment_done: "bg-[#DCFCE7] text-[#166534]" };
  const labels = { pending: "Pending", confirmed: "Confirmed", treatment_done: "Treatment done" };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}>{labels[status]}</span>;
}
