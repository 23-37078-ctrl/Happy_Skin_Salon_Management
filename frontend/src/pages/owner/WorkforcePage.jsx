import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineCalendarDays, HiOutlineShieldCheck, HiOutlineUsers } from "react-icons/hi2";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";
import { useAuth } from "../../hooks/useAuth";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";
import { ManagerWorkspace } from "../manager/ManagerWorkspace";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination from "../../components/common/ListPagination";

const PERIODS = [
  { value: "daily", label: "Day", horizon: 1 },
  { value: "weekly", label: "Week", horizon: 7 },
  { value: "monthly", label: "Month", horizon: 31 },
  { value: "yearly", label: "Year", horizon: 365 },
];
const PAGE_SIZE = 12;

export default function WorkforcePage({ embedded = false, table = false }) {
  const { currentUser } = useAuth();
  const Workspace = embedded ? EmbeddedWorkspace : currentUser?.role === "manager" ? ManagerWorkspace : OwnerWorkspace;
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("weekly");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const horizon = PERIODS.find((item) => item.value === period)?.horizon || 7;

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const active = currentUser?.role === "owner"
        ? ((await ownerService.branches()).branches || []).filter((branch) => branch.is_active)
        : currentUser?.branch_id ? [{ id: currentUser.branch_id, name: currentUser.branch_name || "My branch", is_active: true }] : [];
      const payloads = await Promise.all(active.map(async (branch) => ({ branch, forecast: await forecastService.branchForecast(branch.id, horizon) })));
      setBranches(payloads);
    } catch (err) {
      setError(getApiError(err, "We couldn't load operational recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, [horizon, currentUser]);

  useEffect(() => { Promise.resolve().then(loadRecommendations); }, [loadRecommendations]);

  const recommendations = useMemo(() => branches.flatMap(({ branch, forecast }) => forecast.predictions.map((point) => ({ ...point, branch_name: forecast.branch_name || branch.name, data_quality: forecast.data_quality, model: forecast.model, limitation: forecast.limitation }))), [branches]);
  const filteredRecommendations = useMemo(() => selectedDate ? recommendations.filter((item) => String(item.date).slice(0, 10) === selectedDate) : recommendations, [recommendations, selectedDate]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filteredRecommendations.length / PAGE_SIZE)));
  const visibleRecommendations = useMemo(() => filteredRecommendations.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredRecommendations, safePage]);
  return (
    <Workspace title="Demand & capacity" eyebrow="Forecast-informed staffing and service planning" headerStats={[{ label: "Branches", value: branches.length, icon: HiOutlineShieldCheck, tone: "pink" }, { label: "High Demand Days", value: recommendations.filter((item) => item.demand_level === "high").length, icon: HiOutlineUsers, tone: "amber" }, { label: "Validated Branches", value: branches.filter(({ forecast }) => forecast.data_quality === "sufficient").length, icon: HiOutlineShieldCheck, tone: "green" }]}>
      {embedded && <div className="mb-4"><h2 className="text-lg font-bold text-[#1F2937]">Demand &amp; capacity</h2><p className="mt-1 text-xs text-[#6B7280]">Expected appointments and staffing suggestions for your branch.</p></div>}
      {error && <Notice message={error} onRetry={loadRecommendations} />}
      <section className={`${embedded ? "mt-4" : "mt-5"} rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#C85B95]">Forecast period</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PERIODS.map((item) => <button key={item.value} type="button" onClick={() => { setPeriod(item.value); setSelectedDate(""); }} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${period === item.value ? "bg-[#C85B95] text-white shadow-sm" : "border border-[#F3E8EF] bg-[#FFF8FB] text-[#6B7280] hover:text-[#C85B95]"}`}>{item.label}</button>)}</div></div><div><p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#C85B95]"><HiOutlineCalendarDays className="h-4 w-4" /> Specific date</p><ModernDatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Filter forecast date" ariaLabel="Filter workforce forecast by date" /></div></div>
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : filteredRecommendations.length ? (<>
          {table ? <div className="overflow-x-auto rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#FFF8FB] text-xs uppercase tracking-wide text-[#6B7280]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Demand</th><th className="px-4 py-3">Expected appointments</th><th className="px-4 py-3">Staff estimate</th><th className="px-4 py-3">Suggested service slots</th></tr></thead><tbody className="divide-y divide-[#F3E8EF]">{visibleRecommendations.map((item) => <tr key={`${item.branch_name}-${item.date}`} className="align-top"><td className="px-4 py-3"><p className="font-bold text-[#1F2937]">{item.date}</p><p className="mt-1 text-xs text-[#6B7280]">{item.branch_name}</p></td><td className="px-4 py-3"><span className="rounded-full bg-[#FFF0F7] px-2.5 py-1 text-xs font-bold capitalize text-[#C85B95]">{item.demand_level}</span></td><td className="px-4 py-3 font-semibold text-[#374151]">{Number(item.predicted_demand || 0).toFixed(1)}</td><td className="px-4 py-3"><p className="font-bold text-[#374151]">{item.recommended_staff_count ?? 0} needed</p><p className="mt-1 text-xs text-[#6B7280]">{item.active_staff_count ?? 0} active · {item.staffing_gap ?? 0} additional</p></td><td className="max-w-md px-4 py-3">{item.service_capacity?.length ? <ul className="space-y-1 text-xs text-[#475467]">{item.service_capacity.slice(0, 5).map((service) => <li key={service.service_id} className="flex justify-between gap-3"><span className="truncate">{service.service_name}</span><strong className="shrink-0">{service.suggested_slots} slots</strong></li>)}</ul> : <span className="text-xs text-[#667085]">No service history</span>}{item.service_capacity?.length > 5 && <p className="mt-1 text-[11px] font-semibold text-[#C85B95]">+{item.service_capacity.length - 5} more services</p>}<p className="mt-2 text-[11px] leading-4 text-[#667085]">{item.recommendation}</p></td></tr>)}</tbody></table></div> : <div className="grid gap-4 lg:grid-cols-2">{visibleRecommendations.map((item) => (
            <article key={`${item.branch_name}-${item.date}`} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-[#1F2937]">{item.branch_name}</p><p className="mt-1 text-sm text-[#6B7280]">{item.date} • predicted demand {item.predicted_demand}</p></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{item.demand_level}</span></div>
              <p className="mt-4 text-sm leading-6 text-[#6B7280]">{item.recommendation}</p>
              <p className="mt-2 text-[11px] text-[#667085]">Forecast method: {item.model || "Unavailable"}{item.data_quality !== "sufficient" ? ` · ${item.limitation || "Limited historical data; treat as an estimate."}` : ""}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Staff planning estimate</p><p className="mt-1 text-sm font-extrabold text-[#374151]">{item.recommended_staff_count ?? 0} needed · {item.active_staff_count ?? 0} active · {item.staffing_gap ?? 0} additional</p></div>
                <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Suggested service slots (includes 20% buffer)</p>{item.service_capacity?.length ? <ul className="mt-1 space-y-1 text-xs text-[#475467]">{item.service_capacity.map((service) => <li key={service.service_id} className="flex justify-between gap-2"><span>{service.service_name} · expected {service.expected_bookings}</span><strong>{service.suggested_slots} slots</strong></li>)}</ul> : <p className="mt-1 text-xs text-[#667085]">No recent completed service history for this date.</p>}</div>
              </div>
            </article>
          ))}</div>}<ListPagination page={page} pageSize={PAGE_SIZE} totalItems={filteredRecommendations.length} onPageChange={setPage} itemLabel="workforce recommendations" /></>
        ) : <EmptyState title="No recommendations" description={selectedDate ? "No workforce forecast is available for the selected date and period." : "Recommendations appear when active branches can be evaluated."} />}
      </section>
    </Workspace>
  );
}

function EmbeddedWorkspace({ children }) {
  return <section className="mt-6">{children}</section>;
}
