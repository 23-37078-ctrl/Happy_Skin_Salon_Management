import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlinePhone,
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlineXMark,
  HiOutlinePrinter,
  HiOutlineChartBar,
} from "react-icons/hi2";
import staffTransactionService from "../../services/staffTransactionService";
import {
  CardSkeleton,
  ErrorNotice,
  StaffWorkspace,
  StatCard,
} from "./StaffWorkspace";
import {
  formatCurrency,
  formatDateTime,
  getApiError,
} from "./staffWorkspaceUtils";
import PaymentReceipt from "./PaymentReceipt";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination from "../../components/common/ListPagination";

const BOOKING_PAGE_SIZE = 12;

export default function StaffDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [posServices, setPosServices] = useState([]);
  const [posStaff, setPosStaff] = useState([]);
  const [staffContext, setStaffContext] = useState(null);
  const [walkInBookings, setWalkInBookings] = useState([]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        staffTransactionService.list({ page: 1, page_size: 5 }),
        staffTransactionService.posServices(),
        staffTransactionService.posStaff(),
        staffTransactionService.posContext(),
        staffTransactionService.walkInBookings(),
      ]);
      const [transactionResult, serviceResult, staffResult, contextResult, walkInResult] = results;
      setTransactions(transactionResult.status === "fulfilled" ? transactionResult.value.transactions || [] : []);
      setPosServices(serviceResult.status === "fulfilled" ? serviceResult.value || [] : []);
      setPosStaff(staffResult.status === "fulfilled" ? staffResult.value || [] : []);
      setStaffContext(contextResult.status === "fulfilled" ? contextResult.value : null);
      setWalkInBookings(walkInResult.status === "fulfilled" ? walkInResult.value || [] : []);

      const posFailure = [serviceResult, staffResult].find((result) => result.status === "rejected");
      if (posFailure) setError(getApiError(posFailure.reason, "We couldn't load this branch's POS catalog."));
    } catch (err) {
      setError(getApiError(err, "We couldn't load the staff dashboard."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadDashboard());
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayRevenue = transactions
      .filter((transaction) => new Date(transaction.created_at).toDateString() === today)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return [
      { label: "Today Revenue", value: formatCurrency(todayRevenue), icon: HiOutlineBanknotes, tone: "blue" },
    ];
  }, [transactions]);

  return (
    <StaffWorkspace
      title="Staff Dashboard"
      eyebrow="Branch operations"
      brandOnly
      headerStats={stats}
      identity={staffContext}
      actions={<Link to="/staff/day-end" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#14532D]"><HiOutlineChartBar className="h-5 w-5" /> Day End Summary</Link>}
    >
      {error && <ErrorNotice message={error} onRetry={loadDashboard} />}

      {isLoading ? <CardSkeleton rows={4} /> : <>
        <WalkInPOS services={posServices} staffMembers={posStaff} bookings={[]} onCompleted={loadDashboard} showBookingList={false} />
      </>}
    </StaffWorkspace>
  );
}

export function WalkInPOS({ services, staffMembers, bookings, onCompleted, showBookingList = true, showForm = true }) {
  const emptyBooking = { customer_name: "", phone_number: "", service_id: "", service_ids: [], service_provider_id: "", service_provider_ids: {}, notes: "" };
  const emptyPayment = { payment_method: "cash", amount_tendered: "", additional_charges: [], commission_amount: "" };
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [walkInSearch, setWalkInSearch] = useState("");
  const [walkInDate, setWalkInDate] = useState("");
  const [walkInStatus, setWalkInStatus] = useState("all");
  const [walkInPage, setWalkInPage] = useState(1);
  const selectedService = services.find((service) => String(service.id) === String(bookingForm.service_id));
  const selectedWalkInServices = services.filter((service) => bookingForm.service_ids.map(String).includes(String(service.id)));
  const walkInServiceOptions = services.filter((service) => !serviceSearch.trim() || service.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()));
  const paymentBase = paymentBooking?.services?.length ? paymentBooking.services.reduce((sum, service) => sum + Number(service.price || 0), 0) : Number(paymentBooking?.service?.price || 0);
  const paymentExtras = paymentForm.additional_charges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paymentCommission = Number(paymentForm.commission_amount || 0);
  const paymentTotal = paymentBase + paymentExtras + paymentCommission;
  const paymentTendered = Number(paymentForm.amount_tendered || 0);
  const filteredWalkIns = useMemo(() => {
    const term = walkInSearch.trim().toLowerCase();
    return bookings.filter((booking) => {
      const appointment = new Date(booking.appointment_date);
      const localDate = `${appointment.getFullYear()}-${String(appointment.getMonth() + 1).padStart(2, "0")}-${String(appointment.getDate()).padStart(2, "0")}`;
      const displayStatus = booking.status === "confirmed" ? "in_treatment" : booking.status;
      return (!walkInDate || localDate === walkInDate) && (walkInStatus === "all" || displayStatus === walkInStatus) && (!term || [booking.id, booking.customer?.full_name, booking.service?.name, booking.service_provider?.full_name].filter(Boolean).join(" ").toLowerCase().includes(term));
    });
  }, [bookings, walkInSearch, walkInDate, walkInStatus]);
  const visibleWalkIns = useMemo(() => filteredWalkIns.slice((walkInPage - 1) * BOOKING_PAGE_SIZE, walkInPage * BOOKING_PAGE_SIZE), [filteredWalkIns, walkInPage]);
  useEffect(() => { setWalkInPage(1); }, [walkInSearch, walkInDate, walkInStatus]);

  const saveBooking = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await staffTransactionService.createWalkInBooking({
        ...bookingForm,
        service_id: Number(bookingForm.service_id),
        service_provider_id: Number(bookingForm.service_provider_id),
        service_ids: bookingForm.service_ids.map(Number),
        service_provider_ids: Object.fromEntries(Object.entries(bookingForm.service_provider_ids).map(([serviceId, providerId]) => [Number(serviceId), Number(providerId)])),
      });
      setBookingForm(emptyBooking);
      setMessage("Walk-in saved. It is now listed under active walk-in bookings.");
      await onCompleted();
    } catch (err) {
      setMessage(getApiError(err, "The walk-in booking could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (bookingId) => {
    setBusy(true);
    setMessage("");
    try {
      await staffTransactionService.markTreatmentDone(bookingId);
      await onCompleted();
    } catch (err) {
      setMessage(getApiError(err, "The treatment status could not be updated."));
    } finally {
      setBusy(false);
    }
  };

  const collectPayment = async (event) => {
    event.preventDefault();
    if (!paymentBooking) return;
    if (paymentForm.payment_method === "cash" && paymentTendered < paymentTotal) {
      setMessage("Cash received must cover the total amount.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await staffTransactionService.create({
        booking_id: paymentBooking.id,
        service_provider_id: paymentBooking.service_provider?.id,
        payment_method: paymentForm.payment_method,
        amount_tendered: paymentForm.payment_method === "cash" ? paymentTendered : paymentTotal,
        additional_charges: paymentForm.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) })),
        commission_amount: paymentCommission,
      });
      setReceipt(result);
      setPaymentBooking(null);
      setPaymentForm(emptyPayment);
      await onCompleted();
    } catch (err) {
      setMessage(getApiError(err, "Payment could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-5">
    {message && <ErrorNotice message={message} tone={message.startsWith("Walk-in saved") ? "success" : "error"} />}

    {showBookingList && <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Walk-in bookings</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Active treatments and payments</h2></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#C85B95]">{bookings.length} active</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_12rem]"><div className="relative"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={walkInSearch} onChange={(event) => setWalkInSearch(event.target.value)} placeholder="Search customer, service, provider, or booking #" className="form-input pl-10" /></div><ModernDatePicker value={walkInDate} onChange={setWalkInDate} placeholder="Filter by walk-in date" ariaLabel="Filter walk-in bookings by date" /><select value={walkInStatus} onChange={(event) => setWalkInStatus(event.target.value)} className="form-input"><option value="all">All statuses</option><option value="in_treatment">In treatment</option><option value="treatment_done">Treatment done</option></select></div>
      {filteredWalkIns.length ? <><div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{visibleWalkIns.map((booking) => { const customerNote = booking.notes?.replace(/^Walk-in booking\.\s*/, "").trim(); return <article key={booking.id} className="rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-[#1F2937]">{booking.customer.full_name}</p><p className="mt-1 text-sm text-[#6B7280]">{booking.service.name}</p><p className="mt-1 text-xs text-[#9CA3AF]">Provider: {booking.service_provider?.full_name || "Not assigned"}</p><p className="mt-1 text-xs text-[#9CA3AF]">{formatDateTime(booking.appointment_date)}</p>{customerNote && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#6B7280]"><strong className="text-[#374151]">Notes:</strong> {customerNote}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${booking.status === "treatment_done" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{booking.status === "treatment_done" ? "Treatment done" : "In treatment"}</span></div><div className="mt-4 flex gap-2">{booking.status === "confirmed" ? <button disabled={busy} onClick={() => markDone(booking.id)} className="min-h-10 flex-1 rounded-xl bg-[#1F2937] px-3 text-xs font-bold text-white">Treatment done</button> : <button disabled={busy} onClick={() => { setPaymentBooking(booking); setPaymentForm(emptyPayment); setReceipt(null); }} className="min-h-10 flex-1 rounded-xl bg-[#C85B95] px-3 text-xs font-bold text-white">Collect payment</button>}</div></article>; })}</div><ListPagination page={walkInPage} pageSize={BOOKING_PAGE_SIZE} totalItems={filteredWalkIns.length} onPageChange={setWalkInPage} itemLabel="walk-in bookings" /></> : <p className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-6 text-center text-sm text-[#6B7280]">No walk-in bookings match the selected filters.</p>}
    </section>}

    {showForm && <form onSubmit={saveBooking} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">New walk-in</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Create booking before treatment</h2></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-[#1F2937]">Customer name<input required minLength={2} value={bookingForm.customer_name} onChange={(e) => setBookingForm((p) => ({ ...p, customer_name: e.target.value }))} className="form-input mt-2" /></label><label className="text-sm font-bold text-[#1F2937]">Phone number<input required value={bookingForm.phone_number} onChange={(e) => setBookingForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="09XXXXXXXXX" className="form-input mt-2" /></label></div>
      <div className="mt-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><p className="text-sm font-bold text-[#1F2937]">Services <span className="font-normal text-[#6B7280]">(select one or more)</span></p><div className="relative w-full sm:max-w-sm"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search service name" aria-label="Search walk-in services" className="form-input pl-10 pr-10" />{serviceSearch && <button type="button" onClick={() => setServiceSearch("")} aria-label="Clear service search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#6B7280] hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-4 w-4" /></button>}</div></div><div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-3 sm:grid-cols-2">{walkInServiceOptions.length ? walkInServiceOptions.map((service) => { const selected = bookingForm.service_ids.map(String).includes(String(service.id)); return <label key={service.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${selected ? "border-[#D65A9A] bg-[#FFF0F7]" : "border-[#F3E8EF] bg-white"}`}><span><span className="block text-sm font-bold text-[#1F2937]">{service.name}</span><span className="text-xs text-[#6B7280]">{service.duration_minutes || 0} min · {formatCurrency(service.price)}</span></span><input type="checkbox" checked={selected} onChange={() => setBookingForm((previous) => { const ids = selected ? previous.service_ids.filter((id) => String(id) !== String(service.id)) : [...previous.service_ids, String(service.id)]; const providerIds = { ...previous.service_provider_ids }; if (selected) delete providerIds[service.id]; return { ...previous, service_ids: ids, service_id: ids[0] || "", service_provider_id: providerIds[ids[0]] || "", service_provider_ids: providerIds }; })} className="h-5 w-5 accent-[#C85B95]" /></label>; }) : <p className="col-span-full px-3 py-8 text-center text-sm text-[#6B7280]">No services match “{serviceSearch}”.</p>}</div>{bookingForm.service_ids.length > 0 && <p className="mt-2 text-xs font-bold text-[#C85B95]">{bookingForm.service_ids.length} service{bookingForm.service_ids.length === 1 ? "" : "s"} selected</p>}</div>
      {selectedWalkInServices.length > 0 && <div className="mt-4 space-y-3 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><p className="text-sm font-bold text-[#1F2937]">Assign the person for each service</p>{selectedWalkInServices.map((service) => <label key={service.id} className="grid gap-2 text-sm font-bold text-[#374151] sm:grid-cols-[1fr_18rem] sm:items-center"><span>{service.name}</span><select required value={bookingForm.service_provider_ids[service.id] || ""} onChange={(event) => setBookingForm((previous) => ({ ...previous, service_provider_id: String(service.id) === String(previous.service_id) ? event.target.value : previous.service_provider_id, service_provider_ids: { ...previous.service_provider_ids, [service.id]: event.target.value } }))} className="form-input"><option value="">Choose provider</option>{staffMembers.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} — {staff.active_customer_count || 0} {(staff.active_customer_count || 0) === 1 ? "customer" : "customers"}</option>)}</select></label>)}<div className="border-t border-[#F3E8EF] pt-3 text-sm"><p className="flex justify-between"><span>Combined duration</span><strong>{selectedWalkInServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0)} minutes</strong></p><p className="mt-2 flex justify-between"><span>Estimated total</span><strong>{formatCurrency(selectedWalkInServices.reduce((sum, service) => sum + Number(service.price || 0), 0))}</strong></p></div></div>}
      <label className="mt-4 block text-sm font-bold text-[#1F2937]">Notes <span className="font-normal text-[#98A2B3]">(optional)</span><textarea rows={2} maxLength={200} value={bookingForm.notes} onChange={(e) => setBookingForm((p) => ({ ...p, notes: e.target.value }))} className="form-input mt-2 resize-none" /></label>
      <button disabled={busy || !bookingForm.service_ids.length || selectedWalkInServices.some((service) => !bookingForm.service_provider_ids[service.id])} className="mt-5 min-h-12 w-full rounded-xl bg-[#C85B95] px-5 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save walk-in booking"}</button>
    </form>}

    {paymentBooking && <form onSubmit={collectPayment} className="rounded-[1.5rem] border-2 border-[#D65A9A]/30 bg-white p-5 shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Payment</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">{paymentBooking.customer.full_name} · {paymentBooking.service.name}</h2></div><button type="button" onClick={() => setPaymentBooking(null)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Payment method<select value={paymentForm.payment_method} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))} className="form-input mt-2"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><label className="text-sm font-bold">{paymentForm.payment_method === "cash" ? "Cash received" : "Amount"}<input required type="number" min={paymentTotal} step="0.01" value={paymentForm.payment_method === "cash" ? paymentForm.amount_tendered : paymentTotal} disabled={paymentForm.payment_method !== "cash"} onChange={(e) => setPaymentForm((p) => ({ ...p, amount_tendered: e.target.value }))} className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label></div><AdditionalPaymentFields items={paymentForm.additional_charges} onChange={(additional_charges) => setPaymentForm((p) => ({ ...p, additional_charges, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} /><label className="mt-4 block text-sm font-bold">Staff commission / tip <span className="font-normal text-[#6B7280]">(optional amount paid separately by customer)</span><input type="number" min="0" step="0.01" value={paymentForm.commission_amount} onChange={(e) => setPaymentForm((p) => ({ ...p, commission_amount: e.target.value, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} placeholder="0.00" className="form-input mt-2" /></label><div className="mt-4 rounded-xl bg-[#FFF8FB] p-4 text-sm"><p className="flex justify-between"><span>Service</span><strong>{formatCurrency(paymentBase)}</strong></p><p className="mt-2 flex justify-between"><span>Additional payments</span><strong>{formatCurrency(paymentExtras)}</strong></p><p className="mt-2 flex justify-between text-[#C85B95]"><span>Staff commission / tip</span><strong>{formatCurrency(paymentCommission)}</strong></p><p className="mt-3 flex justify-between border-t pt-3 text-base"><span>Customer total</span><strong>{formatCurrency(paymentTotal)}</strong></p><p className="mt-2 flex justify-between"><span>Change</span><strong>{formatCurrency(Math.max(0, paymentTendered - paymentTotal))}</strong></p></div><button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-[#166534] px-5 font-bold text-white disabled:opacity-50">{busy ? "Processing…" : "Complete payment and print receipt"}</button></form>}

    {receipt && <PaymentReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
  </div>;
}

function AdditionalPaymentFields({ items, onChange }) {
  return <div className="mt-4 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#1F2937]">Additional payments</p><p className="text-xs text-[#6B7280]">Optional extras left or requested by the customer.</p></div><button type="button" onClick={() => onChange([...items, { reason: "", amount: "" }])} className="rounded-xl border border-[#D65A9A]/30 bg-white px-3 py-2 text-xs font-bold text-[#C85B95]">+ Add payment</button></div>{items.length > 0 && <div className="mt-3 space-y-2">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_2.5rem]"><input required value={item.reason} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, reason: event.target.value } : entry))} placeholder="Reason" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount" className="form-input" /><button type="button" aria-label={`Remove additional payment ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-10 place-items-center rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div>}</div>;
}

function LegacyWalkInPOS({ services, staffMembers, onCompleted }) {
  const emptyForm = { customer_name: "", phone_number: "", service_id: "", service_provider_id: "", payment_method: "cash", amount_tendered: "", additional_charges: [], commission_rate: "10", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const selectedService = services.find((service) => String(service.id) === String(form.service_id));
  const visibleServices = services.filter((service) => service.name.toLowerCase().includes(serviceQuery.trim().toLowerCase()));
  const basePrice = Number(selectedService?.price || 0);
  const additionalCharge = form.additional_charges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const commissionAmount = basePrice * Number(form.commission_rate || 0) / 100;
  const subtotal = basePrice + additionalCharge;
  // Commission is tracked as an internal salon expense and is never charged to the customer.
  const total = subtotal;
  const tendered = Number(form.amount_tendered || 0);
  const expectedChange = form.payment_method === "cash" ? Math.max(0, tendered - total) : 0;

  const checkout = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!selectedService) return setMessage("Please select a service.");
    const invalidCharge = form.additional_charges.some((item) => Number(item.amount || 0) <= 0 || !item.reason.trim());
    if (invalidCharge) return setMessage("Every additional charge needs a reason and an amount greater than zero.");
    if (form.payment_method === "cash" && tendered < total) return setMessage("Cash received must cover the total amount.");
    setBusy(true);
    try {
      const result = await staffTransactionService.checkoutWalkIn({ ...form, service_id: Number(form.service_id), additional_charges: form.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) })), amount_tendered: form.payment_method === "cash" ? tendered : total });
      setReceipt(result);
      setForm(emptyForm);
      await onCompleted();
    } catch (err) {
      setMessage(getApiError(err, "Walk-in checkout could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <form onSubmit={checkout} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          {message && <ErrorNotice message={message} />}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#1F2937]">Customer name<input required minLength={2} value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))} placeholder="Walk-in customer name" className="form-input mt-2" /></label>
            <label className="text-sm font-bold text-[#1F2937]">Phone number <span className="font-normal text-[#98A2B3]">(optional)</span><div className="relative mt-2"><HiOutlinePhone className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={form.phone_number} onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="09XXXXXXXXX" className="form-input !pl-12" /></div></label>
          </div>
          <label className="mt-4 block text-sm font-bold text-[#1F2937]">Service provider<select required value={form.service_provider_id} onChange={(event) => setForm((previous) => ({ ...previous, service_provider_id: event.target.value }))} className="form-input mt-2"><option value="">Choose who will perform the service</option>{staffMembers.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} — {staff.job_title}</option>)}</select></label>
          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-[#1F2937]">Click a service to add it to the sale</legend>
            <label className="relative mt-3 block">
              <span className="sr-only">Search services</span>
              <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
              <input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search services by name" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] py-3 pl-11 pr-4 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-4 focus:ring-[#D65A9A]/10" />
            </label>
            {services.length ? (
              <div className="mt-3 grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                {visibleServices.map((service) => {
                  const selected = String(form.service_id) === String(service.id);
                  return (
                    <button key={service.id} type="button" onClick={() => setForm((previous) => { const extras = previous.additional_charges.reduce((sum, item) => sum + Number(item.amount || 0), 0); return { ...previous, service_id: service.id, amount_tendered: previous.payment_method === "cash" ? "" : String(Number(service.price) + extras) }; })} className={`group overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 ${selected ? "border-[#D65A9A] ring-2 ring-[#D65A9A]/20" : "border-[#F3E8EF]"}`}>
                      <div className="relative h-24 overflow-hidden bg-[#FFF0F7] sm:h-28"><img src={service.image || "/images/services/generated/signature-facial.jpg"} alt={service.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />{selected && <span className="absolute right-2 top-2 rounded-full bg-[#C85B95] px-2 py-1 text-[9px] font-bold text-white">Added</span>}</div>
                      <div className="p-3"><p className="line-clamp-2 text-xs font-bold leading-4 text-[#1F2937] sm:text-sm">{service.name}</p><div className="mt-2 flex items-end justify-between gap-2"><span className="text-[10px] text-[#6B7280]">{service.duration_minutes || 0} min</span><span className="text-xs font-extrabold text-[#C85B95]">{formatCurrency(service.price)}</span></div></div>
                    </button>
                  );
                })}
              </div>
            ) : <p className="mt-3 rounded-xl bg-[#FFF8FB] px-4 py-6 text-center text-sm text-[#6B7280]">No services are assigned to this branch.</p>}
            {services.length > 0 && visibleServices.length === 0 && <p className="mt-3 rounded-xl bg-[#FFF8FB] px-4 py-6 text-center text-sm text-[#6B7280]">No services match “{serviceQuery}”.</p>}
          </fieldset>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#1F2937]">Payment method<select value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value, amount_tendered: e.target.value === "cash" ? p.amount_tendered : String(total) }))} className="form-input mt-2"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label>
            <label className="text-sm font-bold text-[#1F2937]">{form.payment_method === "cash" ? "Cash received" : "Amount"}<input required type="number" min={total || 0} step="0.01" value={form.payment_method === "cash" ? form.amount_tendered : total || ""} disabled={form.payment_method !== "cash"} onChange={(e) => setForm((p) => ({ ...p, amount_tendered: e.target.value }))} className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label>
          </div>
          <div className="mt-4 rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#1F2937]">Additional charges</p><p className="mt-0.5 text-xs text-[#6B7280]">Add each design, material, or upgrade separately.</p></div><button type="button" onClick={() => setForm((previous) => ({ ...previous, additional_charges: [...previous.additional_charges, { reason: "", amount: "" }] }))} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#D65A9A]/25 bg-white px-3 py-2 text-xs font-bold text-[#C85B95] hover:bg-[#FFF0F7]"><HiOutlinePlus className="h-4 w-4" /> Add charge</button></div>
            {form.additional_charges.length > 0 && <div className="mt-3 space-y-3">{form.additional_charges.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_10rem_2.5rem]"><input required value={item.reason} onChange={(event) => setForm((previous) => ({ ...previous, additional_charges: previous.additional_charges.map((charge, chargeIndex) => chargeIndex === index ? { ...charge, reason: event.target.value } : charge) }))} placeholder="Reason/design (required)" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setForm((previous) => ({ ...previous, additional_charges: previous.additional_charges.map((charge, chargeIndex) => chargeIndex === index ? { ...charge, amount: event.target.value } : charge), amount_tendered: previous.payment_method === "cash" ? "" : previous.amount_tendered }))} placeholder="Amount" className="form-input" /><button type="button" onClick={() => setForm((previous) => ({ ...previous, additional_charges: previous.additional_charges.filter((_, chargeIndex) => chargeIndex !== index), amount_tendered: previous.payment_method === "cash" ? "" : previous.amount_tendered }))} aria-label={`Remove additional charge ${index + 1}`} className="grid h-11 w-10 place-items-center rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div>}
          </div>
          <label className="mt-4 block text-sm font-bold text-[#1F2937]">Commission rate (%) <span className="font-normal text-[#6B7280]">(internal only)</span><input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={(event) => setForm((previous) => ({ ...previous, commission_rate: event.target.value, amount_tendered: previous.payment_method === "cash" ? "" : String(basePrice + additionalCharge) }))} className="form-input mt-2" /></label>
          <label className="mt-4 block text-sm font-bold text-[#1F2937]">Notes <span className="font-normal text-[#98A2B3]">(optional)</span><textarea rows={3} maxLength={200} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="form-input mt-2 resize-none" placeholder="Service preferences or staff notes" /></label>
          <button disabled={busy || !selectedService || !form.service_provider_id} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white shadow-lg transition hover:bg-[#B94B86] disabled:opacity-50"><HiOutlineBanknotes className="h-5 w-5" />{busy ? "Processing..." : "Complete Walk-in Sale"}</button>
        </form>
        <aside className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <h3 className="font-bold text-[#1F2937]">Order Summary</h3>
          {selectedService ? <><div className="mt-4 flex gap-3">{selectedService.image && <img src={selectedService.image} alt="" className="h-20 w-24 rounded-xl object-cover" />}<div><p className="font-bold text-[#1F2937]">{selectedService.name}</p><p className="mt-1 text-xs text-[#6B7280]">{selectedService.duration_minutes || 0} minutes</p></div></div><div className="mt-5 space-y-3 border-t border-[#F3E8EF] pt-4 text-sm"><p className="flex justify-between"><span>Service price</span><strong>{formatCurrency(basePrice)}</strong></p>{form.additional_charges.map((item, index) => <p key={index} className="flex justify-between gap-3"><span className="truncate">{item.reason || `Additional charge ${index + 1}`}</span><strong>{formatCurrency(Number(item.amount || 0))}</strong></p>)}<p className="flex justify-between"><span>Total add-ons</span><strong>{formatCurrency(additionalCharge)}</strong></p><p className="flex justify-between text-[#6B7280]"><span>Provider commission ({Number(form.commission_rate || 0)}%, not charged)</span><strong className="text-[#C85B95]">{formatCurrency(commissionAmount)}</strong></p><p className="flex justify-between border-t border-[#F3E8EF] pt-3 text-base"><span>Customer amount due</span><strong>{formatCurrency(total)}</strong></p><p className="flex justify-between"><span>Change</span><strong className="text-[#166534]">{formatCurrency(expectedChange)}</strong></p></div></> : <p className="mt-6 text-sm text-[#6B7280]">Select a service to view the total.</p>}
          {receipt && <div className="mt-5 rounded-xl bg-[#ECFDF3] p-4 text-sm text-[#166534]"><p className="font-bold">Payment successful</p><p className="mt-1">Receipt #{receipt.transaction_id} · {receipt.customer_name}</p><p className="mt-1">Provider: {receipt.service_provider}</p><p className="mt-1">Service: {formatCurrency(receipt.base_price)}</p>{(receipt.additional_charges || []).map((item, index) => <p key={index} className="mt-1">{item.reason}: {formatCurrency(item.amount)}</p>)}<p className="mt-1">Commission: {formatCurrency(receipt.commission_amount)}</p><p className="mt-1 font-bold">Total paid: {formatCurrency(receipt.total)}</p><p className="mt-1">Change: {formatCurrency(receipt.change)}</p><button type="button" onClick={() => window.print()} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 font-bold text-[#166534] shadow-sm"><HiOutlinePrinter className="h-5 w-5" /> Print Receipt</button></div>}
        </aside>
      </div>
    </section>
  );
}

function TransactionPreview({ transaction }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#1F2937]">{formatCurrency(transaction.amount)}</p>
          <p className="mt-1 text-sm text-[#6B7280]">Booking #{transaction.booking?.id} • {transaction.payment_method?.replace("_", " ")}</p>
        </div>
        <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#166534]">Paid</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)}</p>
    </article>
  );
}
