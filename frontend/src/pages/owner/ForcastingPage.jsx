import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlinePresentationChartLine,
} from "react-icons/hi2";
import ForecastChart from "../../assets/components/forecasting/ForecastChart";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";

export default function ForcastingPage({ embedded = false }) {
  const [forecasts, setForecasts] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTraining, setIsTraining] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [forecastPeriod, setForecastPeriod] = useState("weekly");
  const forecastDays = forecastPeriod === "weekly" ? 7 : forecastPeriod === "monthly" ? 31 : 365;

  const loadForecasts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const branchPayload = await ownerService.branches();
      const activeBranches = (branchPayload.branches || []).filter((branch) => branch.is_active);
      const results = await Promise.all(activeBranches.map((branch) => forecastService.branchForecast(branch.id, forecastDays)));
      setForecasts(results);
      const selected = results.some((item) => String(item.branch_id) === String(selectedBranchId)) ? selectedBranchId : String(results[0]?.branch_id || "");
      setSelectedBranchId(selected);
      if (selected) setAnalysis(await forecastService.trafficAnalysis(selected, forecastDays));
    } catch (err) {
      setError(getApiError(err, "We couldn't load the customer visit estimates. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, forecastDays]);

  useEffect(() => {
    if (!selectedBranchId) return;
    forecastService.trafficAnalysis(selectedBranchId, forecastDays).then(setAnalysis).catch(() => setAnalysis(null));
  }, [selectedBranchId, forecastDays]);

  const trainModel = async () => {
    setIsTraining(true);
    setError("");
    try {
      const result = await forecastService.train();
      await loadForecasts();
    } catch (err) {
      setError(getApiError(err, "We couldn't update the estimates. There may not be enough completed appointments yet."));
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(loadForecasts);
  }, [loadForecasts]);

  const selectedForecast = useMemo(
    () => forecasts.find((item) => String(item.branch_id) === String(selectedBranchId)) || forecasts[0] || null,
    [forecasts, selectedBranchId],
  );

  const content = (
    <>
      {error && <Notice message={error} onRetry={loadForecasts} />}
      {isLoading ? <ForecastPageSkeleton /> : forecasts.length ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[1.5rem] border border-[#F0DDE7] bg-white shadow-[0_16px_44px_rgba(31,41,55,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#F3E8EF] bg-gradient-to-r from-white via-[#FFF9FC] to-[#FFF2F8] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <div>
                <h2 className="mt-1 text-xl font-bold text-[#1F2937]">Expected Customer Visits</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="block w-full text-xs font-bold uppercase tracking-wide text-[#6B7280] sm:min-w-56 sm:w-auto">
                Branch
                <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#EBCFDE] bg-white px-3 py-2 text-sm font-bold normal-case text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/15">
                  {forecasts.map((forecast) => <option key={forecast.branch_id} value={forecast.branch_id}>{forecast.branch_name}</option>)}
                </select>
              </label><button type="button" onClick={trainModel} disabled={isTraining || isLoading} className="min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#A83F78] disabled:cursor-not-allowed disabled:opacity-60">{isTraining ? "Updating estimates…" : "Update estimates"}</button></div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-b border-[#F3E8EF] bg-white px-5 py-3 lg:px-6"><label className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">How far ahead<select aria-label="Forecast period" value={forecastPeriod} onChange={(event) => setForecastPeriod(event.target.value)} className="ml-2 min-h-9 rounded-lg border border-[#EBCFDE] bg-white px-3 text-sm font-semibold normal-case text-[#1F2937]"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label></div>
            {selectedForecast && <ForecastWorkspace key={`${selectedForecast.branch_id}-${forecastPeriod}`} forecast={selectedForecast} analysis={analysis} forecastPeriod={forecastPeriod} />}
          </section>
        </div>
      ) : <EmptyState title="No active branches" description="There are no open salon branches to show right now." />}
    </>
  );

  if (embedded) return <section aria-labelledby="owner-forecasting-title" className="mt-6">{content}</section>;

  return <OwnerWorkspace title="Customer Visit Estimates">{content}</OwnerWorkspace>;
}

function ForecastWorkspace({ forecast, analysis, forecastPeriod }) {
  const usesSampleData = forecast.data_source === "synthetic_csv";
  const predictions = forecast.predictions || [];
  const forecastTotal = predictions.reduce((sum, point) => sum + Number(point.predicted_demand || 0), 0);
  const readinessTargets = [
    forecast.readiness.history_days / 56,
    forecast.readiness.completed_appointments / 30,
    forecast.readiness.nonzero_days / 14,
  ];
  const readinessProgress = Math.round(Math.min(1, ...readinessTargets) * 100);
  const generatedAt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(forecast.generated_at));

  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#C85B95] ring-1 ring-[#F3D4E4]"><HiOutlinePresentationChartLine className="h-6 w-6" /></span>
          <div>
            <h3 className="text-lg font-bold text-[#1F2937]">{forecast.branch_name}</h3>
            <p className="mt-1 text-sm text-[#6B7280]">Updated {generatedAt}</p>
          </div>
        </div>
      </div>

      {forecast.limitation && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-[#F1D69D] bg-[#FFFBF1] p-4 text-[#8A571B]">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div><p className="text-sm font-bold">More appointment history is needed</p><p className="mt-1 text-sm leading-6">{forecast.limitation}</p></div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.65fr)]">
        <div className="min-w-0 rounded-2xl border border-[#F3E8EF] bg-[#FFFCFD] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-bold text-[#1F2937]">{forecastPeriod === "weekly" ? "Next 7 days" : forecastPeriod === "monthly" ? "Next month" : "Next year"}</p><p className="mt-1 text-xs text-[#6B7280]">{usesSampleData ? "Based on sample records" : "Based on completed appointments"}</p></div>
            <p className="text-right"><span className="block text-2xl font-bold text-[#1F2937]">{predictions.length ? forecastTotal.toFixed(0) : "—"}</span><span className="text-xs font-semibold text-[#6B7280]">{usesSampleData ? "sample visits" : "estimated visits"} across {predictions.length || 0} days</span></p>
          </div>
          <div className="mt-4"><ForecastChart historical={forecast.historical} predictions={predictions} actualLabel={usesSampleData ? "Completed sample transactions" : "Actual completed appointments"} predictedLabel={usesSampleData ? "Predicted sample transactions" : "Predicted demand"} /></div>
        </div>

        <aside className="rounded-2xl border border-[#F3E8EF] bg-white p-5" aria-label={usesSampleData ? "Sample forecast source" : "Model readiness"}>
          <div className="flex items-center gap-2"><HiOutlineCheckBadge className="h-5 w-5 text-[#C85B95]" /><h4 className="text-sm font-bold text-[#1F2937]">{usesSampleData ? "Forecast source" : "Model readiness"}</h4></div>
          {usesSampleData ? <>
            <div className="mt-5 rounded-xl bg-[#FFF8FB] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#8B7280]">Training data</p><p className="mt-1 text-sm font-bold text-[#1F2937]">3-year sample transaction CSV</p></div>
            <dl className="mt-5 space-y-3">
              <ReadinessRow label="History coverage" value={`${forecast.readiness.history_days.toLocaleString()} days`} />
              <ReadinessRow label="Sample transactions" value={forecast.readiness.completed_appointments.toLocaleString()} />
              <ReadinessRow label="Active days" value={forecast.readiness.nonzero_days.toLocaleString()} />
              <ReadinessRow label="Forecast period" value={forecast.forecast_period} />
            </dl>
            <p className="mt-5 rounded-xl bg-[#FFF8FB] p-3 text-xs leading-5 text-[#6B7280]">These generated sample transactions support the forecast only. They are not added to live sales or customer records.</p>
          </> : <>
          <div className="mt-5 flex items-end justify-between"><span className="text-sm font-bold text-[#1F2937]">Past appointment history</span><span className="text-xs font-semibold text-[#6B7280]">{readinessProgress === 100 ? "Enough to estimate" : "More history needed"}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F8EAF1]"><div className="h-full rounded-full bg-gradient-to-r from-[#E98AB8] to-[#C85B95] transition-all" style={{ width: `${readinessProgress}%` }} /></div>
          <dl className="mt-5 space-y-3">
            <ReadinessRow label="Days with records" value={forecast.readiness.history_days} />
            <ReadinessRow label="Completed appointments" value={forecast.readiness.completed_appointments} />
            <ReadinessRow label="Days with appointments" value={forecast.readiness.nonzero_days} />
            {forecast.forecast_period && <ReadinessRow label="Estimate dates" value={forecast.forecast_period} />}
          </dl>
          <p className="mt-5 rounded-xl bg-[#FFF8FB] p-3 text-xs leading-5 text-[#6B7280]">These estimates use past completed appointments. Check your bookings before changing staff schedules.</p>
          </>}
        </aside>
      </div>

      <DailyOutlook predictions={predictions} usesSampleData={usesSampleData} />
      {analysis && <TrafficAnalysis analysis={analysis} />}
    </div>
  );
}

function TrafficAnalysis({ analysis }) {
  const weekly = (analysis.weekly || []).map((row) => ({ ...row, label: new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${row.period_start}T00:00:00Z`)) }));
  const monthly = (analysis.monthly || []).map((row) => ({ ...row, label: new Intl.DateTimeFormat("en-PH", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${row.period_start}T00:00:00Z`)) }));
  const weekdays = (analysis.weekday_patterns || []).map((row) => ({ ...row, label: new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + row.weekday))) }));
  const classified = (analysis.peak_periods || []).filter((row) => row.classification !== "normal");
  return <section className="mt-6 space-y-5" aria-label="Customer visit patterns"><div className="grid gap-5 xl:grid-cols-2"><TrafficChart title="Visits by week" subtitle="Past completed appointments compared with estimated visits" data={weekly} actualKey="actual_customers" predictedKey="predicted_customers" /><TrafficChart title="Visits by month" subtitle="Past completed appointments compared with estimated visits" data={monthly} actualKey="actual_customers" predictedKey="predicted_customers" /></div><div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><TrafficChart title="Your busiest weekdays" subtitle="Average completed appointments on each day" data={weekdays} predictedKey="average_customers" /><section className="overflow-hidden rounded-2xl border border-[#F3E8EF] bg-white"><div className="border-b border-[#F3E8EF] bg-[#FFF9FC] px-5 py-4"><h3 className="text-sm font-bold text-[#1F2937]">Busier and quieter months</h3><p className="mt-1 text-xs text-[#6B7280]">Compared with what this branch usually sees in the same month.</p></div>{classified.length ? <div className="divide-y divide-[#F6EDF2]">{classified.map((period) => <div key={period.period_start} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-bold text-[#1F2937]">{period.period}</p><p className="mt-1 text-xs leading-5 text-[#6B7280]">{period.reason}</p></div><div className="text-right"><p className="text-sm font-bold text-[#1F2937]">{period.predicted_customers} expected visits</p><p className="text-xs font-semibold capitalize text-[#C85B95]">{humanTrafficLevel(period.classification)} · {period.change_percent == null ? "—" : `${Math.abs(period.change_percent)}% ${period.change_percent >= 0 ? "above" : "below"} usual`}</p></div></div>)}</div> : <p className="p-5 text-sm text-[#6B7280]">No unusually busy or quiet months were found in this estimate period. More past appointments may reveal a clearer pattern.</p>}</section></div></section>;
}

function humanTrafficLevel(level) {
  return ({ peak_season: "Much busier than usual", high_demand: "Busier than usual", low_demand: "Quieter than usual", normal: "About usual" })[level] || "About usual";
}

function TrafficChart({ title, subtitle, data, actualKey, predictedKey }) {
  return <section className="min-w-0 rounded-2xl border border-[#F3E8EF] bg-white p-4 sm:p-5"><h3 className="text-sm font-bold text-[#1F2937]">{title}</h3><p className="mt-1 text-xs text-[#6B7280]">{subtitle}</p><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}><CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#F1E4EB" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7B6570", fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7B6570", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0DDE7", fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} />{actualKey && <Bar dataKey={actualKey} name="Past visits" fill="#9B8790" radius={[5, 5, 0, 0]} />}{predictedKey && <Bar dataKey={predictedKey} name={predictedKey === "average_customers" ? "Average visits" : "Estimated visits"} fill="#D65A9A" radius={[5, 5, 0, 0]} />}</BarChart></ResponsiveContainer></div></section>;
}

function DailyOutlook({ predictions, usesSampleData }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#F3E8EF]">
      <div className="flex items-center justify-between bg-[#FFF9FC] px-4 py-3 sm:px-5"><div><h4 className="text-sm font-bold text-[#1F2937]">Daily visit estimates</h4><p className="mt-0.5 text-xs text-[#6B7280]">A simple guide for planning appointments and staff</p></div><HiOutlineClock className="h-5 w-5 text-[#C85B95]" /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="border-y border-[#F3E8EF] bg-white text-[11px] font-bold uppercase tracking-[0.12em] text-[#8B7280]"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Estimated visits</th><th className="px-5 py-3">How busy</th><th className="px-5 py-3">What to consider</th></tr></thead>
          <tbody className="divide-y divide-[#F6EDF2]">
            {!predictions.length && <tr><td colSpan="4" className="px-5 py-6 text-center text-sm text-[#6B7280]">We need more completed appointments before we can estimate future visits. Keep recording completed appointments and check again later.</td></tr>}
            {predictions.map((point) => (
              <tr key={point.date} className="bg-white transition hover:bg-[#FFFAFC]">
                <td className="whitespace-nowrap px-5 py-4"><p className="text-sm font-bold text-[#1F2937]">{formatDay(point.date)}</p><p className="mt-0.5 text-xs text-[#6B7280]">{formatDate(point.date)}</p></td>
                <td className="px-5 py-4"><span className="text-lg font-bold text-[#1F2937]">{point.predicted_demand}</span><span className="ml-1 text-xs text-[#6B7280]">{usesSampleData ? "transactions" : "appointments"}</span></td>
                <td className="px-5 py-4"><DemandBadge level={point.demand_level} /></td>
                <td className="max-w-md px-5 py-4 text-sm leading-6 text-[#6B7280]">{point.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemandBadge({ level }) {
  const styles = level === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : level === "moderate" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#ECFDF3] text-[#166534]";
  const label = level === "high" ? "Busy" : level === "moderate" ? "Steady" : "Quiet";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>{label}</span>;
}

function ReadinessRow({ label, value }) {
  return <div className="flex items-start justify-between gap-3 border-b border-[#F7EEF3] pb-3 last:border-0 last:pb-0"><dt className="text-xs text-[#6B7280]">{label}</dt><dd className="max-w-36 text-right text-xs font-bold text-[#1F2937]">{value}</dd></div>;
}

function ForecastPageSkeleton() {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[1.25rem] border border-[#F3E8EF] bg-white"><div className="m-4 h-10 w-10 rounded-xl bg-[#F8EAF1]" /><div className="mx-4 mt-5 h-4 w-2/5 rounded-full bg-[#F8EAF1]" /></div>)}</div><div className="h-[36rem] animate-pulse rounded-[1.5rem] border border-[#F3E8EF] bg-white" /></div>;
}

function localDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDay(value) {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short" }).format(localDate(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(localDate(value));
}
