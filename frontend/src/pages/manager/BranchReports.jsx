import { useCallback, useEffect, useState } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { DayReportPopup } from "../staff/DayEndReport";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice } from "./ManagerWorkspace";

export default function BranchReports() {
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
      const result = await managerService.reportDates();
      setAvailableDates(result.dates || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load branch report dates."));
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
      setSummary(await managerService.dayReport(day));
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

  return <ManagerWorkspace title="Reports" eyebrow="Daily branch reconciliation">
    {error && <Notice message={error} onRetry={loadDates} />}
    <section className="space-y-3">
      {datesLoading ? <CardSkeleton rows={4} /> : availableDates.map((day) => <button key={day} type="button" onClick={() => loadReport(day)} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-[1.25rem] border border-[#F3E8EF] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#D65A9A]/40 hover:bg-[#FFF8FB]">
        <span><strong className="block text-sm text-[#1F2937]">{new Date(`${day}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "full" })}</strong><span className="mt-1 block text-xs text-[#6B7280]">Click to view this date’s report</span></span>
        <HiOutlineChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#C85B95]" />
      </button>)}
      {!datesLoading && !availableDates.length && <EmptyState title="No business dates yet" description="Branch reports will appear here after a transaction is recorded." />}
    </section>
    {selectedDate && <DayReportPopup reportDate={selectedDate} summary={summary} loading={reportLoading} error={reportError} onRetry={() => loadReport(selectedDate, true)} onClose={closeReport} />}
  </ManagerWorkspace>;
}
