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
  StatCard,
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

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await staffTransactionService.list({ page: 1, page_size: 100 });
      setTransactions(payload.transactions || []);
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
        transaction.payment_method,
        transaction.amount,
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [transactions, search]);

  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const today = new Date().toDateString();
    const todayCount = filteredTransactions.filter((transaction) => new Date(transaction.created_at).toDateString() === today).length;
    return [
      { label: "Total Collected", value: formatCurrency(totalRevenue), icon: HiOutlineBanknotes, tone: "green" },
      { label: "Payments", value: filteredTransactions.length, icon: HiOutlineReceiptRefund, tone: "pink" },
      { label: "Today", value: todayCount, icon: HiOutlineCalendarDays, tone: "amber" },
    ];
  }, [filteredTransactions]);

  return (
    <StaffWorkspace title="Transaction Ledger" eyebrow="Payment history">
      {error && <ErrorNotice message={error} onRetry={loadTransactions} />}

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
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
            <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] lg:grid">
              <span>Transaction</span>
              <span>Booking</span>
              <span>Staff</span>
              <span>Method</span>
              <span className="text-right">Amount</span>
            </div>
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
    <article className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-center lg:px-5">
      <div>
        <p className="text-sm font-bold text-[#1F2937]">Receipt #{transaction.id}</p>
        <p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)}</p>
      </div>
      <div>
        <p className="text-sm font-bold text-[#1F2937]">Booking #{transaction.booking?.id}</p>
        <div className="mt-1"><StatusBadge status={transaction.booking?.status || "completed"} /></div>
      </div>
      <p className="inline-flex items-center gap-2 text-sm text-[#6B7280]"><HiOutlineUserCircle className="h-5 w-5 text-[#D65A9A]" /> {transaction.staff?.full_name || "Staff"}</p>
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p>
      <p className="text-left text-lg font-bold text-[#1F2937] lg:text-right">{formatCurrency(transaction.amount)}</p>
    </article>
  );
}
