import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCreditCard,
  HiOutlineMagnifyingGlass,
  HiOutlineReceiptRefund,
  HiOutlineUserCircle,
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

export default function BookingHistory() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffContext, setStaffContext] = useState(null);

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
    if (!term) return transactions;
    return transactions.filter((transaction) => {
      const text = [
        transaction.id,
        transaction.booking?.id,
        transaction.booking?.status,
        transaction.staff?.full_name,
        transaction.service_provider?.full_name,
        transaction.booking?.customer?.full_name,
        transaction.booking?.service?.name,
        transaction.payment_method,
        transaction.amount,
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [transactions, search]);

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
    <StaffWorkspace title="Transaction Ledger" eyebrow="Payment history" brandOnly headerStats={stats} identity={staffContext}>
      {error && <ErrorNotice message={error} onRetry={loadTransactions} />}

      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transaction, booking number, staff, or payment method"
            className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
          />
        </div>
      </section>

      <section className="mt-5">
        {isLoading ? (
          <CardSkeleton rows={5} />
        ) : filteredTransactions.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="divide-y divide-[#F3E8EF]">
              {filteredTransactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}
            </div>
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
        <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#1F2937]">Receipt #{transaction.id}</p><StatusBadge status={transaction.booking?.status || "completed"} /></div><p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)} · Booking #{transaction.booking?.id}</p><h3 className="mt-3 text-lg font-extrabold text-[#1F2937]">{transaction.booking?.service?.name || "Salon service"}</h3><p className="mt-1 text-sm text-[#6B7280]">Customer: {transaction.booking?.customer?.full_name || "Walk-in customer"}</p></div>
        <div className="grid gap-2 text-sm text-[#6B7280] sm:grid-cols-2 lg:min-w-[25rem]"><p className="inline-flex items-center gap-2"><HiOutlineUserCircle className="h-5 w-5 text-[#D65A9A]" /> Provider: {transaction.service_provider?.full_name || "Staff"}</p><p className="inline-flex items-center gap-2"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p><p>Processed by: {transaction.staff?.full_name || "Staff"}</p><p>Commission ({Number(transaction.commission_rate || 0)}%): {formatCurrency(transaction.commission_amount)}</p></div>
        <p className="text-2xl font-extrabold text-[#1F2937]">{formatCurrency(transaction.amount)}</p>
      </div>
      {(transaction.additional_charge > 0 || transaction.charge_reason) && <div className="mt-4 rounded-xl bg-[#FFF8FB] px-4 py-3 text-sm"><p className="font-bold text-[#C85B95]">Additional charges: {formatCurrency(transaction.additional_charge)}</p><p className="mt-1 text-[#6B7280]">{transaction.charge_reason}</p></div>}
    </article>
  );
}
