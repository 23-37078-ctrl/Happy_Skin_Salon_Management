import { useCallback, useEffect, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlinePrinter, HiOutlineReceiptRefund, HiOutlineUserGroup } from "react-icons/hi2";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace, StatCard } from "./StaffWorkspace";
import { formatCurrency, formatDateTime, getApiError } from "./staffWorkspaceUtils";

function localDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export default function StaffReports() {
  const [period, setPeriod] = useState("daily");
  const [reportDate, setReportDate] = useState(localDateValue);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await staffTransactionService.periodReport({ period, report_date: reportDate }));
    } catch (err) {
      setError(getApiError(err, "The sales report could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [period, reportDate]);

  useEffect(() => { Promise.resolve().then(loadReport); }, [loadReport]);

  const stats = report ? [
    { label: "Salon Sales", value: formatCurrency(report.salon_sales), icon: HiOutlineBanknotes, tone: "green" },
    { label: "Commission / Tips", value: formatCurrency(report.commission_tips), icon: HiOutlineUserGroup, tone: "pink" },
    { label: "Transactions", value: report.transaction_count, icon: HiOutlineReceiptRefund, tone: "blue" },
    { label: "Total Collected", value: formatCurrency(report.total_collected), icon: HiOutlineCalendarDays, tone: "amber" },
  ] : [];

  return <StaffWorkspace title="Sales Reports" eyebrow="Branch performance">
    {error && <ErrorNotice message={error} onRetry={loadReport} />}
    <section className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="grid w-full gap-3 sm:max-w-2xl sm:grid-cols-2">
        <label className="text-sm font-bold text-[#1F2937]">Report period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="form-input mt-1"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        <label className="text-sm font-bold text-[#1F2937]">{period === "daily" ? "Report date" : "Choose a date in the period"}<ModernDatePicker value={reportDate} onChange={setReportDate} placeholder="Choose report date" ariaLabel="Choose report date" /></label>
      </div>
      <button type="button" disabled={!report || loading} onClick={() => window.print()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#166534] bg-white px-5 font-bold text-[#166534] disabled:opacity-40"><HiOutlinePrinter className="h-5 w-5" /> Print report</button>
    </section>

    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#6B7280]">Preparing report…</p> : report && <article className="staff-period-report overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-lg">
      <header className="bg-[#FFF0F7] px-6 py-7 text-center"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="mx-auto h-16 w-16" /><h2 className="mt-2 text-xl font-extrabold text-[#713B5A]">Happy Skin Nails Spa &amp; Aesthetics</h2><p className="mt-1 text-sm text-[#6B7280]">{report.branch_name}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#C85B95]">{period} sales report</p><p className="mt-1 text-sm text-[#6B7280]">{displayDate(report.start_date)}{report.end_date !== report.start_date ? ` – ${displayDate(report.end_date)}` : ""}</p></header>
      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <ReportPanel title="Booking source"><ReportRow label="Online reservations" value={report.online_count} /><ReportRow label="Walk-ins" value={report.walk_in_count} /><ReportRow label="Total transactions" value={report.transaction_count} bold /></ReportPanel>
          <ReportPanel title="Payment methods">{Object.entries(report.payment_methods || {}).map(([method, amount]) => <ReportRow key={method} label={method.replace("_", " ")} value={formatCurrency(amount)} />)}<ReportRow label="Total collected" value={formatCurrency(report.total_collected)} bold /></ReportPanel>
        </div>
        <section className="mt-6"><h3 className="font-extrabold text-[#1F2937]">Staff performance</h3>{report.staff_performance?.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-[#F3E8EF]"><div className="grid min-w-[34rem] grid-cols-[1.3fr_0.7fr_1fr_1fr] gap-3 bg-[#FFF8FB] px-4 py-3 text-xs font-bold uppercase text-[#6B7280]"><span>Provider</span><span>Services</span><span>Sales</span><span>Commission / tips</span></div>{report.staff_performance.map((staff) => <div key={staff.name} className="grid min-w-[34rem] grid-cols-[1.3fr_0.7fr_1fr_1fr] gap-3 border-t border-[#F3E8EF] px-4 py-3 text-sm"><strong>{staff.name}</strong><span>{staff.services}</span><span>{formatCurrency(staff.sales)}</span><strong className="text-[#C85B95]">{formatCurrency(staff.commission)}</strong></div>)}</div> : <p className="mt-3 rounded-xl bg-[#FFF8FB] p-5 text-center text-sm text-[#6B7280]">No transactions in this period.</p>}</section>
        <p className="mt-6 border-t border-dashed border-[#D1D5DB] pt-4 text-center text-xs text-[#6B7280]">Prepared by {report.prepared_by} · Generated {formatDateTime(report.generated_at)}</p>
      </div>
    </article>}
  </StaffWorkspace>;
}

function ReportPanel({ title, children }) {
  return <section className="rounded-xl border border-[#F3E8EF] p-4"><h3 className="mb-3 font-extrabold capitalize text-[#1F2937]">{title}</h3><div className="space-y-2">{children}</div></section>;
}

function ReportRow({ label, value, bold = false }) {
  return <p className={`flex justify-between gap-4 capitalize ${bold ? "border-t border-[#F3E8EF] pt-2 font-extrabold" : ""}`}><span>{label}</span><span>{value}</span></p>;
}
