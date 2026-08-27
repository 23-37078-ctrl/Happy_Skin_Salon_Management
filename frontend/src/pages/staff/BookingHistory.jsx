import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCreditCard,
  HiOutlineMagnifyingGlass,
  HiOutlinePhone,
  HiOutlineReceiptRefund,
  HiOutlinePrinter,
  HiOutlineUserCircle,
  HiOutlineChartBar,
} from "react-icons/hi2";
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
import { getTransactionSale, printTransactionReceipt } from "./printTransactionReceipt";
import ListPagination, { PAGE_SIZE } from "../../components/common/ListPagination";
import ModernDatePicker from "../../components/common/ModernDatePicker";

export default function BookingHistory() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffContext, setStaffContext] = useState(null);
  const [page, setPage] = useState(1);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [payload, contextData] = await Promise.all([staffTransactionService.list({ page: 1, page_size: 100 }), staffTransactionService.posContext()]);
      setTransactions(payload.transactions || []);
      setStaffContext(contextData);
    } catch (err) {
      setError(getApiError(err, "We couldn't load branch transactions."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const created = new Date(transaction.created_at);
      const localDate = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      if (dateFilter && localDate !== dateFilter) return false;
      if (methodFilter !== "all" && transaction.payment_method !== methodFilter) return false;
      const source = transaction.booking?.notes?.startsWith("Walk-in") ? "walk_in" : "online";
      if (sourceFilter !== "all" && source !== sourceFilter) return false;
      if (!term) return true;
      const text = [
        transaction.id,
        transaction.booking?.id,
        transaction.booking?.status,
        transaction.staff?.full_name,
        transaction.service_provider?.full_name,
        transaction.booking?.customer?.full_name,
        transaction.booking?.customer?.phone_number,
        transaction.booking?.service?.name,
        transaction.payment_method,
        transaction.amount,
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [transactions, search, dateFilter, methodFilter, sourceFilter]);
  const visibleTransactions = useMemo(() => filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredTransactions, page]);
  useEffect(() => { setPage(1); }, [search, dateFilter, methodFilter, sourceFilter]);

  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const today = new Date().toDateString();
    const todayTransactions = filteredTransactions.filter((transaction) => new Date(transaction.created_at).toDateString() === today);
    const todayCount = todayTransactions.length;
    const todayCollected = todayTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    return [
      { label: "Total Collected", value: formatCurrency(totalRevenue), icon: HiOutlineBanknotes, tone: "green" },
      { label: "Payments", value: filteredTransactions.length, icon: HiOutlineReceiptRefund, tone: "pink" },
      { label: "Today", value: todayCount, icon: HiOutlineCalendarDays, tone: "amber" },
      { label: "Today Collected", value: formatCurrency(todayCollected), icon: HiOutlineCreditCard, tone: "blue" },
    ];
  }, [filteredTransactions]);

  return (
    <StaffWorkspace title="Transaction Ledger" eyebrow="Payment history" brandOnly headerStats={stats} identity={staffContext} actions={<Link to="/staff/day-end" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#14532D]"><HiOutlineChartBar className="h-5 w-5" /> Day End Summary</Link>}>
      {error && <ErrorNotice message={error} onRetry={loadTransactions} />}

      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_14rem_13rem]">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transaction, booking number, staff, or payment method"
            className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
          />
        </div><ModernDatePicker value={dateFilter} onChange={setDateFilter} placeholder="Filter by payment date" ariaLabel="Filter transactions by payment date" /><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="form-input"><option value="all">All payment methods</option><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="form-input"><option value="all">All booking types</option><option value="online">Online reservation</option><option value="walk_in">Walk-in</option></select></div>
      </section>

      <section className="mt-5">
        {isLoading ? (
          <CardSkeleton rows={5} />
        ) : filteredTransactions.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="divide-y divide-[#F3E8EF]">
              {visibleTransactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}
            </div>
            <div className="border-t border-[#F3E8EF] px-4 pb-5"><ListPagination page={page} totalItems={filteredTransactions.length} onPageChange={setPage} itemLabel="transactions" /></div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineBanknotes} title="No transactions found" description="Payments recorded by staff will appear in this ledger for quick branch reconciliation." />
        )}
      </section>
    </StaffWorkspace>
  );
}

function TransactionRow({ transaction }) {
  return (
    <article className="px-4 py-5 lg:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#1F2937]">Receipt #{transaction.id}</p><StatusBadge status={transaction.booking?.status || "completed"} /><span className="rounded-full bg-[#FFF0F7] px-2.5 py-1 text-[10px] font-bold text-[#C85B95]">{transaction.booking?.notes?.startsWith("Walk-in") ? "Walk-in" : "Online reservation"}</span></div><p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)} · Booking #{transaction.booking?.id}</p><h3 className="mt-3 text-lg font-extrabold text-[#1F2937]">{transaction.booking?.service?.name || "Salon service"}</h3><p className="mt-1 text-sm text-[#6B7280]">Customer: {transaction.booking?.customer?.full_name || "Walk-in customer"}</p></div>
        <div className="grid gap-2 text-sm text-[#6B7280] sm:grid-cols-2 lg:min-w-[25rem]"><p className="inline-flex items-center gap-2"><HiOutlineUserCircle className="h-5 w-5 text-[#D65A9A]" /> Provider: {transaction.service_provider?.full_name || "Staff"}</p><p className="inline-flex items-center gap-2"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p><p className="inline-flex items-center gap-2"><HiOutlinePhone className="h-5 w-5 text-[#D65A9A]" /> Customer phone: {transaction.booking?.customer?.phone_number || "Not provided"}</p><p>Processed by: {transaction.staff?.full_name || "Staff"}</p></div>
        <div className="min-w-[13rem] rounded-xl bg-[#FFF8FB] p-3"><p className="flex justify-between gap-4 text-sm"><span>Sale</span><strong className="text-[#166534]">{formatCurrency(getTransactionSale(transaction))}</strong></p><p className="mt-2 flex justify-between gap-4 text-sm"><span>Commission / tip</span><strong className="text-[#C85B95]">{formatCurrency(transaction.commission_amount)}</strong></p><p className="mt-2 flex justify-between gap-4 border-t border-[#F3E8EF] pt-2"><span className="font-bold">Total paid</span><strong>{formatCurrency(transaction.amount)}</strong></p><button type="button" onClick={() => printTransactionReceipt(transaction)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-[#713B5A] shadow-sm"><HiOutlinePrinter className="h-5 w-5" /> Print receipt</button></div>
      </div>
      {(transaction.additional_charge > 0 || transaction.charge_reason) && <div className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-3 text-sm"><p className="font-bold text-[#C85B95]">Additional charges: {formatCurrency(transaction.additional_charge)}</p><p className="mt-1 text-[#6B7280]">{transaction.charge_reason}</p></div>}
    </article>
  );
}
