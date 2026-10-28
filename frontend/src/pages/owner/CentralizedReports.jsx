import { useCallback, useEffect, useState } from "react";
import { HiOutlineChevronDown, HiOutlineXMark } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";

export default function CentralizedReports() {
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [summary, setSummary] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [error, setError] = useState("");

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

  return <OwnerWorkspace title="Reports" eyebrow="All branches · Daily reconciliation">
    {error && <Notice message={error} onRetry={loadDates} />}
    <section className="space-y-3">
      {datesLoading ? <CardSkeleton rows={4} /> : availableDates.map((day) => <button key={day} type="button" onClick={() => loadReport(day)} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-[1.25rem] border border-[#F3E8EF] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#D65A9A]/40 hover:bg-[#FFF8FB]">
        <span><strong className="block text-sm text-[#1F2937]">{new Date(`${day}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" })}</strong><span className="mt-1 block text-xs text-[#6B7280]">Click to view this date’s report across all branches</span></span>
        <HiOutlineChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#C85B95]" />
      </button>)}
      {!datesLoading && !availableDates.length && <EmptyState title="No business dates yet" description="Reports will appear here after transactions are recorded at your branches." />}
    </section>
    {selectedDate && <OwnerReportPopup reportDate={selectedDate} summary={summary} loading={reportLoading} error={reportError} onRetry={() => loadReport(selectedDate, true)} onClose={closeReport} />}
  </OwnerWorkspace>;
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
