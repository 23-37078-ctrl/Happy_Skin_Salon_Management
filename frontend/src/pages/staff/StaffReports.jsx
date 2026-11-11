import { useCallback, useEffect, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlinePrinter, HiOutlineReceiptRefund, HiOutlineUserGroup, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { HiOutlineAdjustmentsHorizontal, HiOutlineXMark } from "react-icons/hi2";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import staffTransactionService from "../../services/staffTransactionService";
import { ErrorNotice, StaffWorkspace, StatCard } from "./StaffWorkspace";
import { formatCurrency, formatDateTime, getApiError } from "./staffWorkspaceUtils";

const currentMonthValue = () => localDateValue().slice(0, 7);
const currentYearValue = () => localDateValue().slice(0, 4);

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
  const [reportMonth, setReportMonth] = useState(currentMonthValue);
  const [reportYear, setReportYear] = useState(currentYearValue);
  const [rangeStartDate, setRangeStartDate] = useState(localDateValue);
  const [rangeEndDate, setRangeEndDate] = useState(localDateValue);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterOptions, setFilterOptions] = useState({ staff: [], services: [] });
  const [filters, setFilters] = useState({ staff_id: "", service_id: "", booking_type: "", appointment_status: "", payment_method: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadReport = useCallback(async () => {
    if (period === "custom" && (!rangeStartDate || !rangeEndDate || rangeStartDate > rangeEndDate)) {
      setReport(null);
      setLoading(false);
      setError(rangeStartDate && rangeEndDate ? "Start date must be on or before end date." : "Choose both dates to prepare the report.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setReport(await staffTransactionService.periodReport({ period, report_date: reportDate, start_date: period === "custom" ? rangeStartDate : undefined, end_date: period === "custom" ? rangeEndDate : undefined, ...Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,value || undefined])) }));
    } catch (err) {
      setError(getApiError(err, "The sales report could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [period, reportDate, rangeStartDate, rangeEndDate, filters]);

  useEffect(() => { Promise.resolve().then(loadReport); }, [loadReport]);
  useEffect(() => { staffTransactionService.reportFilters().then(setFilterOptions).catch(() => {}); }, []);

  const submitSearch = async (event) => {
    event.preventDefault();
    setAppliedSearch(searchText.trim().toLocaleLowerCase());
    const anchor = period === "monthly" ? `${reportMonth}-01` : period === "yearly" ? `${reportYear}-01-01` : reportDate;
    setReportDate(anchor);
    setLoading(true);
    setError("");
    try {
      const nextReport = await staffTransactionService.periodReport({ period, report_date: anchor, start_date: period === "custom" ? rangeStartDate : undefined, end_date: period === "custom" ? rangeEndDate : undefined, ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value || undefined])) });
      setReport(nextReport);
      setFiltersOpen(false);
    } catch (err) {
      setError(getApiError(err, "The sales report could not be loaded."));
    } finally { setLoading(false); }
  };
  const visibleStaff = (report?.staff_performance || []).filter((staff) => !appliedSearch || staff.name.toLocaleLowerCase().includes(appliedSearch));

  const stats = report ? [
    { label: "Salon sales after commission", value: formatCurrency(report.salon_sales), icon: HiOutlineBanknotes, tone: "green" },
    { label: "Commission / Tips", value: formatCurrency(report.commission_tips), icon: HiOutlineUserGroup, tone: "pink" },
    { label: "Transactions", value: report.transaction_count, icon: HiOutlineReceiptRefund, tone: "blue" },
    { label: "Total Collected", value: formatCurrency(report.total_collected), icon: HiOutlineCalendarDays, tone: "amber" },
  ] : [];

  return <StaffWorkspace title="Sales Reports" eyebrow="Branch performance">
    {error && <ErrorNotice message={error} onRetry={loadReport} />}
    <div className="mb-5 flex justify-end print:hidden"><button type="button" onClick={()=>setFiltersOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white"><HiOutlineAdjustmentsHorizontal className="h-5 w-5"/>Filter reports</button><button type="button" disabled={!report || loading} onClick={() => window.print()} className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#16A34A] bg-white px-4 font-bold text-[#166534] disabled:opacity-40"><HiOutlinePrinter className="h-4 w-4"/>Print report</button></div>
    {filtersOpen && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#172033]/55 p-3 backdrop-blur-sm sm:p-6 print:hidden" onMouseDown={e=>e.target===e.currentTarget&&setFiltersOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="staff-report-filter-title" className="w-full max-w-5xl rounded-[1.5rem] bg-white p-4 shadow-2xl sm:p-6"><header className="mb-4 flex items-center justify-between"><h2 id="staff-report-filter-title" className="text-xl font-extrabold">Filter reports</h2><button type="button" onClick={()=>setFiltersOpen(false)} aria-label="Close filters" className="rounded-lg p-2 hover:bg-pink-50"><HiOutlineXMark className="h-6 w-6"/></button></header>
    <form onSubmit={submitSearch} className="report-filter-panel grid gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold text-[#1F2937]">Report period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="form-input mt-1"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom date range</option></select></label>
        {period === "custom" ? <><label className="text-sm font-bold text-[#1F2937]">From<div className="mt-1"><ModernDatePicker value={rangeStartDate} onChange={setRangeStartDate} placeholder="Start date" ariaLabel="Report start date" /></div></label><label className="text-sm font-bold text-[#1F2937]">To<div className="mt-1"><ModernDatePicker value={rangeEndDate} onChange={setRangeEndDate} placeholder="End date" ariaLabel="Report end date" /></div></label></> : period === "monthly" ? <label className="text-sm font-bold text-[#1F2937]">Month<input required type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="form-input mt-1" /></label> : period === "yearly" ? <label className="text-sm font-bold text-[#1F2937]">Year<input required type="number" min="2000" max={new Date().getFullYear()} value={reportYear} onChange={(event) => setReportYear(event.target.value)} className="form-input mt-1" /></label> : <div className="self-end text-sm text-gray-500">{period === "daily" ? localDateValue() : "Current week"}</div>}
        <FilterSelect label="Staff member" value={filters.staff_id} options={filterOptions.staff.map(x=>[x.id,x.name])} onChange={v=>setFilters({...filters,staff_id:v})}/><FilterSelect label="Service" value={filters.service_id} options={filterOptions.services.map(x=>[x.id,x.name])} onChange={v=>setFilters({...filters,service_id:v})}/>
        <FilterSelect label="Booking type" value={filters.booking_type} options={[["online","Online"],["walk_in","Walk-in"],["guest","Guest"],["registered","Registered"]]} onChange={v=>setFilters({...filters,booking_type:v})}/><FilterSelect label="Appointment status" value={filters.appointment_status} options={[["pending","Pending"],["confirmed","Confirmed"],["completed","Completed"],["cancelled","Cancelled"]]} onChange={v=>setFilters({...filters,appointment_status:v})}/><FilterSelect label="Payment method" value={filters.payment_method} options={[["cash","Cash"],["gcash","GCash"],["paypal","PayPal"],["card","Card"],["bank_transfer","Bank transfer"]]} onChange={v=>setFilters({...filters,payment_method:v})}/>
        <label className="text-sm font-bold text-[#1F2937]">Search services or report dates<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Type a service or YYYY-MM-DD" className="form-input mt-1" /></label>
      <div className="flex flex-wrap gap-2 self-end"><button disabled={loading} type="submit" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white disabled:opacity-50"><HiOutlineMagnifyingGlass className="h-5 w-5" />{loading ? "Applying…" : "Apply filters"}</button><button type="button" onClick={()=>{setPeriod("daily");setReportDate(localDateValue());setReportMonth(currentMonthValue());setReportYear(currentYearValue());setRangeStartDate(localDateValue());setRangeEndDate(localDateValue());setFilters({staff_id:"",service_id:"",booking_type:"",appointment_status:"",payment_method:""});setSearchText("");setAppliedSearch("");}} className="min-h-11 rounded-xl border border-[#1F2937] bg-white px-5 font-bold text-[#1F2937]">Clear filters</button></div>
    </form></section></div>}

    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#6B7280]">Preparing report…</p> : report && <article className="staff-period-report overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-lg">
      <header className="bg-[#FFF0F7] px-6 py-7 text-center"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="mx-auto h-16 w-16" /><h2 className="mt-2 text-xl font-extrabold text-[#713B5A]">Happy Skin Nails Spa &amp; Aesthetics</h2><p className="mt-1 text-sm text-[#6B7280]">{report.branch_name}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#C85B95]">{period === "custom" ? "Custom date range" : period} sales report</p><p className="mt-1 text-sm text-[#6B7280]">{displayDate(report.start_date)}{report.end_date !== report.start_date ? ` – ${displayDate(report.end_date)}` : ""}</p></header>
      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div><p className="mt-3 text-xs text-[#6B7280]">Salon sales are total collections less staff commission; operating expenses are not included.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <ReportPanel title="Booking source"><ReportRow label="Online reservations" value={report.online_count} /><ReportRow label="Walk-ins" value={report.walk_in_count} /><ReportRow label="Total transactions" value={report.transaction_count} bold /></ReportPanel>
          <ReportPanel title="Payment methods">{Object.entries(report.payment_methods || {}).map(([method, amount]) => <ReportRow key={method} label={method.replace("_", " ")} value={formatCurrency(amount)} />)}<ReportRow label="Total collected" value={formatCurrency(report.total_collected)} bold /></ReportPanel>
        </div>
        <section className="mt-6"><h3 className="font-extrabold text-[#1F2937]">Staff performance</h3>{visibleStaff.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-[#F3E8EF]"><div className="grid min-w-[34rem] grid-cols-[1.3fr_0.7fr_1fr_1fr] gap-3 bg-[#FFF8FB] px-4 py-3 text-xs font-bold uppercase text-[#6B7280]"><span>Provider</span><span>Services</span><span>Sales</span><span>Commission / tips</span></div>{visibleStaff.map((staff) => <div key={staff.name} className="grid min-w-[34rem] grid-cols-[1.3fr_0.7fr_1fr_1fr] gap-3 border-t border-[#F3E8EF] px-4 py-3 text-sm"><strong>{staff.name}</strong><span>{staff.services}</span><span>{formatCurrency(staff.sales)}</span><strong className="text-[#C85B95]">{formatCurrency(staff.commission)}</strong></div>)}</div> : <p className="mt-3 rounded-xl bg-[#FFF8FB] p-5 text-center text-sm text-[#6B7280]">{report.staff_performance?.length ? "No staff match this search." : "No transactions in this period."}</p>}</section>
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

function FilterSelect({ label, value, options, onChange }) {
  return <label className="text-sm font-bold text-[#1F2937]">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="form-input mt-1"><option value="">All</option>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}
