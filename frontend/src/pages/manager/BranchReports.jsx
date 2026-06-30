import { useCallback, useEffect, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

const periods = ["daily", "weekly", "monthly"];

export default function BranchReports() {
  const [period, setPeriod] = useState("daily");
  const [range, setRange] = useState({ start_date: "", end_date: "" });
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setReport(await managerService.reports({ period, ...range }));
    } catch (err) {
      setError(getApiError(err, "We couldn't load branch reports."));
    } finally {
      setIsLoading(false);
    }
  }, [period, range]);

  useEffect(() => {
    Promise.resolve().then(() => loadReport());
  }, [loadReport]);

  const summary = report?.summary || {};

  return (
    <ManagerWorkspace title="Branch Reports" eyebrow="Daily, weekly, monthly">
      {error && <Notice message={error} onRetry={loadReport} />}
      <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_1fr_auto] lg:items-end">
          <div className="flex gap-2 overflow-x-auto">
            {periods.map((item) => <button key={item} type="button" onClick={() => setPeriod(item)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold capitalize ${period === item ? "bg-[#C85B95] text-white" : "bg-[#FFF8FB] text-[#6B7280]"}`}>{item}</button>)}
          </div>
          <DateInput label="Start" value={range.start_date} onChange={(value) => setRange((prev) => ({ ...prev, start_date: value }))} />
          <DateInput label="End" value={range.end_date} onChange={(value) => setRange((prev) => ({ ...prev, end_date: value }))} />
          <button type="button" onClick={loadReport} className="min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white">Apply</button>
        </div>
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Bookings" value={summary.bookings || 0} icon={HiOutlineCalendarDays} tone="pink" />
        <StatCard label="Completed" value={summary.completed || 0} icon={HiOutlineCheckCircle} tone="green" />
        <StatCard label="Pending" value={summary.pending || 0} icon={HiOutlineClock} tone="amber" />
        <StatCard label="Cancelled" value={summary.cancelled || 0} icon={HiOutlineXCircle} tone="red" />
        <StatCard label="Sales" value={formatCurrency(summary.sales)} icon={HiOutlineBanknotes} tone="blue" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={4} /> : report?.services?.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280]"><span>Service</span><span>Bookings</span><span>Sales</span></div>
            {report.services.map((service) => (
              <div key={service.name} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[#F3E8EF] px-5 py-4 last:border-0">
                <span className="font-bold text-[#1F2937]">{service.name}</span><span className="text-sm text-[#6B7280]">{service.bookings}</span><span className="font-bold text-[#166534]">{formatCurrency(service.sales)}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No service activity" description="Service performance for the selected dates will appear here." />}
      </section>
    </ManagerWorkspace>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <label className="text-sm font-bold text-[#1F2937]">
      {label}
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
    </label>
  );
}
