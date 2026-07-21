import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineChartBar, HiOutlineUsers } from "react-icons/hi2";
import ForecastChart from "../../assets/components/forecasting/ForecastChart";
import { useAuth } from "../../hooks/useAuth";
import forecastService from "../../services/forecastService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

export default function StaffMonitoring() {
  const { currentUser } = useAuth();
  const branchId = currentUser?.branch_id;
  const [forecast, setForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadForecasting = useCallback(async () => {
    if (!branchId) {
      setError("Your manager account is not assigned to a branch.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      setForecast(await forecastService.branchForecast(branchId));
    } catch (err) {
      setError(getApiError(err, "We couldn't load forecasting recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    Promise.resolve().then(loadForecasting);
  }, [loadForecasting]);

  const total = useMemo(() => forecast?.predictions?.reduce((sum, point) => sum + Number(point.predicted_demand || 0), 0) || 0, [forecast]);

  return (
    <ManagerWorkspace title="Demand Forecasting" eyebrow="Branch decision support">
      {error && <Notice message={error} onRetry={loadForecasting} />}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="7-Day Demand" value={total.toFixed(1)} icon={HiOutlineChartBar} tone="blue" />
        <StatCard label="Completed History" value={forecast?.readiness?.completed_appointments || 0} icon={HiOutlineUsers} tone="pink" />
        <StatCard label="Data Status" value={forecast?.data_quality || "—"} icon={HiOutlineChartBar} tone={forecast?.data_quality === "sufficient" ? "green" : "amber"} />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={4} /> : forecast ? (
          <div className="space-y-5">
            <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-bold text-[#1F2937]">{forecast.branch_name}</h2><p className="mt-1 text-sm text-[#6B7280]">{forecast.model} • {forecast.forecast_period}</p></div>
                <span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{forecast.data_quality}</span>
              </div>
              {forecast.limitation && <p className="mt-4 rounded-xl border border-[#F59E0B]/20 bg-[#FFFBEB] p-3 text-sm leading-6 text-[#92400E]">{forecast.limitation}</p>}
              <div className="mt-5"><ForecastChart historical={forecast.historical} predictions={forecast.predictions} /></div>
            </article>
            <div className="grid gap-3 lg:grid-cols-2">
              {forecast.predictions.map((point) => <RecommendationCard key={point.date} item={point} />)}
            </div>
          </div>
        ) : <EmptyState icon={HiOutlineUsers} title="No forecast available" description="Forecasting will appear when an active branch and operational records are available." />}
      </section>
    </ManagerWorkspace>
  );
}

function RecommendationCard({ item }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex items-center justify-between gap-3"><p className="font-bold text-[#1F2937]">{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p><span className="text-sm font-bold capitalize text-[#D65A9A]">{item.demand_level}</span></div>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">Predicted demand: {item.predicted_demand} completed appointments.</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.recommendation}</p>
    </article>
  );
}
