import { useCallback, useEffect, useState } from "react";
import { HiOutlineChartBar, HiOutlinePresentationChartLine } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

export default function ForcastingPage() {
  const [forecasts, setForecasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadForecasts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.forecasting();
      setForecasts(payload.forecasts || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load demand forecasting."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadForecasts());
  }, [loadForecasts]);

  const highDemand = forecasts.filter((item) => item.demand_level === "high").length;
  const totalForecast = forecasts.reduce((sum, item) => sum + Number(item.forecast_bookings || 0), 0);

  return (
    <OwnerWorkspace title="Demand Forecasting" eyebrow="Short-term branch demand analytics">
      {error && <Notice message={error} onRetry={loadForecasts} />}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Branches Analyzed" value={forecasts.length} icon={HiOutlinePresentationChartLine} tone="pink" />
        <StatCard label="7-Day Forecast" value={totalForecast.toFixed(1)} icon={HiOutlineChartBar} tone="blue" />
        <StatCard label="High Demand" value={highDemand} icon={HiOutlineChartBar} tone="red" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : forecasts.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {forecasts.map((item) => <ForecastCard key={item.branch_id} item={item} />)}
          </div>
        ) : <EmptyState title="No forecasting data" description="Forecasting uses recent booking records to estimate short-term branch demand." />}
      </section>
    </OwnerWorkspace>
  );
}

function ForecastCard({ item }) {
  const color = item.demand_level === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : item.demand_level === "moderate" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#DCFCE7] text-[#166534]";
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[#1F2937]">{item.branch}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{item.method}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${color}`}>{item.demand_level}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="30-Day Bookings" value={item.historical_bookings || 0} />
        <Metric label="Next 7 Days" value={item.forecast_bookings || 0} />
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p><p className="mt-1 text-2xl font-bold text-[#1F2937]">{value}</p></div>;
}
