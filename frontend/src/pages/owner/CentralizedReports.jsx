import { useCallback, useEffect, useState } from "react";
import { HiOutlineChevronDown, HiOutlineXMark, HiOutlineMagnifyingGlass, HiOutlineAdjustmentsHorizontal, HiOutlinePrinter } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";

const currentMonthValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const currentYearValue = () => String(new Date().getFullYear());
const currentDateValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

export default function CentralizedReports() {
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [summary, setSummary] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [error, setError] = useState("");
  const [month, setMonth] = useState(currentMonthValue);
  const [period, setPeriod] = useState("monthly");
  const [year, setYear] = useState(currentYearValue);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [periodReport, setPeriodReport] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ branches: [], staff: [], services: [] });
  const [filters, setFilters] = useState({ branch_id: "", staff_id: "", service_id: "", booking_type: "", appointment_status: "", payment_method: "" });
  const [customStart, setCustomStart] = useState(currentDateValue);
  const [customEnd, setCustomEnd] = useState(currentDateValue);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadDates = useCallback(async () => {
    setDatesLoading(true);
    setError("");
    try {
      const result = await ownerService.reportDates();
      setAvailableDates(result.dates || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load report dates."));
    } finally {
      setDatesLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(loadDates); }, [loadDates]);
  useEffect(() => { ownerService.reportFilters(filters.branch_id || null).then(setFilterOptions).catch(() => {}); }, [filters.branch_id]);

  const searchReports = async (event) => {
    event.preventDefault();
    setAppliedSearch(searchText.trim().toLocaleLowerCase());
    setPeriodLoading(true); setError("");
    try {
      let startDate; let endDate;
      if (period === "custom") { startDate = customStart; endDate = customEnd; }
      else if (period === "daily") { startDate = currentDateValue(); endDate = startDate; }
      else if (period === "weekly") {
        const anchor = new Date(`${currentDateValue()}T00:00:00`); anchor.setDate(anchor.getDate() - anchor.getDay());
        startDate = `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,"0")}-${String(anchor.getDate()).padStart(2,"0")}`;
        const last = new Date(anchor); last.setDate(last.getDate()+6); endDate = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
      } else if (period === "monthly") {
        const [selectedYear, monthNumber] = month.split("-").map(Number);
        startDate = `${month}-01`;
        endDate = month === currentMonthValue() ? currentDateValue() : new Date(Date.UTC(selectedYear, monthNumber, 0)).toISOString().slice(0, 10);
      } else {
        startDate = `${year}-01-01`;
        endDate = year === currentYearValue() ? currentDateValue() : `${year}-12-31`;
      }
      if (!startDate || !endDate || startDate > endDate) throw new Error("Choose a valid date range.");
      setPeriodReport(await ownerService.reports({ period, start_date: startDate, end_date: endDate, ...Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,value || null])) }));
      setFiltersOpen(false);
    } catch (err) { setError(getApiError(err, "We couldn't search report data.")); }
    finally { setPeriodLoading(false); }
  };

  const searchedDates = availableDates.filter((day) => !appliedSearch || day.includes(appliedSearch));
  const searchedBranches = (periodReport?.branches || []).filter((row) => !appliedSearch || row.name.toLocaleLowerCase().includes(appliedSearch));
  const searchedServices = (periodReport?.services || []).filter((row) => !appliedSearch || row.name.toLocaleLowerCase().includes(appliedSearch));

  const loadReport = useCallback(async (day, force = false) => {
    if (!force && selectedDate === day && summary) return;
    setSelectedDate(day);
    setReportLoading(true);
    setReportError("");
    try {
      setSummary(await ownerService.dayReport(day));
    } catch (err) {
      setSummary(null);
      setReportError(getApiError(err, "We couldn't load this date's report."));
    } finally {
      setReportLoading(false);
    }
  }, [selectedDate, summary]);

  const closeReport = () => {
    setSelectedDate("");
    setReportError("");
  };

  return <OwnerWorkspace title="Reports" eyebrow="Monthly summaries · daily reconciliation">
    {error && <Notice message={error} onRetry={loadDates} />}
    <div className="mb-5 flex justify-end print:hidden"><button type="button" onClick={()=>setFiltersOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white"><HiOutlineAdjustmentsHorizontal className="h-5 w-5"/>Filter reports</button><button type="button" disabled={!periodReport} onClick={()=>window.print()} className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-green-700 px-4 font-bold text-green-800 disabled:opacity-40"><HiOutlinePrinter/>Print report</button></div>
    {filtersOpen && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#172033]/55 p-3 backdrop-blur-sm sm:p-6 print:hidden" onMouseDown={e=>e.target===e.currentTarget&&setFiltersOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="owner-report-filter-title" className="w-full max-w-5xl rounded-[1.5rem] bg-white p-4 shadow-2xl sm:p-6"><header className="mb-4 flex items-center justify-between"><h2 id="owner-report-filter-title" className="text-xl font-extrabold">Filter reports</h2><button type="button" onClick={()=>setFiltersOpen(false)} aria-label="Close filters" className="rounded-lg p-2 hover:bg-pink-50"><HiOutlineXMark className="h-6 w-6"/></button></header>
    <form onSubmit={searchReports} className="report-filter-panel grid gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-bold text-[#1F2937]">Report period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="form-input mt-1"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom date range</option></select></label>
      {period === "custom" ? <><label className="text-sm font-bold">From<input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="form-input mt-1" required /></label><label className="text-sm font-bold">To<input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="form-input mt-1" required /></label></> : period === "monthly" ? <label className="text-sm font-bold">Month<input required type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="form-input mt-1" /></label> : period === "yearly" ? <label className="text-sm font-bold">Year<input required type="number" min="2000" max={new Date().getFullYear()} value={year} onChange={(event) => setYear(event.target.value)} className="form-input mt-1" /></label> : <div className="self-end text-sm text-gray-500">{period === "daily" ? currentDateValue() : "Current week"}</div>}
      <FilterSelect label="Branch" value={filters.branch_id} options={filterOptions.branches.map(x=>[x.id,x.name])} onChange={v=>setFilters({...filters,branch_id:v,staff_id:"",service_id:""})}/><FilterSelect label="Staff member" value={filters.staff_id} options={filterOptions.staff.map(x=>[x.id,x.name])} onChange={v=>setFilters({...filters,staff_id:v})}/><FilterSelect label="Service" value={filters.service_id} options={filterOptions.services.map(x=>[x.id,x.name])} onChange={v=>setFilters({...filters,service_id:v})}/>
      <FilterSelect label="Booking type" value={filters.booking_type} options={[["online","Online"],["walk_in","Walk-in"],["guest","Guest"],["registered","Registered"]]} onChange={v=>setFilters({...filters,booking_type:v})}/><FilterSelect label="Appointment status" value={filters.appointment_status} options={[["pending","Pending"],["confirmed","Confirmed"],["completed","Completed"],["cancelled","Cancelled"]]} onChange={v=>setFilters({...filters,appointment_status:v})}/>
      <FilterSelect label="Payment method" value={filters.payment_method} options={[["cash","Cash"],["gcash","GCash"],["paypal","PayPal"],["card","Card"],["bank_transfer","Bank transfer"]]} onChange={v=>setFilters({...filters,payment_method:v})}/>
      <label className="text-sm font-bold text-[#1F2937]">Search branches, services, or dates<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Type a branch, service, or YYYY-MM-DD" className="form-input mt-1" /></label>
      <div className="flex flex-wrap gap-2 self-end"><button disabled={periodLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-5 font-bold text-white disabled:opacity-50"><HiOutlineMagnifyingGlass className="h-5 w-5" />{periodLoading ? "Applying…" : "Apply filters"}</button><button type="button" onClick={()=>{setFilters({branch_id:"",staff_id:"",service_id:"",booking_type:"",appointment_status:"",payment_method:""});setSearchText("");setAppliedSearch("");}} className="rounded-xl border px-4 font-bold">Clear filters</button></div>
    </form></section></div>}
    {periodReport && <section className="owner-period-report mb-6 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-extrabold text-[#1F2937]">Happy Skin Nails Spa &amp; Aesthetic x He &amp; She Salon · {filters.branch_id ? (filterOptions.branches.find(([id])=>String(id)===filters.branch_id)?.[1] || "Selected branch") : "All Branches"} · {periodReport.period[0].toUpperCase() + periodReport.period.slice(1)} report</h2><p className="text-sm text-[#6B7280]">{periodReport.start_date} to {periodReport.end_date}</p></div><p className="mt-1 text-xs text-gray-500">Generated by owner · {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
      <p className="mt-3 text-xs text-[#6B7280]">Sales are total collections less staff commission; operating expenses are not included.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Bookings", periodReport.summary.bookings], ["Completed", periodReport.summary.completed], ["Salon sales after commission", formatCurrency(periodReport.summary.sales)], ["Staff commission", formatCurrency(periodReport.summary.staff_commission)]].map(([label, value]) => <div key={label} className={`rounded-xl p-3 ${label === "Salon sales after commission" ? "bg-[#F0FDF4]" : "bg-[#FFF8FB]"}`}><p className="text-xs font-bold uppercase text-[#6B7280]">{label}</p><p className="mt-1 font-extrabold text-[#1F2937]">{value}</p></div>)}</div>
      <div className="mt-5 grid gap-5 md:grid-cols-2"><section><h3 className="font-bold text-[#1F2937]">Branches</h3>{searchedBranches.length ? searchedBranches.map((row) => <p key={row.name} className="mt-2 flex justify-between gap-3 rounded-lg bg-[#FFF8FB] p-3 text-sm"><span>{row.name} · {row.bookings} bookings</span><strong>{formatCurrency(row.sales)}</strong></p>) : <p className="mt-2 text-sm text-[#6B7280]">No matching branches.</p>}</section><section><h3 className="font-bold text-[#1F2937]">Services</h3>{searchedServices.length ? searchedServices.map((row) => <p key={row.name} className="mt-2 flex justify-between gap-3 rounded-lg bg-[#FFF8FB] p-3 text-sm"><span>{row.name} · {row.bookings} bookings</span><strong>{formatCurrency(row.sales)}</strong></p>) : <p className="mt-2 text-sm text-[#6B7280]">No matching services.</p>}</section></div>
    </section>}
    <section className="space-y-3">
      {datesLoading ? <CardSkeleton rows={4} /> : searchedDates.map((day) => <button key={day} type="button" onClick={() => loadReport(day)} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-[1.25rem] border border-[#F3E8EF] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#D65A9A]/40 hover:bg-[#FFF8FB]">
        <span><strong className="block text-sm text-[#1F2937]">{new Date(`${day}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" })}</strong><span className="mt-1 block text-xs text-[#6B7280]">Click to view this date’s report across all branches</span></span>
        <HiOutlineChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#C85B95]" />
      </button>)}
      {!datesLoading && !searchedDates.length && <EmptyState title={availableDates.length ? "No matching report dates" : "No business dates yet"} description={availableDates.length ? "Try a different search." : "Reports will appear here after transactions are recorded at your branches."} />}
    </section>
    {selectedDate && <OwnerReportPopup reportDate={selectedDate} summary={summary} loading={reportLoading} error={reportError} onRetry={() => loadReport(selectedDate, true)} onClose={closeReport} />}
  </OwnerWorkspace>;
}

function FilterSelect({ label, value, options, onChange }) {
  return <label className="text-sm font-bold text-[#1F2937]">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="form-input mt-1"><option value="">All</option>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}

function OwnerReportPopup({ reportDate, summary, loading, error, onRetry, onClose }) {
  const dateLabel = new Date(`${summary?.report_date || reportDate}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" });
  return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[#172033]/50 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="owner-report-title" className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#F3E8EF] bg-white px-5 py-4 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">All branch reports</p><h2 id="owner-report-title" className="mt-1 text-lg font-extrabold text-[#1F2937]">{dateLabel}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close report" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#713B5A] hover:bg-[#FCE7F3]"><HiOutlineXMark className="h-6 w-6" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {loading ? <p className="grid min-h-64 place-items-center text-sm font-semibold text-[#6B7280]">Loading branch reports…</p>
          : error ? <div className="grid min-h-64 place-items-center"><div className="text-center"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={onRetry} className="mt-3 font-bold text-[#C85B95] underline">Retry</button></div></div>
            : summary?.branches?.length ? <div className="grid gap-4 lg:grid-cols-2">{summary.branches.map((branch) => <BranchReportCard key={branch.branch_id} branch={branch} />)}</div>
              : <p className="p-10 text-center text-sm text-[#6B7280]">No branch reports are available for this date.</p>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-[#F3E8EF] bg-white px-5 py-3"><button type="button" onClick={onClose} className="min-h-10 rounded-xl bg-[#C85B95] px-5 text-sm font-bold text-white">Close</button></footer>
    </section>
  </div>;
}

function BranchReportCard({ branch }) {
  const paymentMethods = Object.entries(branch.payment_methods || {}).filter(([, amount]) => Number(amount) > 0);
  return <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-sm sm:p-5">
    <h3 className="text-base font-extrabold text-[#1F2937]">{branch.branch_name}</h3>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-[#F0FDF4] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#166534]">Salon sales</p><p className="mt-1 font-extrabold text-[#166534]">{formatCurrency(branch.salon_sales)}</p></div>
      <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">Total collected</p><p className="mt-1 font-extrabold text-[#1F2937]">{formatCurrency(branch.total_collected)}</p></div>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <section><h4 className="text-sm font-bold text-[#1F2937]">Booking source</h4><div className="mt-2 space-y-2 text-sm text-[#6B7280]"><p className="flex justify-between gap-3"><span>Online reservations</span><span>{branch.online_count}</span></p><p className="flex justify-between gap-3"><span>Walk-ins</span><span>{branch.walk_in_count}</span></p></div></section>
      <section><h4 className="text-sm font-bold text-[#1F2937]">Payment methods</h4>{paymentMethods.length ? <div className="mt-2 space-y-2 text-sm text-[#6B7280]">{paymentMethods.map(([method, amount]) => <p key={method} className="flex justify-between gap-3"><span className="capitalize">{method.replaceAll("_", " ")}</span><span>{formatCurrency(amount)}</span></p>)}</div> : <p className="mt-2 text-sm text-[#6B7280]">No payments recorded.</p>}</section>
    </div>
    <section className="mt-4 border-t border-[#F3E8EF] pt-4"><h4 className="text-sm font-bold text-[#1F2937]">Services</h4>{branch.services?.length ? <div className="mt-2 space-y-2 text-sm text-[#6B7280]">{branch.services.map((service) => <p key={service.name} className="flex justify-between gap-3"><span>{service.name}</span><span>{service.count}</span></p>)}</div> : <p className="mt-2 text-sm text-[#6B7280]">No services recorded.</p>}</section>
  </article>;
}
