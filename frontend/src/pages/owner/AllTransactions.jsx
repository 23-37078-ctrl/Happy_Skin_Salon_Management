import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCreditCard, HiOutlineFunnel, HiOutlineMagnifyingGlass, HiOutlinePhone, HiOutlinePrinter, HiOutlineReceiptRefund, HiOutlineUserCircle } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, formatDateTime, getApiError, paymentLabels } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatusBadge } from "./OwnerWorkspace";
import { getTransactionSale, printTransactionReceipt } from "../staff/printTransactionReceipt";
import ListPagination, { PAGE_SIZE } from "../../components/common/ListPagination";
import ModernDatePicker from "../../components/common/ModernDatePicker";

const methods = ["all", "cash", "gcash", "card", "bank_transfer"];

export default function AllTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

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
    return transactions.filter((transaction) => {
      const created = new Date(transaction.created_at);
      const localDate = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      const searchable = [transaction.id, transaction.booking?.id, transaction.booking?.branch?.name, transaction.booking?.customer?.full_name, transaction.booking?.customer?.phone_number, transaction.booking?.service?.name, transaction.staff?.full_name, transaction.service_provider?.full_name, transaction.payment_method].filter(Boolean).join(" ").toLowerCase();
      return (!dateFilter || localDate === dateFilter) && (methodFilter === "all" || transaction.payment_method === methodFilter) && (!term || searchable.includes(term));
    });
  }, [transactions, search, dateFilter, methodFilter]);
  const visibleTransactions = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [search, dateFilter, methodFilter]);

  const total = filtered.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return (
    <OwnerWorkspace title="All Transactions" eyebrow="Centralized sales ledger" headerStats={[{ label: "Total Sales", value: formatCurrency(total), icon: HiOutlineBanknotes, tone: "green" }, { label: "Transactions", value: filtered.length, icon: HiOutlineReceiptRefund, tone: "pink" }, { label: "Average Ticket", value: formatCurrency(filtered.length ? total / filtered.length : 0), icon: HiOutlineCreditCard, tone: "blue" }]}>
      {error && <Notice message={error} onRetry={loadTransactions} />}
      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_15rem_14rem]"><div className="relative">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipt, branch, customer, phone, service, or provider" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none" />
        </div><ModernDatePicker value={dateFilter} onChange={setDateFilter} placeholder="Filter by payment date" ariaLabel="Filter transactions by payment date" /><label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 text-sm font-semibold"><HiOutlineFunnel className="h-5 w-5 text-[#D65A9A]" /><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">{methods.map((method) => <option key={method} value={method}>{method === "all" ? "All payment methods" : paymentLabels[method] || method}</option>)}</select></label></div>
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : filtered.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="hidden grid-cols-[0.8fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] xl:grid">
              <span>Receipt</span><span>Branch / Client</span><span>Service</span><span>Service provider</span><span>Method</span><span>Sale</span><span>Commission</span><span>Receipt</span>
            </div>
            {visibleTransactions.map((transaction) => (
              <article key={transaction.id} className="grid gap-4 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:grid-cols-2 sm:px-5 xl:grid-cols-[0.8fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
                <div><p className="font-bold text-[#1F2937]">Receipt #{transaction.id}</p><p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)}</p></div>
                <div><p className="font-bold text-[#1F2937]">{transaction.booking?.branch?.name || "Branch"}</p><p className="mt-1 text-sm font-semibold text-[#374151]">{transaction.booking?.customer?.full_name || "Customer"}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-[#6B7280]"><HiOutlinePhone className="h-4 w-4 text-[#D65A9A]" /> {transaction.booking?.customer?.phone_number || "Not provided"}</p><p className="mt-1 text-xs text-[#6B7280]">Booking #{transaction.booking?.id}</p><div className="mt-2"><StatusBadge status={transaction.booking?.status || "completed"} /></div></div>
                <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Service</p><p className="mt-1 text-sm font-bold text-[#1F2937]">{transaction.booking?.service?.name || "Salon service"}</p>{Number(transaction.additional_charge || 0) > 0 && <p className="mt-1 text-xs text-[#C85B95]">Add-ons: {formatCurrency(transaction.additional_charge)}{transaction.charge_reason ? ` · ${transaction.charge_reason}` : ""}</p>}</div>
                <div><p className="inline-flex items-center gap-2 text-sm font-semibold text-[#374151]"><HiOutlineUserCircle className="h-5 w-5 text-[#D65A9A]" /> {transaction.service_provider?.full_name || "Not assigned"}</p><p className="mt-1 text-[10px] text-[#9CA3AF]">Encoded by {transaction.staff?.full_name || "Staff"}</p></div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p>
                <p className="text-lg font-extrabold text-[#166534]">{formatCurrency(getTransactionSale(transaction))}</p>
                <p className="text-lg font-extrabold text-[#C85B95]">{formatCurrency(transaction.commission_amount)}</p>
                <button type="button" onClick={() => printTransactionReceipt(transaction)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#F3E8EF] bg-white px-3 text-xs font-bold text-[#713B5A]"><HiOutlinePrinter className="h-4 w-4" /> Print</button>
              </article>
            ))}
            <div className="border-t border-[#F3E8EF] px-4 pb-5 lg:col-span-full"><ListPagination page={page} totalItems={filtered.length} onPageChange={setPage} itemLabel="transactions" /></div>
          </div>
        ) : <EmptyState title="No transactions found" description="Completed service payments from every branch will appear here." />}
      </section>
    </OwnerWorkspace>
  );
}
