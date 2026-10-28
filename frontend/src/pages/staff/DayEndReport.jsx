import { useCallback, useEffect, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineCreditCard, HiOutlineLockClosed, HiOutlinePhone, HiOutlinePrinter, HiOutlineUserCircle, HiOutlineChevronDown, HiOutlineXMark } from "react-icons/hi2";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace } from "./StaffWorkspace";
import { formatCurrency, formatDateTime, getApiError, paymentLabels } from "./staffWorkspaceUtils";
import SystemPopup from "../../components/common/SystemPopup";
import { getTransactionSale, printTransactionReceipt } from "./printTransactionReceipt";

const today = () => {
  const value = new Date();
  if (value.getHours() < 8 || (value.getHours() === 8 && value.getMinutes() < 30)) value.setDate(value.getDate() - 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function DayEndReport() {
  const [reportDate, setReportDate] = useState(today);
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [summaries, setSummaries] = useState({});
  const [loadingDates, setLoadingDates] = useState({});
  const [reportErrors, setReportErrors] = useState({});
  const [error, setError] = useState("");
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    staffTransactionService.dayEndDates()
      .then((result) => { if (active) setAvailableDates(result.dates || []); })
      .catch(() => { if (active) setAvailableDates([today()]); })
      .finally(() => { if (active) setDatesLoading(false); });
    return () => { active = false; };
  }, []);

  const loadDateReport = useCallback(async (day, force = false) => {
    if (!force && summaries[day]) return summaries[day];
    setLoadingDates((current) => ({ ...current, [day]: true }));
    setReportErrors((current) => ({ ...current, [day]: "" }));
    try {
      const result = await staffTransactionService.dayEndSummary(day);
      setSummaries((current) => ({ ...current, [day]: result }));
      return result;
    } catch (err) {
      const message = ["ECONNABORTED", "ETIMEDOUT"].includes(err?.code)
        ? "The report is taking too long to load. Check the server connection and try again."
        : getApiError(err, "The day-end report could not be loaded.");
      setReportErrors((current) => ({ ...current, [day]: message }));
      return null;
    } finally {
      setLoadingDates((current) => ({ ...current, [day]: false }));
    }
  }, [summaries]);

  const closeDay = async () => {
    setClosing(true); setError("");
    try { await staffTransactionService.closeDay(reportDate); setShowCloseConfirmation(false); setSuccess("Business day closed successfully. This was confirmed as the branch's final transaction summary for today."); await loadDateReport(reportDate, true); }
    catch (err) { setShowCloseConfirmation(false); setError(getApiError(err, "The business day could not be closed.")); }
    finally { setClosing(false); }
  };

  const toggleBusinessDate = (day) => {
    setReportDate(day);
    setShowTransactions(true);
    if (!summaries[day]) loadDateReport(day);
  };

  const summary = summaries[reportDate];
  const loading = Boolean(loadingDates[reportDate]);

  return <StaffWorkspace title="Reports" eyebrow="Daily branch reconciliation">
    {error && <ErrorNotice message={error} onRetry={() => { setError(""); loadDateReport(reportDate, true); }} />}
    {success && <SystemPopup tone="success" message={success} onClose={() => setSuccess("")} />}
    <p className="mb-5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1E40AF]">A business day runs from 8:30 AM until the 5:00 AM cutoff the following calendar day. Transactions after midnight and before 5:00 AM remain part of the previous business day. If staff forget to close the day, it closes automatically at 5:00 AM and payments reopen at 8:30 AM.</p>
    <section className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#1F2937]">Business dates</p><p className="mt-1 text-xs text-[#6B7280]">Select a date to expand its report below.</p></div>
      <button type="button" disabled={!summary || loading || summary.is_closed || reportDate !== today()} onClick={() => setShowCloseConfirmation(true)} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-5 font-bold text-white disabled:opacity-40">{summary?.is_closed ? <><HiOutlineCheckCircle className="h-5 w-5" /> Day Closed</> : <><HiOutlineLockClosed className="h-5 w-5" /> Close Day</>}</button>
    </section>
    <section className="space-y-3">
      {datesLoading ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#6B7280]">Loading business dates…</p> : availableDates.map((day) => {
        return <button key={day} type="button" onClick={() => toggleBusinessDate(day)} className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[1.25rem] border border-[#F3E8EF] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#D65A9A]/40 hover:bg-[#FFF8FB]">
          <span><strong className="block text-sm text-[#1F2937]">{new Date(`${day}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" })}</strong><span className="mt-1 block text-xs text-[#6B7280]">Click to view this date’s report</span></span>
          <HiOutlineChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#C85B95]" />
        </button>;
      })}
      {!datesLoading && !availableDates.length && <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#6B7280]">No business dates are available yet.</p>}
    </section>
    {showTransactions && <DayReportPopup reportDate={reportDate} summary={summary} loading={loading} error={reportErrors[reportDate]} onRetry={() => loadDateReport(reportDate, true)} onClose={() => setShowTransactions(false)} />}
    {showCloseConfirmation && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#172033]/45 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-[1.75rem] bg-white p-6 text-center shadow-2xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FEE2E2] text-[#B91C1C]"><HiOutlineLockClosed className="h-7 w-7" /></span><h2 className="mt-4 text-xl font-extrabold text-[#1F2937]">Confirm last transaction</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">Confirm that all transactions for this business day are complete. After closing, staff cannot record another payment until the next 8:30 AM opening. If nobody closes it manually, the system will close it automatically at 5:00 AM.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={closing} onClick={() => setShowCloseConfirmation(false)} className="min-h-11 rounded-xl border border-[#E8B7D0] font-bold text-[#C85B95]">Cancel</button><button type="button" disabled={closing} onClick={closeDay} className="min-h-11 rounded-xl bg-[#B91C1C] font-bold text-white disabled:opacity-50">{closing ? "Closing…" : "Yes, close day"}</button></div></section></div>}
  </StaffWorkspace>;
}

export function DayReportPopup({ reportDate, summary, loading, error, onRetry, onClose }) {
  const titleDate = new Date(`${summary?.report_date || reportDate}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" });
  return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[#172033]/50 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="day-report-popup-title" className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#F3E8EF] bg-white px-5 py-4 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Daily branch reconciliation</p><h2 id="day-report-popup-title" className="mt-1 text-lg font-extrabold text-[#1F2937]">{titleDate}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close day-end report" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#713B5A] hover:bg-[#FCE7F3]"><HiOutlineXMark className="h-6 w-6" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {loading ? <div className="grid min-h-64 place-items-center"><p className="text-sm font-semibold text-[#6B7280]">Loading this date’s report…</p></div> : error ? <div className="grid min-h-64 place-items-center"><div className="text-center"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={onRetry} className="mt-3 font-bold text-[#C85B95] underline">Retry</button></div></div> : summary ? <DaySummaryDetails summary={summary} /> : <p className="p-10 text-center text-sm text-[#6B7280]">No report data is available for this date.</p>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-[#F3E8EF] bg-white px-5 py-3"><button type="button" onClick={onClose} className="min-h-10 rounded-xl bg-[#C85B95] px-5 text-sm font-bold text-white">Close</button></footer>
    </section>
  </div>;
}

function DaySummaryDetails({ summary }) {
  const dateLabel = new Date(`${summary.report_date}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" });
  const transactions = summary.transactions || [];
  const staffWithCommission = (summary.staff_performance || []).filter((staff) => Number(staff.commission || 0) > 0);
  const hasCommission = transactions.some((transaction) => Number(transaction.commission_amount || 0) > 0);
  return <article className="day-end-print overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white">
    <div className="p-4 text-sm text-[#374151] sm:p-5">
      <div className="grid gap-3 border-b border-dashed border-[#D1D5DB] pb-4 sm:grid-cols-3"><Info label="Business day" value={`${dateLabel}, 8:30 AM – next day, 5:00 AM`} /><Info label={summary.is_closed ? "Closed by" : "Prepared by"} value={summary.is_closed ? `${summary.closed_by} · ${formatDateTime(summary.closed_at)}` : summary.prepared_by} /><Info label="Generated" value={formatDateTime(summary.generated_at)} /></div>
      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${Number(summary.commission_tips || 0) > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}><Metric label="Salon sales" value={formatCurrency(summary.salon_sales)} />{Number(summary.commission_tips || 0) > 0 && <Metric label="Commission / tips" value={formatCurrency(summary.commission_tips)} pink />}<Metric label="Total collected" value={formatCurrency(summary.total_collected)} /><Metric label="Completed services" value={summary.transaction_count} /></div>
      <section className="mt-5 grid gap-4 md:grid-cols-2"><ReportBlock title="Booking source"><ReportRow label="Online reservations" value={summary.online_count} /><ReportRow label="Walk-ins" value={summary.walk_in_count} /><ReportRow label="Total transactions" value={summary.transaction_count} bold /></ReportBlock><ReportBlock title="Payment methods">{Object.entries(summary.payment_methods || {}).map(([method, amount]) => <ReportRow key={method} label={method.replace("_", " ")} value={formatCurrency(amount)} />)}<ReportRow label="Total collected" value={formatCurrency(summary.total_collected)} bold /></ReportBlock></section>
      {staffWithCommission.length > 0 && <section className="mt-5"><h3 className="font-extrabold text-[#1F2937]">Staff services and commission</h3><div className="mt-3 overflow-hidden rounded-xl border border-[#F3E8EF]"><div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-[#FFF8FB] px-3 py-2 text-[10px] font-bold uppercase text-[#6B7280] sm:px-4 sm:text-xs"><span>Provider</span><span>Services</span><span>Commission / tip</span></div>{staffWithCommission.map((staff) => <div key={staff.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[#F3E8EF] px-3 py-2 text-xs sm:px-4 sm:text-sm"><strong className="break-words">{staff.name}</strong><span>{staff.services}</span><strong className="whitespace-nowrap text-[#C85B95]">{formatCurrency(staff.commission)}</strong></div>)}</div></section>}
      <section className="mt-5"><h3 className="font-extrabold text-[#1F2937]">Transactions</h3>{transactions.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-[#F3E8EF]"><div className={`hidden ${hasCommission ? "min-w-[64rem] grid-cols-[1fr_1fr_1.1fr_1.1fr_0.8fr_0.7fr_0.8fr_auto]" : "min-w-[58rem] grid-cols-[1fr_1fr_1.1fr_1.1fr_0.8fr_0.8fr_auto]"} gap-3 border-b border-[#F3E8EF] bg-[#FFF8FB] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#6B7280] xl:grid`}><span>Date</span><span>Client</span><span>Service</span><span>Service provider</span><span>Method</span><span>Sale</span>{hasCommission && <span>Commission</span>}<span className="text-right">Print</span></div><div className={`divide-y divide-[#F3E8EF] ${hasCommission ? "min-w-[64rem]" : "min-w-[58rem]"}`}>{transactions.map((transaction) => <PopupTransactionRow key={transaction.id} transaction={transaction} showCommission={hasCommission} />)}</div></div> : <p className="mt-3 rounded-xl bg-[#FFF8FB] p-5 text-center text-sm text-[#6B7280]">No transactions were recorded for this date.</p>}</section>
      <p className="mt-5 border-t border-dashed border-[#D1D5DB] pt-4 text-center text-xs text-[#6B7280]">End of report · {summary.branch_name}</p>
    </div>
  </article>;
}

function PopupTransactionRow({ transaction, showCommission }) {
  const provider = transaction.service_provider?.full_name || "Not assigned";
  const commission = Number(transaction.commission_amount || 0);
  return <article className={`grid gap-3 px-4 py-4 sm:grid-cols-2 ${showCommission ? "xl:grid-cols-[1fr_1fr_1.1fr_1.1fr_0.8fr_0.7fr_0.8fr_auto]" : "xl:grid-cols-[1fr_1fr_1.1fr_1.1fr_0.8fr_0.8fr_auto]"} xl:items-center xl:gap-3 xl:px-4`}>
    <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Date</p><p className="mt-1 text-sm font-bold text-[#1F2937]">{formatDateTime(transaction.created_at)}</p><span className="mt-2 inline-flex rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold capitalize text-[#166534]">{transaction.booking?.status || "completed"}</span></div>
    <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Client</p><p className="mt-1 text-sm font-bold text-[#1F2937]">{transaction.booking?.customer?.full_name || "Walk-in client"}</p><p className="mt-1 inline-flex items-center gap-1 text-xs text-[#6B7280]"><HiOutlinePhone className="h-4 w-4 text-[#D65A9A]" /> {transaction.booking?.customer?.phone_number || "Not provided"}</p><p className="mt-1 text-xs text-[#6B7280]">Booking #{transaction.booking?.id}</p></div>
    <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Service</p><p className="mt-1 text-sm font-bold text-[#1F2937]">{transaction.booking?.service?.name || "Salon service"}</p>{Number(transaction.additional_charge || 0) > 0 && <p className="mt-1 text-xs text-[#C85B95]">Add-ons: {formatCurrency(transaction.additional_charge)}</p>}</div>
    <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Service provider</p><p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-[#374151]"><HiOutlineUserCircle className="h-5 w-5 shrink-0 text-[#D65A9A]" /> {provider}</p><p className="mt-1 text-[10px] text-[#9CA3AF]">Encoded by {transaction.staff?.full_name || "Staff"}</p></div>
    <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B7280]"><HiOutlineCreditCard className="h-5 w-5 text-[#D65A9A]" /> {paymentLabels[transaction.payment_method] || transaction.payment_method}</p>
    <div><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Sale</p><p className="mt-1 text-sm font-extrabold text-[#166534]">{formatCurrency(getTransactionSale(transaction))}</p></div>
    {showCommission && <div>{commission > 0 && <><p className="text-[10px] font-bold uppercase text-[#9CA3AF] xl:hidden">Commission</p><p className="mt-1 text-sm font-extrabold text-[#C85B95]">{formatCurrency(commission)}</p><p className="mt-1 text-xs text-[#6B7280]">Paid to {provider}</p></>}</div>}
    <button type="button" onClick={() => printTransactionReceipt(transaction)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#F3E8EF] bg-white px-3 text-xs font-bold text-[#713B5A]"><HiOutlinePrinter className="h-4 w-4" /> Print</button>
  </article>;
}

function Info({ label, value }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p><p className="mt-1 break-words text-xs font-semibold text-[#374151]">{value || "—"}</p></div>;
}

function Metric({ label, value, pink = false }) {
  return <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">{label}</p><p className={`mt-1 text-base font-extrabold ${pink ? "text-[#C85B95]" : "text-[#1F2937]"}`}>{value}</p></div>;
}

function ReportBlock({ title, children }) {
  return <section className="rounded-xl border border-[#F3E8EF] p-4"><h3 className="mb-3 font-extrabold capitalize text-[#1F2937]">{title}</h3><div className="space-y-2">{children}</div></section>;
}

function ReportRow({ label, value, bold = false }) {
  return <p className={`flex justify-between gap-4 capitalize ${bold ? "border-t border-[#F3E8EF] pt-2 font-extrabold" : ""}`}><span>{label}</span><span>{value}</span></p>;
}
