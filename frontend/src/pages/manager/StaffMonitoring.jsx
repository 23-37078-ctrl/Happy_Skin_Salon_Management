import { useCallback, useEffect, useState } from "react";
import { HiOutlineChartBar, HiOutlineUsers } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

export default function StaffMonitoring() {
  const [data, setData] = useState({ demand_forecast: [], workforce_recommendations: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadForecasting = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await managerService.forecasting());
    } catch (err) {
      setError(getApiError(err, "We couldn't load forecasting recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadForecasting());
  }, [loadForecasting]);

  return (
    <ManagerWorkspace title="Demand Forecasting" eyebrow="Workforce recommendations">
      {error && <Notice message={error} onRetry={loadForecasting} />}
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Forecast Entries" value={data.demand_forecast?.length || 0} icon={HiOutlineChartBar} tone="blue" />
        <StatCard label="Recommendations" value={data.workforce_recommendations?.length || 0} icon={HiOutlineUsers} tone="pink" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={4} /> : data.workforce_recommendations?.length ? (
          <div className="space-y-3">{data.workforce_recommendations.map((item, index) => <RecommendationCard key={item.id || index} item={item} />)}</div>
        ) : <EmptyState icon={HiOutlineUsers} title="No recommendations available" description={data.message || "Forecasting and workforce recommendations will appear here when available for your assigned branch."} />}
      </section>
    </ManagerWorkspace>
  );
}

function RecommendationCard({ item }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <p className="font-bold text-[#1F2937]">{item.title || item.recommendation || "Workforce recommendation"}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.description || item.reason || "Review staffing levels for the forecasted demand."}</p>
    </article>
  );
}
