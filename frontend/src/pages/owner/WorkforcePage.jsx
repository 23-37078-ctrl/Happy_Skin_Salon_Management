import { useCallback, useEffect, useState } from "react";
import { HiOutlineShieldCheck, HiOutlineUsers } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

export default function WorkforcePage() {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkforce = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.workforce();
      setRecommendations(payload.recommendations || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load workforce recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadWorkforce());
  }, [loadWorkforce]);

  return (
    <OwnerWorkspace title="Workforce Planning" eyebrow="Rule-based staffing recommendations">
      {error && <Notice message={error} onRetry={loadWorkforce} />}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Branches" value={recommendations.length} icon={HiOutlineShieldCheck} tone="pink" />
        <StatCard label="Suggested Staff" value={recommendations.reduce((sum, item) => sum + Number(item.recommended_staff || 0), 0)} icon={HiOutlineUsers} tone="blue" />
        <StatCard label="High Demand" value={recommendations.filter((item) => item.demand_level === "high").length} icon={HiOutlineUsers} tone="red" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : recommendations.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.map((item) => (
              <article key={item.branch_id} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[#1F2937]">{item.branch}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">Forecast: {item.forecast_bookings} bookings in the next 7 days</p>
                  </div>
                  <span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{item.demand_level}</span>
                </div>
                <div className="mt-5 rounded-xl bg-[#FFF8FB] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">Recommended staff</p>
                  <p className="mt-1 text-3xl font-bold text-[#1F2937]">{item.recommended_staff}</p>
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">{item.recommendation}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No workforce recommendations" description="Recommendations are generated from branch demand forecasts and staffing rules." />}
      </section>
    </OwnerWorkspace>
  );
}
