import { useCallback, useEffect, useState } from "react";
import { HiOutlineShieldCheck, HiOutlineUsers } from "react-icons/hi2";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

export default function WorkforcePage() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const branchPayload = await ownerService.branches();
      const active = (branchPayload.branches || []).filter((branch) => branch.is_active);
      const payloads = await Promise.all(active.map(async (branch) => ({ branch, forecast: await forecastService.branchForecast(branch.id) })));
      setBranches(payloads);
    } catch (err) {
      setError(getApiError(err, "We couldn't load operational recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(loadRecommendations); }, [loadRecommendations]);

  const recommendations = branches.flatMap(({ branch, forecast }) => forecast.predictions.map((point) => ({ ...point, branch_name: branch.name, data_quality: forecast.data_quality })));
  return (
    <OwnerWorkspace title="Capacity Review" eyebrow="Forecast-informed recommendations">
      {error && <Notice message={error} onRetry={loadRecommendations} />}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Branches" value={branches.length} icon={HiOutlineShieldCheck} tone="pink" />
        <StatCard label="Review Days" value={recommendations.filter((item) => item.demand_level === "high").length} icon={HiOutlineUsers} tone="amber" />
        <StatCard label="Validated Branches" value={branches.filter(({ forecast }) => forecast.data_quality === "sufficient").length} icon={HiOutlineShieldCheck} tone="green" />
      </section>
      <p className="mt-5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1E40AF]">Exact staffing numbers are not calculated because staff schedules, working hours, and service qualifications are not recorded. Recommendations require manager review.</p>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : recommendations.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{recommendations.map((item) => (
            <article key={`${item.branch_name}-${item.date}`} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[#1F2937]">{item.branch_name}</p><p className="mt-1 text-sm text-[#6B7280]">{item.date} • predicted demand {item.predicted_demand}</p></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{item.demand_level}</span></div>
              <p className="mt-4 text-sm leading-6 text-[#6B7280]">{item.recommendation}</p>
            </article>
          ))}</div>
        ) : <EmptyState title="No recommendations" description="Recommendations appear when active branches can be evaluated." />}
      </section>
    </OwnerWorkspace>
  );
}
