import { useCallback, useEffect, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlineCheckCircle, HiOutlineLockClosed, HiOutlinePrinter, HiOutlineReceiptRefund, HiOutlineUserGroup } from "react-icons/hi2";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace, StatCard } from "./StaffWorkspace";
import { formatCurrency, formatDateTime, getApiError } from "./staffWorkspaceUtils";
import SystemPopup from "../../components/common/SystemPopup";

const today = () => {
  const value = new Date();
  if (value.getHours() < 8 || (value.getHours() === 8 && value.getMinutes() < 30)) value.setDate(value.getDate() - 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function DayEndReport() {
  const [reportDate, setReportDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setSummary(await staffTransactionService.dayEndSummary(reportDate)); }
    catch (err) { setError(getApiError(err, "The day-end report could not be loaded.")); }
    finally { setLoading(false); }
  }, [reportDate]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const closeDay = async () => {
    setClosing(true); setError("");
    try { await staffTransactionService.closeDay(reportDate); setShowCloseConfirmation(false); setSuccess("Business day closed successfully. This was confirmed as the branch's final transaction summary for today."); await load(); }
    catch (err) { setShowCloseConfirmation(false); setError(getApiError(err, "The business day could not be closed.")); }
    finally { setClosing(false); }
  };

  const stats = summary ? [
    { label: "Salon Sales", value: formatCurrency(summary.salon_sales), icon: HiOutlineBanknotes, tone: "green" },
    { label: "Commission / Tips", value: formatCurrency(summary.commission_tips), icon: HiOutlineUserGroup, tone: "pink" },
    { label: "Transactions", value: summary.transaction_count, icon: HiOutlineReceiptRefund, tone: "blue" },
    { label: "Total Collected", value: formatCurrency(summary.total_collected), icon: HiOutlineCalendarDays, tone: "amber" },
  ] : [];

  return <StaffWorkspace title="Day End" eyebrow="Daily branch reconciliation" headerStats={stats}>
    {error && <ErrorNotice message={error} onRetry={load} />}
    {success && <SystemPopup tone="success" message={success} onClose={() => setSuccess("")} />}
    <p className="mb-5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1E40AF]">A business day runs from 8:30 AM until the 5:00 AM cutoff the following calendar day. Transactions after midnight and before 5:00 AM remain part of the previous business day. If staff forget to close the day, it closes automatically at 5:00 AM and payments reopen at 8:30 AM.</p>
    <section className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between print:hidden">
      <label className="w-full max-w-sm text-sm font-bold text-[#1F2937]">Report date<ModernDatePicker value={reportDate} onChange={setReportDate} placeholder="Choose report date" ariaLabel="Choose day-end report date" /></label>
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={!summary || loading} onClick={() => window.print()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#166534] bg-white px-5 font-bold text-[#166534] disabled:opacity-40"><HiOutlinePrinter className="h-5 w-5" /> Print report</button><button type="button" disabled={!summary || loading || summary.is_closed || reportDate !== today()} onClick={() => setShowCloseConfirmation(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-5 font-bold text-white disabled:opacity-40">{summary?.is_closed ? <><HiOutlineCheckCircle className="h-5 w-5" /> Day Closed</> : <><HiOutlineLockClosed className="h-5 w-5" /> Close Day</>}</button></div>
    </section>

    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#6B7280]">Preparing daily summary…</p> : summary && <article className="day-end-print overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-lg">
      <header className="bg-[#FFF0F7] px-6 py-7 text-center"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="mx-auto h-20 w-20" /><h2 className="mt-2 text-xl font-extrabold text-[#713B5A]">Happy Skin Nails Spa &amp; Aesthetics</h2><p className="mt-1 text-sm text-[#6B7280]">{summary.branch_name}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#C85B95]">Day-End Sales Report</p></header>
      <div className="p-6 text-sm text-[#374151]">
        <div className="grid gap-3 border-b border-dashed border-[#D1D5DB] pb-5 sm:grid-cols-3"><Info label="Business day" value={`${new Date(`${summary.report_date}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "medium" })}, 8:30 AM – next day, 5:00 AM`} /><Info label="Prepared by" value={summary.prepared_by} /><Info label={summary.is_closed ? "Closed by" : "Generated"} value={summary.is_closed ? `${summary.closed_by} · ${formatDateTime(summary.closed_at)}` : formatDateTime(summary.generated_at)} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Salon sales" value={formatCurrency(summary.salon_sales)} /><Metric label="Commission / tips" value={formatCurrency(summary.commission_tips)} pink /><Metric label="Total collected" value={formatCurrency(summary.total_collected)} /><Metric label="Completed services" value={summary.transaction_count} /></div>
        <section className="mt-6 grid gap-5 md:grid-cols-2"><ReportBlock title="Booking source"><ReportRow label="Online reservations" value={summary.online_count} /><ReportRow label="Walk-ins" value={summary.walk_in_count} /><ReportRow label="Total" value={summary.transaction_count} bold /></ReportBlock><ReportBlock title="Payment methods">{Object.entries(summary.payment_methods || {}).map(([method, amount]) => <ReportRow key={method} label={method.replace("_", " ")} value={formatCurrency(amount)} />)}<ReportRow label="Total collected" value={formatCurrency(summary.total_collected)} bold /></ReportBlock></section>
        <section className="mt-6"><h3 className="font-extrabold text-[#1F2937]">Staff services and commission</h3>{summary.staff_performance?.length ? <div className="mt-3 overflow-hidden rounded-xl border border-[#F3E8EF]"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#FFF8FB] px-4 py-3 text-xs font-bold uppercase text-[#6B7280]"><span>Provider</span><span>Services</span><span>Commission / tip</span></div>{summary.staff_performance.map((staff) => <div key={staff.name} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-[#F3E8EF] px-4 py-3"><strong>{staff.name}</strong><span>{staff.services}</span><strong className="text-[#C85B95]">{formatCurrency(staff.commission)}</strong></div>)}</div> : <p className="mt-3 rounded-xl bg-[#FFF8FB] p-5 text-center text-[#6B7280]">No completed transactions for this date.</p>}</section>
        <p className="mt-6 border-t border-dashed border-[#D1D5DB] pt-4 text-center text-xs text-[#6B7280]">End of report · {summary.branch_name}</p>
      </div>
    </article>}
    {showCloseConfirmation && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#172033]/45 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-[1.75rem] bg-white p-6 text-center shadow-2xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FEE2E2] text-[#B91C1C]"><HiOutlineLockClosed className="h-7 w-7" /></span><h2 className="mt-4 text-xl font-extrabold text-[#1F2937]">Confirm last transaction</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">Confirm that all transactions for this business day are complete. After closing, staff cannot record another payment until the next 8:30 AM opening. If nobody closes it manually, the system will close it automatically at 5:00 AM.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={closing} onClick={() => setShowCloseConfirmation(false)} className="min-h-11 rounded-xl border border-[#E8B7D0] font-bold text-[#C85B95]">Cancel</button><button type="button" disabled={closing} onClick={closeDay} className="min-h-11 rounded-xl bg-[#B91C1C] font-bold text-white disabled:opacity-50">{closing ? "Closing…" : "Yes, close day"}</button></div></section></div>}
  </StaffWorkspace>;
}

function Info({ label, value }) { return <p><span className="text-xs text-[#6B7280]">{label}</span><br /><strong>{value}</strong></p>; }
function Metric({ label, value, pink = false }) { return <div className="rounded-xl bg-[#FFF8FB] p-4"><p className="text-xs font-bold uppercase text-[#6B7280]">{label}</p><p className={`mt-2 text-xl font-extrabold ${pink ? "text-[#C85B95]" : "text-[#166534]"}`}>{value}</p></div>; }
function ReportBlock({ title, children }) { return <div className="rounded-xl border border-[#F3E8EF] p-4"><h3 className="mb-3 font-extrabold text-[#1F2937]">{title}</h3><div className="space-y-2">{children}</div></div>; }
function ReportRow({ label, value, bold = false }) { return <p className={`flex justify-between gap-4 capitalize ${bold ? "border-t border-[#F3E8EF] pt-2 font-extrabold" : ""}`}><span>{label}</span><span>{value}</span></p>; }
