import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCreditCard, HiOutlineMagnifyingGlass, HiOutlineReceiptRefund, HiOutlineUserCircle } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, formatDateTime, getApiError, paymentLabels } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard, StatusBadge } from "./OwnerWorkspace";

export default function AllTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.transactions();
      setTransactions(payload.transactions || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load centralized transactions."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) => [transaction.id, transaction.booking?.id, transaction.booking?.branch?.name, transaction.booking?.customer?.full_name, transaction.staff?.full_name, transaction.payment_method].join(" ").toLowerCase().includes(term));
  }, [transactions, search]);

  const total = filtered.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return (
    <OwnerWorkspace title="All Transactions" eyebrow="Centralized sales ledger">
      {error && <Notice message={error} onRetry={loadTransactions} />}
      <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3">
        <StatCard label="Total Sales" value={formatCurrency(total)} icon={HiOutlineBanknotes} tone="green" />
        <StatCard label="Transactions" value={filtered.length} icon={HiOutlineReceiptRefund} tone="pink" />
        <StatCard label="Average Ticket" value={formatCurrency(filtered.length ? total / filtered.length : 0)} icon={HiOutlineCreditCard} tone="blue" />
      </section>
      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipt, branch, customer, staff, or payment method" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none" />
        </div>
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : filtered.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] lg:grid">
              <span>Receipt</span><span>Branch / Booking</span><span>Staff</span><span>Method</span><span className="text-right">Amount</span>
            </div>
            {filtered.map((transaction) => (
              <article key={transaction.id} className="grid gap-4 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-center">
                <div><p className="font-bold text-[#1F2937]">Receipt #{transaction.id}</p><p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)}</p></div>
                <div><p className="font-bold text-[#1F2937]">{transaction.booking?.branch?.name || "Branch"}</p><p className="mt-1 text-sm text-[#6B7280]">Booking #{transaction.booking?.id} - {transaction.booking?.customer?.full_name || "Customer"}</p><div className="mt-2"><StatusBadge status={transaction.booking?.status || "completed"} /></div></div>
                <p className="inline-flex items-center gap-2 text-sm text-[#6B7280]"><HiOutlineUserCircle className="h-5 w-5 text-[#D65A9A]" /> {transaction.staff?.full_name || "Staff"}</p>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p>
                <p className="text-lg font-bold text-[#166534] lg:text-right">{formatCurrency(transaction.amount)}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No transactions found" description="Completed service payments from every branch will appear here." />}
      </section>
    </OwnerWorkspace>
  );
}
