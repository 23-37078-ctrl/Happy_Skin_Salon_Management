import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiOutlinePhone,
  HiOutlineMagnifyingGlass,
} from "react-icons/hi2";
import staffBookingService from "../../services/staffBookingService";
import staffTransactionService from "../../services/staffTransactionService";
import {
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  StaffWorkspace,
  StatCard,
  StatusBadge,
} from "./StaffWorkspace";
import {
  formatCurrency,
  formatDateTime,
  getApiError,
} from "./staffWorkspaceUtils";

export default function StaffDashboard() {
  const [bookings, setBookings] = useState([]);
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
        staffBookingService.list({ page: 1, page_size: 8 }),
        staffTransactionService.list({ page: 1, page_size: 5 }),
        staffTransactionService.posServices(),
        staffTransactionService.posStaff(),
        staffTransactionService.posContext(),
      ]);
      const [bookingResult, transactionResult, serviceResult, staffResult, contextResult] = results;
      setBookings(bookingResult.status === "fulfilled" ? bookingResult.value.bookings || [] : []);
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
    const todayBookings = bookings.filter((booking) => new Date(booking.appointment_date).toDateString() === today);
    const openBookings = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status));
    const todayRevenue = transactions
      .filter((transaction) => new Date(transaction.created_at).toDateString() === today)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return [
      { label: "Today's Appointments", value: todayBookings.length, icon: HiOutlineCalendarDays, tone: "pink" },
      { label: "Open Queue", value: openBookings.length, icon: HiOutlineClock, tone: "amber" },
      { label: "Completed", value: bookings.filter((booking) => booking.status === "completed").length, icon: HiOutlineCheckCircle, tone: "green" },
      { label: "Today Revenue", value: formatCurrency(todayRevenue), icon: HiOutlineBanknotes, tone: "blue" },
    ];
  }, [bookings, transactions]);

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "cancelled" && booking.status !== "completed").slice(0, 5),
    [bookings]
  );

  return (
    <StaffWorkspace
      title="Staff Dashboard"
      eyebrow="Branch operations"
      brandOnly
      headerStats={stats}
      identity={staffContext}
    >
      {error && <ErrorNotice message={error} onRetry={loadDashboard} />}

      {isLoading ? <CardSkeleton rows={4} /> : <WalkInPOS services={posServices} staffMembers={posStaff} onCompleted={loadDashboard} />}
    </StaffWorkspace>
  );
}

function WalkInPOS({ services, staffMembers, onCompleted }) {
  const emptyForm = { customer_name: "", phone_number: "", service_id: "", service_provider_id: "", payment_method: "cash", amount_tendered: "", additional_charge: "0", charge_reason: "", commission_rate: "10", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const selectedService = services.find((service) => String(service.id) === String(form.service_id));
  const visibleServices = services.filter((service) => service.name.toLowerCase().includes(serviceQuery.trim().toLowerCase()));
  const basePrice = Number(selectedService?.price || 0);
  const additionalCharge = Number(form.additional_charge || 0);
  const total = basePrice + additionalCharge;
  const commissionAmount = basePrice * Number(form.commission_rate || 0) / 100;
  const tendered = Number(form.amount_tendered || 0);
  const expectedChange = form.payment_method === "cash" ? Math.max(0, tendered - total) : 0;

  const checkout = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!selectedService) return setMessage("Please select a service.");
    if (form.payment_method === "cash" && tendered < total) return setMessage("Cash received must cover the total amount.");
    setBusy(true);
    try {
      const result = await staffTransactionService.checkoutWalkIn({ ...form, service_id: Number(form.service_id), amount_tendered: form.payment_method === "cash" ? tendered : total });
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
          {message && <p className="mb-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{message}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#1F2937]">Customer name<input required minLength={2} value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))} placeholder="Walk-in customer name" className="form-input mt-2" /></label>
            <label className="text-sm font-bold text-[#1F2937]">Phone number <span className="font-normal text-[#98A2B3]">(optional)</span><div className="relative mt-2"><HiOutlinePhone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={form.phone_number} onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="09XXXXXXXXX" className="form-input pl-10" /></div></label>
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
                    <button key={service.id} type="button" onClick={() => setForm((previous) => ({ ...previous, service_id: service.id, amount_tendered: previous.payment_method === "cash" ? "" : String(Number(service.price) + Number(previous.additional_charge || 0)) }))} className={`group overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 ${selected ? "border-[#D65A9A] ring-2 ring-[#D65A9A]/20" : "border-[#F3E8EF]"}`}>
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
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-[#1F2937]">Additional charge<input type="number" min="0" step="0.01" value={form.additional_charge} onChange={(event) => setForm((previous) => ({ ...previous, additional_charge: event.target.value, amount_tendered: previous.payment_method === "cash" ? "" : String(basePrice + Number(event.target.value || 0)) }))} className="form-input mt-2" /></label>
            <label className="text-sm font-bold text-[#1F2937]">Charge reason<input value={form.charge_reason} onChange={(event) => setForm((previous) => ({ ...previous, charge_reason: event.target.value }))} disabled={additionalCharge <= 0} required={additionalCharge > 0} placeholder="e.g. Long hair" className="form-input mt-2 disabled:bg-[#F4F4F5]" /></label>
            <label className="text-sm font-bold text-[#1F2937]">Commission rate (%)<input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={(event) => setForm((previous) => ({ ...previous, commission_rate: event.target.value }))} className="form-input mt-2" /></label>
          </div>
          <label className="mt-4 block text-sm font-bold text-[#1F2937]">Notes <span className="font-normal text-[#98A2B3]">(optional)</span><textarea rows={3} maxLength={200} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="form-input mt-2 resize-none" placeholder="Service preferences or staff notes" /></label>
          <button disabled={busy || !selectedService || !form.service_provider_id} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white shadow-lg transition hover:bg-[#B94B86] disabled:opacity-50"><HiOutlineBanknotes className="h-5 w-5" />{busy ? "Processing..." : "Complete Walk-in Sale"}</button>
        </form>
        <aside className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <h3 className="font-bold text-[#1F2937]">Order Summary</h3>
          {selectedService ? <><div className="mt-4 flex gap-3">{selectedService.image && <img src={selectedService.image} alt="" className="h-20 w-24 rounded-xl object-cover" />}<div><p className="font-bold text-[#1F2937]">{selectedService.name}</p><p className="mt-1 text-xs text-[#6B7280]">{selectedService.duration_minutes || 0} minutes</p></div></div><div className="mt-5 space-y-3 border-t border-[#F3E8EF] pt-4 text-sm"><p className="flex justify-between"><span>Service price</span><strong>{formatCurrency(basePrice)}</strong></p><p className="flex justify-between"><span>Additional charge</span><strong>{formatCurrency(additionalCharge)}</strong></p><p className="flex justify-between border-t border-[#F3E8EF] pt-3 text-base"><span>Total</span><strong>{formatCurrency(total)}</strong></p><p className="flex justify-between"><span>Provider commission ({Number(form.commission_rate || 0)}%)</span><strong className="text-[#C85B95]">{formatCurrency(commissionAmount)}</strong></p><p className="flex justify-between"><span>Change</span><strong className="text-[#166534]">{formatCurrency(expectedChange)}</strong></p></div></> : <p className="mt-6 text-sm text-[#6B7280]">Select a service to view the total.</p>}
          {receipt && <div className="mt-5 rounded-xl bg-[#ECFDF3] p-4 text-sm text-[#166534]"><p className="font-bold">Payment successful</p><p className="mt-1">Receipt #{receipt.transaction_id} · {receipt.customer_name}</p><p className="mt-1">Provider: {receipt.service_provider}</p><p className="mt-1">Commission: {formatCurrency(receipt.commission_amount)}</p><p className="mt-1">Change: {formatCurrency(receipt.change)}</p></div>}
        </aside>
      </div>
    </section>
  );
}

function BookingPreview({ booking }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1F2937]">{booking.service?.name || "Service"}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || "Customer"} • {formatDateTime(booking.appointment_date)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#6B7280]">
        <span className="inline-flex items-center gap-1"><HiOutlineUserGroup className="h-4 w-4 text-[#D65A9A]" /> {booking.branch?.name || "Branch"}</span>
        <span className="inline-flex items-center gap-1"><HiOutlineSparkles className="h-4 w-4 text-[#D65A9A]" /> {formatCurrency(booking.service?.price)}</span>
      </div>
    </article>
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
