import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineCheckBadge,
  HiOutlineCircleStack,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlinePresentationChartLine,
  HiOutlineSparkles,
} from "react-icons/hi2";
import ForecastChart from "../../assets/components/forecasting/ForecastChart";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";

const toneStyles = {
  pink: "bg-[#FFF0F7] text-[#C85B95] ring-[#F3D4E4]",
  blue: "bg-[#EFF6FF] text-[#2563EB] ring-[#DBEAFE]",
  green: "bg-[#ECFDF3] text-[#15803D] ring-[#D1FAE5]",
  amber: "bg-[#FFF8E7] text-[#C46A14] ring-[#FDECC8]",
};

export default function ForcastingPage() {
  const [forecasts, setForecasts] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadForecasts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const branchPayload = await ownerService.branches();
      const activeBranches = (branchPayload.branches || []).filter((branch) => branch.is_active);
      const results = await Promise.all(activeBranches.map((branch) => forecastService.branchForecast(branch.id)));
      setForecasts(results);
      setSelectedBranchId((current) => results.some((item) => String(item.branch_id) === String(current)) ? current : String(results[0]?.branch_id || ""));
    } catch (err) {
      setError(getApiError(err, "We couldn't load demand forecasting."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadForecasts);
  }, [loadForecasts]);

  const trainModel = async () => {
    setIsTraining(true);
    setError("");
    setMessage("");
    try {
      const result = await forecastService.train();
      setMessage(`${result.model} ${result.version} trained successfully.`);
      await loadForecasts();
    } catch (err) {
      setError(getApiError(err, "Model training could not be completed."));
    } finally {
      setIsTraining(false);
    }
  };

  const selectedForecast = useMemo(
    () => forecasts.find((item) => String(item.branch_id) === String(selectedBranchId)) || forecasts[0] || null,
    [forecasts, selectedBranchId],
  );

  const summary = useMemo(() => {
    const points = forecasts.flatMap((item) => item.predictions || []);
    return {
      total: points.reduce((sum, point) => sum + Number(point.predicted_demand || 0), 0),
      high: points.filter((point) => point.demand_level === "high").length,
      validated: forecasts.filter((item) => item.data_quality === "sufficient").length,
      insufficient: forecasts.filter((item) => item.data_quality !== "sufficient").length,
    };
  }, [forecasts]);

  const actions = (
    <>
      <button type="button" onClick={loadForecasts} disabled={isLoading || isTraining} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#EBCFDE] bg-white px-4 py-2 text-sm font-bold text-[#6B3F5D] transition hover:border-[#D65A9A] hover:bg-[#FFF8FB] disabled:cursor-not-allowed disabled:opacity-60">
        <HiOutlineArrowPath className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </button>
      <button type="button" onClick={trainModel} disabled={isTraining || isLoading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86] disabled:cursor-not-allowed disabled:opacity-60">
        <HiOutlineSparkles className={`h-5 w-5 ${isTraining ? "animate-pulse" : ""}`} />
        {isTraining ? "Training model..." : "Train model"}
      </button>
    </>
  );

  return (
    <OwnerWorkspace title="Demand Forecasting" eyebrow="Decision intelligence · next seven days" actions={actions}>
      {error && <Notice message={error} onRetry={loadForecasts} />}
      {message && <Notice message={message} tone="success" />}

      {isLoading ? <ForecastPageSkeleton /> : forecasts.length ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Forecast overview">
            <KpiCard icon={HiOutlinePresentationChartLine} label="Active branches" value={forecasts.length} helper={`${summary.validated} using a validated model`} tone="pink" />
            <KpiCard icon={HiOutlineCalendarDays} label="Expected demand" value={summary.total.toFixed(1)} helper="Completed appointments · 7 days" tone="blue" />
            <KpiCard icon={HiOutlineChartBar} label="High-demand days" value={summary.high} helper="Review capacity on these dates" tone="green" />
            <KpiCard icon={HiOutlineCircleStack} label="Data attention" value={summary.insufficient} helper="Branches below training threshold" tone="amber" />
          </section>

          <section className="overflow-hidden rounded-[1.5rem] border border-[#F0DDE7] bg-white shadow-[0_16px_44px_rgba(31,41,55,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#F3E8EF] bg-gradient-to-r from-white via-[#FFF9FC] to-[#FFF2F8] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C85B95]">Forecast workspace</p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2937]">Branch demand outlook</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Compare recent completed appointments with the next seven-day outlook.</p>
              </div>
              <label className="block min-w-56 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                Branch
                <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#EBCFDE] bg-white px-3 py-2 text-sm font-bold normal-case text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/15">
                  {forecasts.map((forecast) => <option key={forecast.branch_id} value={forecast.branch_id}>{forecast.branch_name}</option>)}
                </select>
              </label>
            </div>
            {selectedForecast && <ForecastWorkspace forecast={selectedForecast} />}
          </section>
        </div>
      ) : <EmptyState title="No active branches" description="Create an active branch before generating forecasts." />}
    </OwnerWorkspace>
  );
}

function ForecastWorkspace({ forecast }) {
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
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6B7280]"><span>{forecast.model}</span><span className="text-[#D8B5C7]">•</span><span>Updated {generatedAt}</span></p>
          </div>
        </div>
        <QualityBadge quality={forecast.data_quality} />
      </div>

      {forecast.limitation && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-[#F1D69D] bg-[#FFFBF1] p-4 text-[#8A571B]">
          <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div><p className="text-sm font-bold">Forecast confidence is limited</p><p className="mt-1 text-sm leading-6">{forecast.limitation}</p></div>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.65fr)]">
        <div className="min-w-0 rounded-2xl border border-[#F3E8EF] bg-[#FFFCFD] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-bold text-[#1F2937]">Actual vs predicted demand</p><p className="mt-1 text-xs text-[#6B7280]">Daily completed appointments</p></div>
            <p className="text-right"><span className="block text-2xl font-bold text-[#1F2937]">{forecastTotal.toFixed(1)}</span><span className="text-xs font-semibold text-[#6B7280]">7-day forecast</span></p>
          </div>
          <div className="mt-4"><ForecastChart historical={forecast.historical} predictions={predictions} /></div>
        </div>

        <aside className="rounded-2xl border border-[#F3E8EF] bg-white p-5" aria-label="Model readiness">
          <div className="flex items-center gap-2"><HiOutlineCheckBadge className="h-5 w-5 text-[#C85B95]" /><h4 className="text-sm font-bold text-[#1F2937]">Model readiness</h4></div>
          <div className="mt-5 flex items-end justify-between"><span className="text-3xl font-bold text-[#1F2937]">{readinessProgress}%</span><span className="text-xs font-semibold text-[#6B7280]">minimum threshold</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F8EAF1]"><div className="h-full rounded-full bg-gradient-to-r from-[#E98AB8] to-[#C85B95] transition-all" style={{ width: `${readinessProgress}%` }} /></div>
          <dl className="mt-5 space-y-3">
            <ReadinessRow label="History coverage" value={`${forecast.readiness.history_days} / 56 days`} />
            <ReadinessRow label="Completed records" value={`${forecast.readiness.completed_appointments} / 30`} />
            <ReadinessRow label="Active demand days" value={`${forecast.readiness.nonzero_days} / 14`} />
            <ReadinessRow label="Forecast period" value={forecast.forecast_period} />
          </dl>
          <p className="mt-5 rounded-xl bg-[#FFF8FB] p-3 text-xs leading-5 text-[#6B7280]">Predictions support planning decisions. Confirm staffing and appointment capacity manually.</p>
        </aside>
      </div>

      <DailyOutlook predictions={predictions} />
    </div>
  );
}

function DailyOutlook({ predictions }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#F3E8EF]">
      <div className="flex items-center justify-between bg-[#FFF9FC] px-4 py-3 sm:px-5"><div><h4 className="text-sm font-bold text-[#1F2937]">Daily operational outlook</h4><p className="mt-0.5 text-xs text-[#6B7280]">Recommended actions by forecast date</p></div><HiOutlineClock className="h-5 w-5 text-[#C85B95]" /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="border-y border-[#F3E8EF] bg-white text-[11px] font-bold uppercase tracking-[0.12em] text-[#8B7280]"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Expected</th><th className="px-5 py-3">Demand level</th><th className="px-5 py-3">Planning guidance</th></tr></thead>
          <tbody className="divide-y divide-[#F6EDF2]">
            {predictions.map((point) => (
              <tr key={point.date} className="bg-white transition hover:bg-[#FFFAFC]">
                <td className="whitespace-nowrap px-5 py-4"><p className="text-sm font-bold text-[#1F2937]">{formatDay(point.date)}</p><p className="mt-0.5 text-xs text-[#6B7280]">{formatDate(point.date)}</p></td>
                <td className="px-5 py-4"><span className="text-lg font-bold text-[#1F2937]">{point.predicted_demand}</span><span className="ml-1 text-xs text-[#6B7280]">appointments</span></td>
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

function KpiCard({ icon: Icon, label, value, helper, tone }) {
  return (
    <article className="group rounded-[1.25rem] border border-[#F0DDE7] bg-white p-4 shadow-[0_10px_30px_rgba(31,41,55,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(31,41,55,0.07)]">
      <div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${toneStyles[tone] || toneStyles.pink}`}><Icon className="h-5 w-5" /></span><span className="h-2 w-2 rounded-full bg-[#F3D4E4] transition group-hover:bg-[#D65A9A]" /></div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-[#1F2937]">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-[#7B6570]">{label}</p><p className="mt-2 text-xs leading-5 text-[#9A8791]">{helper}</p>
    </article>
  );
}

function QualityBadge({ quality }) {
  const sufficient = quality === "sufficient";
  return <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${sufficient ? "bg-[#ECFDF3] text-[#166534] ring-[#BBF7D0]" : "bg-[#FFF8E7] text-[#9A5B13] ring-[#F4D7A1]"}`}><span className={`h-2 w-2 rounded-full ${sufficient ? "bg-[#22C55E]" : "bg-[#F59E0B]"}`} />{sufficient ? "Validated model" : "Fallback · limited data"}</span>;
}

function DemandBadge({ level }) {
  const styles = level === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : level === "moderate" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#ECFDF3] text-[#166534]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${styles}`}>{level}</span>;
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
