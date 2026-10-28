import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from "react-icons/hi2";
import staffTransactionService from "../../services/staffTransactionService";
import {
  CardSkeleton,
  ErrorNotice,
  StaffWorkspace,
} from "./StaffWorkspace";
import {
  formatCurrency,
  formatDateTime,
  getApiError,
  getAppointmentDateKey,
} from "./staffWorkspaceUtils";
import PaymentReceipt from "./PaymentReceipt";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination from "../../components/common/ListPagination";
import SystemPopup from "../../components/common/SystemPopup";
import { getSalonServiceCategory, SALON_SERVICE_CATEGORIES } from "../../constants/salonServices";
import { getEligibleProviders, recommendProvider } from "./providerAssignment";

const BOOKING_PAGE_SIZE = 12;

const getWalkInServiceImage = (service) => {
  if (service.image || service.image_url) return service.image || service.image_url;
  const name = String(service.name || "").toLowerCase();
  const imageRules = [
    [/pico/, "pico-whitening-laser"],
    [/carbon|laser/, "carbon-laser-facial"],
    [/underarm/, "underarm-whitening"],
    [/diamond|peel/, "diamond-peel"],
    [/lash lift|tint/, "lash-lift-tint"],
    [/lash|eyelash/, "classic-eyelash-extension"],
    [/brow/, "brow-care"],
    [/pedicure|foot spa/, "classic-pedicure"],
    [/manicure|nail|gel/, "gel-manicure"],
    [/hair spa|scalp/, "hair-spa-treatment"],
    [/hair|rebond|keratin/, "hair-rebond"],
    [/deep tissue/, "deep-tissue-massage"],
    [/massage|body/, "swedish-body-massage"],
  ];
  const match = imageRules.find(([pattern]) => pattern.test(name));
  return `/images/services/generated/${match?.[1] || "signature-facial"}.jpg`;
};

export default function StaffDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [posServices, setPosServices] = useState([]);
  const [posStaff, setPosStaff] = useState([]);
  const [staffContext, setStaffContext] = useState(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        staffTransactionService.list({ page: 1, page_size: 5 }),
        staffTransactionService.posServices(),
        staffTransactionService.posStaff(),
        staffTransactionService.posContext(),
      ]);
      const [transactionResult, serviceResult, staffResult, contextResult] = results;
      setTransactions(transactionResult.status === "fulfilled" ? transactionResult.value.transactions || [] : []);
      setPosServices(serviceResult.status === "fulfilled" ? serviceResult.value || [] : []);
      setPosStaff(staffResult.status === "fulfilled" ? staffResult.value || [] : []);
      setStaffContext(contextResult.status === "fulfilled" ? contextResult.value : null);

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
  const [bookingConfirmation, setBookingConfirmation] = useState("");
  const [receipt, setReceipt] = useState(null);
  const paymentIdempotencyKeys = useRef(new Map());
  const [serviceSearch, setServiceSearch] = useState("");
  const [walkInSearch, setWalkInSearch] = useState("");
  const [walkInDate, setWalkInDate] = useState("");
  const [walkInStatus, setWalkInStatus] = useState("all");
  const [walkInPage, setWalkInPage] = useState(1);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const selectedWalkInServices = services.filter((service) => bookingForm.service_ids.map(String).includes(String(service.id)));
  const walkInServiceOptions = useMemo(() => services.filter((service) => !serviceSearch.trim() || service.name.toLowerCase().includes(serviceSearch.trim().toLowerCase())), [services, serviceSearch]);
  const walkInServiceGroups = useMemo(() => {
    const grouped = new Map();
    walkInServiceOptions.forEach((service) => {
      const category = service.category || getSalonServiceCategory(service.name);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(service);
    });
    return [...grouped.entries()].sort(([a], [b]) => {
      const first = SALON_SERVICE_CATEGORIES.indexOf(a);
      const second = SALON_SERVICE_CATEGORIES.indexOf(b);
      return (first < 0 ? Number.MAX_SAFE_INTEGER : first) - (second < 0 ? Number.MAX_SAFE_INTEGER : second);
    });
  }, [walkInServiceOptions]);
  const toggleServiceCategory = (categoryServices) => {
    const categoryIds = categoryServices.map((service) => String(service.id));
    setBookingForm((previous) => {
      const selectedIds = previous.service_ids.map(String);
      const categorySelected = categoryIds.length > 0 && categoryIds.every((id) => selectedIds.includes(id));
      const nextIds = categorySelected
        ? selectedIds.filter((id) => !categoryIds.includes(id))
        : [...new Set([...selectedIds, ...categoryIds])];
      const providerIds = { ...previous.service_provider_ids };
      if (categorySelected) {
        categoryIds.forEach((id) => delete providerIds[id]);
      } else {
        const assignedCounts = {};
        Object.values(providerIds).forEach((providerId) => {
          assignedCounts[providerId] = (assignedCounts[providerId] || 0) + 1;
        });
        categoryServices.forEach((service) => {
          if (providerIds[service.id]) return;
          const providerId = recommendProvider(service, staffMembers, assignedCounts);
          if (providerId) {
            providerIds[service.id] = providerId;
            assignedCounts[providerId] = (assignedCounts[providerId] || 0) + 1;
          }
        });
      }
      return { ...previous, service_ids: nextIds, service_id: nextIds[0] || "", service_provider_id: providerIds[nextIds[0]] || "", service_provider_ids: providerIds };
    });
  };
  const paymentBase = paymentBooking?.services?.length ? paymentBooking.services.reduce((sum, service) => sum + Number(service.price || 0), 0) : Number(paymentBooking?.service?.price || 0);
  const paymentExtras = paymentForm.additional_charges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paymentCommission = Number(paymentForm.commission_amount || 0);
  const paymentTotal = paymentBase + paymentExtras + paymentCommission;
  const paymentTendered = Number(paymentForm.amount_tendered || 0);
  const filteredWalkIns = useMemo(() => {
    const term = walkInSearch.trim().toLowerCase();
    return bookings.filter((booking) => {
      const appointmentDate = getAppointmentDateKey(booking.appointment_date);
      const displayStatus = booking.status === "confirmed" ? "in_treatment" : booking.status;
      return (!walkInDate || appointmentDate === walkInDate) && (walkInStatus === "all" || displayStatus === walkInStatus) && (!term || [booking.id, booking.customer?.full_name, booking.service?.name, booking.service_provider?.full_name].filter(Boolean).join(" ").toLowerCase().includes(term));
    });
  }, [bookings, walkInSearch, walkInDate, walkInStatus]);
  const safeWalkInPage = Math.min(walkInPage, Math.max(1, Math.ceil(filteredWalkIns.length / BOOKING_PAGE_SIZE)));
  const visibleWalkIns = useMemo(() => filteredWalkIns.slice((safeWalkInPage - 1) * BOOKING_PAGE_SIZE, safeWalkInPage * BOOKING_PAGE_SIZE), [filteredWalkIns, safeWalkInPage]);

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
      setBookingConfirmation("Walk-in booking saved successfully. It is now listed under active walk-in bookings.");
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

  const cancelBookingRecord = async () => {
    if (!cancelReason.trim()) return setMessage("Please provide a cancellation reason.");
    setBusy(true);
    try { await staffTransactionService.cancelOnlineBooking(cancelBooking.id, cancelReason.trim()); setCancelBooking(null); setCancelReason(""); setMessage("Appointment cancelled successfully."); await onCompleted(); }
    catch (err) { setMessage(getApiError(err, "Unable to cancel appointment. Please try again.")); }
    finally { setBusy(false); }
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
      const paymentKey = paymentIdempotencyKeys.current.get(paymentBooking.id) || crypto.randomUUID();
      paymentIdempotencyKeys.current.set(paymentBooking.id, paymentKey);
      const result = await staffTransactionService.create({
        booking_id: paymentBooking.id,
        idempotency_key: paymentKey,
        service_provider_id: paymentBooking.service_provider?.id,
        payment_method: paymentForm.payment_method,
        amount_tendered: paymentForm.payment_method === "cash" ? paymentTendered : paymentTotal,
        additional_charges: paymentForm.additional_charges.map((item) => ({ reason: item.reason.trim(), amount: Number(item.amount) })),
        commission_amount: paymentCommission,
      });
      setReceipt(result);
      paymentIdempotencyKeys.current.delete(paymentBooking.id);
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
    {cancelBooking && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#172033]/35 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-extrabold text-[#1F2937]">Cancel Appointment?</h2><p className="mt-2 text-sm text-[#6B7280]">Why do you want to cancel this appointment?</p><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Reason for cancellation" className="form-input mt-4" rows={3} /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCancelBooking(null)} className="rounded-xl border px-4 py-2 font-bold">Keep Appointment</button><button type="button" onClick={cancelBookingRecord} disabled={busy || !cancelReason.trim()} className="rounded-xl bg-[#B91C1C] px-4 py-2 font-bold text-white">Cancel Appointment</button></div></section></div>}
    {message && <ErrorNotice message={message} />}
    {bookingConfirmation && <SystemPopup message={bookingConfirmation} tone="success" title="Walk-in booking confirmed" onClose={() => setBookingConfirmation("")} />}

    {showBookingList && <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Walk-in bookings</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Active treatments and payments</h2></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#C85B95]">{bookings.length} active</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_12rem]"><div className="relative"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={walkInSearch} onChange={(event) => setWalkInSearch(event.target.value)} placeholder="Search customer, service, provider, or booking #" className="form-input pl-10" /></div><ModernDatePicker value={walkInDate} onChange={setWalkInDate} placeholder="Filter by walk-in date" ariaLabel="Filter walk-in bookings by date" /><select value={walkInStatus} onChange={(event) => setWalkInStatus(event.target.value)} className="form-input"><option value="all">All statuses</option><option value="in_treatment">In treatment</option><option value="treatment_done">Treatment done</option></select></div>
      {filteredWalkIns.length ? <><div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{visibleWalkIns.map((booking) => { const customerNote = booking.notes?.replace(/^Walk-in booking\.\s*/, "").trim(); return <article key={booking.id} className="rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-[#1F2937]">{booking.customer.full_name}</p><p className="mt-1 text-sm text-[#6B7280]">{booking.service.name}</p><p className="mt-1 text-xs text-[#9CA3AF]">Provider: {booking.service_provider?.full_name || "Not assigned"}</p><p className="mt-1 text-xs text-[#9CA3AF]">{formatDateTime(booking.appointment_date)}</p>{customerNote && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#6B7280]"><strong className="text-[#374151]">Notes:</strong> {customerNote}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${booking.status === "treatment_done" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{booking.status === "treatment_done" ? "Treatment done" : "In treatment"}</span></div><div className="mt-4 flex gap-2">{booking.status === "confirmed" ? <button disabled={busy} onClick={() => markDone(booking.id)} className="min-h-10 flex-1 rounded-xl bg-[#1F2937] px-3 text-xs font-bold text-white">Treatment done</button> : <button disabled={busy} onClick={() => { setPaymentBooking(booking); setPaymentForm(emptyPayment); setReceipt(null); }} className="min-h-10 flex-1 rounded-xl bg-[#C85B95] px-3 text-xs font-bold text-white">Collect payment</button>}{["pending", "confirmed"].includes(booking.status) && <button type="button" disabled={busy} onClick={() => { setCancelBooking(booking); setCancelReason(""); }} className="min-h-10 rounded-xl border border-[#DC2626] px-3 text-xs font-bold text-[#B91C1C] hover:bg-[#FEE2E2]">Cancel</button>}</div></article>; })}</div><ListPagination page={safeWalkInPage} pageSize={BOOKING_PAGE_SIZE} totalItems={filteredWalkIns.length} onPageChange={setWalkInPage} itemLabel="walk-in bookings" /></> : <p className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-6 text-center text-sm text-[#6B7280]">No walk-in bookings match the selected filters.</p>}
    </section>}

    {showForm && <form onSubmit={saveBooking} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">New walk-in</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">Create booking before treatment</h2></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-[#1F2937]">Customer name<input required minLength={2} value={bookingForm.customer_name} onChange={(e) => setBookingForm((p) => ({ ...p, customer_name: e.target.value }))} className="form-input mt-2" /></label><label className="text-sm font-bold text-[#1F2937]">Phone number<input required value={bookingForm.phone_number} onChange={(e) => setBookingForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="09XXXXXXXXX" className="form-input mt-2" /></label></div>
      <div className="mt-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-[#1F2937]">Services <span className="font-normal text-[#6B7280]">(select one or more)</span></p></div><div className="relative w-full sm:max-w-sm"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search service name" aria-label="Search walk-in services" className="form-input !pl-12 !pr-10" />{serviceSearch && <button type="button" onClick={() => setServiceSearch("")} aria-label="Clear service search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#6B7280] hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-4 w-4" /></button>}</div></div><div className="mt-3 max-h-[28rem] space-y-5 overflow-y-auto rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4">{walkInServiceGroups.length ? walkInServiceGroups.map(([category, categoryServices]) => <section key={category}><div className="mb-2 flex items-center justify-between gap-3 px-1 py-1"><h3 className="text-xs font-extrabold uppercase tracking-wide text-[#C85B95]">{category}</h3><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold text-[#A83F78] hover:bg-[#FFF0F7]"><input type="checkbox" checked={categoryServices.length > 0 && categoryServices.every((service) => bookingForm.service_ids.map(String).includes(String(service.id)))} onChange={() => toggleServiceCategory(categoryServices)} aria-label={`${categoryServices.every((service) => bookingForm.service_ids.map(String).includes(String(service.id))) ? "Deselect" : "Select"} all ${category} services`} className="h-4 w-4 accent-[#C85B95]" /><span>{categoryServices.length > 0 && categoryServices.every((service) => bookingForm.service_ids.map(String).includes(String(service.id))) ? "Deselect all" : "Select all"}</span></label></div><div className="grid gap-3 sm:grid-cols-2">{categoryServices.map((service) => { const selected = bookingForm.service_ids.map(String).includes(String(service.id)); return <label key={service.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected ? "border-[#D65A9A] bg-[#FFF0F7]" : "border-[#F3E8EF] bg-white"}`}><img src={getWalkInServiceImage(service)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/services/generated/signature-facial.jpg"; }} className="h-16 w-16 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#1F2937]">{service.name}</span><span className="text-xs text-[#6B7280]">{service.duration_minutes || 0} min | {formatCurrency(service.price)}</span></span><input type="checkbox" checked={selected} onChange={() => setBookingForm((previous) => { const ids = selected ? previous.service_ids.filter((id) => String(id) !== String(service.id)) : [...previous.service_ids, String(service.id)]; const providerIds = { ...previous.service_provider_ids }; if (selected) delete providerIds[service.id]; else if (!providerIds[service.id]) { const assignedCounts = {}; Object.values(providerIds).forEach((providerId) => { assignedCounts[providerId] = (assignedCounts[providerId] || 0) + 1; }); providerIds[service.id] = recommendProvider(service, staffMembers, assignedCounts); } return { ...previous, service_ids: ids, service_id: ids[0] || "", service_provider_id: providerIds[ids[0]] || "", service_provider_ids: providerIds }; })} className="h-5 w-5 shrink-0 accent-[#C85B95]" /></label>; })}</div></section>) : <p className="px-3 py-8 text-center text-sm text-[#6B7280]">No services match "{serviceSearch}".</p>}</div><p className="mt-2 text-xs font-bold text-[#C85B95]">Number of Services: {bookingForm.service_ids.length} {bookingForm.service_ids.length === 1 ? "Service" : "Services"}</p></div>
      {selectedWalkInServices.length > 0 && <div className="mt-4 space-y-3 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><p className="text-sm font-bold text-[#1F2937]">Assign the person for each service</p>{selectedWalkInServices.map((service) => { const recommendedCount = getEligibleProviders(service, staffMembers).length; return <label key={service.id} className="grid gap-2 text-sm font-bold text-[#374151] sm:grid-cols-[1fr_18rem] sm:items-center"><span>{service.name}<span className="mt-1 block text-xs font-medium text-[#9A6380]">All {staffMembers.length} providers are listed{recommendedCount ? ` · ${recommendedCount} role match${recommendedCount === 1 ? "" : "es"}` : ""}</span></span><span><select required value={bookingForm.service_provider_ids[service.id] || ""} onChange={(event) => setBookingForm((previous) => ({ ...previous, service_provider_id: String(service.id) === String(previous.service_id) ? event.target.value : previous.service_provider_id, service_provider_ids: { ...previous.service_provider_ids, [service.id]: event.target.value } }))} className="form-input"><option value="">{staffMembers.length ? "Choose provider" : "No providers available"}</option>{staffMembers.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} | {staff.job_title} | {staff.active_customer_count || 0} {(staff.active_customer_count || 0) === 1 ? "customer" : "customers"}</option>)}</select></span></label>; })}<div className="border-t border-[#F3E8EF] pt-3 text-sm"><p className="flex justify-between"><span>Combined duration</span><strong>{selectedWalkInServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0)} minutes</strong></p><p className="mt-2 flex justify-between"><span>Estimated total</span><strong>{formatCurrency(selectedWalkInServices.reduce((sum, service) => sum + Number(service.price || 0), 0))}</strong></p></div></div>}
      <label className="mt-4 block text-sm font-bold text-[#1F2937]">Notes <span className="font-normal text-[#98A2B3]">(optional)</span><textarea rows={2} maxLength={200} value={bookingForm.notes} onChange={(e) => setBookingForm((p) => ({ ...p, notes: e.target.value }))} className="form-input mt-2 resize-none" /></label>
      <button disabled={busy || !bookingForm.service_ids.length || selectedWalkInServices.some((service) => !bookingForm.service_provider_ids[service.id])} className="mt-5 min-h-12 w-full rounded-xl bg-[#C85B95] px-5 font-bold text-white disabled:opacity-50">{busy ? "Saving..." : "Save walk-in booking"}</button>
    </form>}

    {paymentBooking && <form onSubmit={collectPayment} role="dialog" aria-modal="true" aria-label="Complete booking payment" className="staff-payment-dialog rounded-[1.5rem] border-2 border-[#D65A9A]/30 bg-white p-5 shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Payment</p><h2 className="mt-1 text-lg font-extrabold text-[#1F2937]">{paymentBooking.customer.full_name} | {paymentBooking.service.name}</h2></div><button type="button" onClick={() => setPaymentBooking(null)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">Payment method<select value={paymentForm.payment_method} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))} className="form-input mt-2"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><label className="text-sm font-bold">{paymentForm.payment_method === "cash" ? "Cash received" : "Amount"}<input required type="number" min={paymentTotal} step="0.01" value={paymentForm.payment_method === "cash" ? paymentForm.amount_tendered : paymentTotal} disabled={paymentForm.payment_method !== "cash"} onChange={(e) => setPaymentForm((p) => ({ ...p, amount_tendered: e.target.value }))} className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label></div><AdditionalPaymentFields items={paymentForm.additional_charges} onChange={(additional_charges) => setPaymentForm((p) => ({ ...p, additional_charges, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} /><label className="mt-4 block text-sm font-bold">Staff commission / tip <span className="font-normal text-[#6B7280]">(optional amount paid separately by customer)</span><input type="number" min="0" step="0.01" value={paymentForm.commission_amount} onChange={(e) => setPaymentForm((p) => ({ ...p, commission_amount: e.target.value, amount_tendered: p.payment_method === "cash" ? "" : p.amount_tendered }))} placeholder="0.00" className="form-input mt-2" /></label><div className="mt-4 rounded-xl bg-[#FFF8FB] p-4 text-sm"><p className="flex justify-between"><span>Service</span><strong>{formatCurrency(paymentBase)}</strong></p><p className="mt-2 flex justify-between"><span>Additional payments</span><strong>{formatCurrency(paymentExtras)}</strong></p><p className="mt-2 flex justify-between text-[#C85B95]"><span>Staff commission / tip</span><strong>{formatCurrency(paymentCommission)}</strong></p><p className="mt-3 flex justify-between border-t pt-3 text-base"><span>Customer total</span><strong>{formatCurrency(paymentTotal)}</strong></p><p className="mt-2 flex justify-between"><span>Change</span><strong>{formatCurrency(Math.max(0, paymentTendered - paymentTotal))}</strong></p></div><button disabled={busy} className="mt-5 min-h-12 w-full rounded-xl bg-[#166534] px-5 font-bold text-white disabled:opacity-50">{busy ? "Processing..." : "Complete payment and print receipt"}</button></form>}

    {receipt && <PaymentReceipt receipt={receipt} onClose={() => setReceipt(null)} autoPrint />}
  </div>;
}

function AdditionalPaymentFields({ items, onChange }) {
  return <div className="mt-4 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#1F2937]">Additional payments</p><p className="text-xs text-[#6B7280]">Optional extras left or requested by the customer.</p></div><button type="button" onClick={() => onChange([...items, { reason: "", amount: "" }])} className="rounded-xl border border-[#D65A9A]/30 bg-white px-3 py-2 text-xs font-bold text-[#C85B95]">+ Add payment</button></div>{items.length > 0 && <div className="mt-3 space-y-2">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_2.5rem]"><input required value={item.reason} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, reason: event.target.value } : entry))} placeholder="Reason" className="form-input" /><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => onChange(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount" className="form-input" /><button type="button" aria-label={`Remove additional payment ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-10 place-items-center rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2]"><HiOutlineXMark className="h-5 w-5" /></button></div>)}</div>}</div>;
}
