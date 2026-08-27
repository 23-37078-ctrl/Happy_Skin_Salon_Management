import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineCalendarDays, HiOutlineShieldCheck, HiOutlineUsers } from "react-icons/hi2";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination from "../../components/common/ListPagination";

const PERIODS = [
  { value: "daily", label: "Day", horizon: 1 },
  { value: "weekly", label: "Week", horizon: 7 },
  { value: "monthly", label: "Month", horizon: 31 },
  { value: "yearly", label: "Year", horizon: 365 },
];
const PAGE_SIZE = 12;

export default function WorkforcePage() {
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
      const branchPayload = await ownerService.branches();
      const active = (branchPayload.branches || []).filter((branch) => branch.is_active);
      const payloads = await Promise.all(active.map(async (branch) => ({ branch, forecast: await forecastService.branchForecast(branch.id, horizon) })));
      setBranches(payloads);
    } catch (err) {
      setError(getApiError(err, "We couldn't load operational recommendations."));
    } finally {
      setIsLoading(false);
    }
  }, [horizon]);

  useEffect(() => { Promise.resolve().then(loadRecommendations); }, [loadRecommendations]);

  const recommendations = useMemo(() => branches.flatMap(({ branch, forecast }) => forecast.predictions.map((point) => ({ ...point, branch_name: branch.name, data_quality: forecast.data_quality }))), [branches]);
  const filteredRecommendations = useMemo(() => selectedDate ? recommendations.filter((item) => String(item.date).slice(0, 10) === selectedDate) : recommendations, [recommendations, selectedDate]);
  const visibleRecommendations = useMemo(() => filteredRecommendations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredRecommendations, page]);
  useEffect(() => { setPage(1); }, [period, selectedDate]);
  return (
    <OwnerWorkspace title="Capacity Review" eyebrow="Forecast-informed recommendations" headerStats={[{ label: "Branches", value: branches.length, icon: HiOutlineShieldCheck, tone: "pink" }, { label: "Review Days", value: recommendations.filter((item) => item.demand_level === "high").length, icon: HiOutlineUsers, tone: "amber" }, { label: "Validated Branches", value: branches.filter(({ forecast }) => forecast.data_quality === "sufficient").length, icon: HiOutlineShieldCheck, tone: "green" }]}>
      {error && <Notice message={error} onRetry={loadRecommendations} />}
      <p className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-sm leading-6 text-[#1E40AF]">Exact staffing numbers are not calculated because staff schedules, working hours, and service qualifications are not recorded. Recommendations require manager review.</p>
      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#C85B95]">Forecast period</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PERIODS.map((item) => <button key={item.value} type="button" onClick={() => { setPeriod(item.value); setSelectedDate(""); }} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${period === item.value ? "bg-[#C85B95] text-white shadow-sm" : "border border-[#F3E8EF] bg-[#FFF8FB] text-[#6B7280] hover:text-[#C85B95]"}`}>{item.label}</button>)}</div></div><div><p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#C85B95]"><HiOutlineCalendarDays className="h-4 w-4" /> Specific date</p><ModernDatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Filter forecast date" ariaLabel="Filter workforce forecast by date" /></div></div>
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : filteredRecommendations.length ? (<>
          <div className="grid gap-4 lg:grid-cols-2">{visibleRecommendations.map((item) => (
            <article key={`${item.branch_name}-${item.date}`} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-[#1F2937]">{item.branch_name}</p><p className="mt-1 text-sm text-[#6B7280]">{item.date} • predicted demand {item.predicted_demand}</p></div><span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{item.demand_level}</span></div>
              <p className="mt-4 text-sm leading-6 text-[#6B7280]">{item.recommendation}</p>
            </article>
          ))}</div><ListPagination page={page} pageSize={PAGE_SIZE} totalItems={filteredRecommendations.length} onPageChange={setPage} itemLabel="workforce recommendations" /></>
        ) : <EmptyState title="No recommendations" description={selectedDate ? "No workforce forecast is available for the selected date and period." : "Recommendations appear when active branches can be evaluated."} />}
      </section>
    </OwnerWorkspace>
  );
}
