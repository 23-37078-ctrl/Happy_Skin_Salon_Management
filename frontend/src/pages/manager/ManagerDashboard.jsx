import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineBanknotes, HiOutlineCalendarDays, HiOutlineCheckCircle, HiOutlineClock, HiOutlineMapPin, HiOutlineSparkles, HiOutlineStar, HiOutlineTrophy, HiOutlineXMark } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice } from "./ManagerWorkspace";

const periods = ["weekly", "monthly", "yearly"];

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState({ demand_forecast: [], workforce_recommendations: [] });
  const [performance, setPerformance] = useState(null);
  const [period, setPeriod] = useState("weekly");
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [error, setError] = useState("");
  const [performanceError, setPerformanceError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      const [dashboardPayload, forecastPayload] = await Promise.all([managerService.dashboard(), managerService.forecasting()]);
      setData(dashboardPayload); setForecast(forecastPayload || { demand_forecast: [], workforce_recommendations: [] });
    } catch (err) { setError(getApiError(err, "We couldn't load the manager dashboard.")); }
    finally { setIsLoading(false); }
  }, []);

  const loadPerformance = useCallback(async () => {
    setPerformanceLoading(true); setPerformanceError("");
    try { setPerformance(await managerService.dashboardPerformance(period)); }
    catch (err) { setPerformanceError(getApiError(err, "We couldn't load branch performance.")); }
    finally { setPerformanceLoading(false); }
  }, [period]);

  useEffect(() => { Promise.resolve().then(loadDashboard); }, [loadDashboard]);
  useEffect(() => { Promise.resolve().then(loadPerformance); }, [loadPerformance]);

  const stats = useMemo(() => {
    const source = data?.stats || {};
    return [
      { label: "Today's Bookings", value: source.today_bookings || 0, icon: HiOutlineCalendarDays, tone: "pink" },
      { label: "Completed", value: source.completed_bookings || 0, icon: HiOutlineCheckCircle, tone: "green" },
      { label: "Total Sales", value: formatCurrency(source.total_sales), icon: HiOutlineBanknotes, tone: "blue" },
      { label: "Pending", value: source.pending_bookings || 0, icon: HiOutlineClock, tone: "amber" },
    ];
  }, [data]);

  return (
    <ManagerWorkspace title="Manager Dashboard" eyebrow={data?.branch?.name || "Assigned branch"} brandOnly headerStats={stats}>
      {error && <Notice message={error} onRetry={loadDashboard} />}
      {performanceError && <Notice message={performanceError} onRetry={loadPerformance} />}
      <PerformanceWorkspace data={performance} loading={performanceLoading} period={period} onPeriod={setPeriod} onStaff={setSelectedStaff} />

      <section className="mt-6">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#1F2937]">Demand Forecast</h2><p className="mt-1 text-xs text-[#6B7280]">Staffing and demand guidance for this assigned branch.</p></div>
        {isLoading ? <CardSkeleton rows={2} /> : forecast.workforce_recommendations?.length || forecast.demand_forecast?.length ? <div className="grid gap-4 lg:grid-cols-2">{(forecast.demand_forecast || []).slice(0, 2).map((item, index) => <ForecastCard key={item.id || index} item={item} type="Demand" />)}{(forecast.workforce_recommendations || []).slice(0, 2).map((item, index) => <ForecastCard key={item.id || index} item={item} type="Workforce" />)}</div> : <EmptyState icon={HiOutlineSparkles} title="No forecast available" description={forecast.message || "Forecasts will appear as branch activity grows."} />}
      </section>
      {selectedStaff && <StaffDrawer staff={selectedStaff} period={period} onClose={() => setSelectedStaff(null)} />}
    </ManagerWorkspace>
  );
}

function PerformanceWorkspace({ data, loading, period, onPeriod, onStaff }) {
  const summary = data?.summary || {};
  return <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C9558F]">Assigned branch performance</p><h2 className="mt-1 text-xl font-extrabold text-[#1F2937]">{data?.branch?.name || "Branch performance"}</h2><p className="mt-1 inline-flex items-center gap-1 text-xs text-[#6B7280]"><HiOutlineMapPin className="h-4 w-4 text-[#D65A9A]" /> {data?.branch?.address || "Your assigned branch only"}</p></div><div className="flex rounded-xl bg-[#FFF8FB] p-1 ring-1 ring-[#F3E8EF]">{periods.map((item) => <button key={item} type="button" onClick={() => onPeriod(item)} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${period === item ? "bg-[#C9558F] text-white shadow-sm" : "text-[#6B7280] hover:text-[#C9558F]"}`}>{item}</button>)}</div></div>
    {loading ? <div className="mt-5"><CardSkeleton rows={3} /></div> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Bookings" value={summary.bookings || 0} /><Metric label="Completed" value={summary.completed || 0} /><Metric label="Completion rate" value={`${summary.completion_rate || 0}%`} /><Metric label="Sales" value={formatCurrency(summary.sales)} /><Metric label="Branch rating" value={summary.average_rating ? `${summary.average_rating}/5` : "—"} /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div><h3 className="mb-3 font-bold text-[#1F2937]">Top services</h3><div className="space-y-2">{data?.services?.length ? data.services.map((service, index) => <div key={service.name} className="flex items-center gap-3 rounded-xl bg-[#FFF8FB] p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-extrabold text-[#C9558F]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-[#374151]">{service.name}</span><span className="text-xs font-semibold text-[#6B7280]">{service.bookings} bookings</span></div>) : <p className="rounded-xl bg-[#FFF8FB] p-5 text-center text-sm text-[#6B7280]">No service activity this period.</p>}</div></div>
        <div><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-[#1F2937]">Staff performance</h3><span className="text-xs text-[#6B7280]">Click a staff member for details</span></div><div className="grid gap-3 md:grid-cols-2">{data?.staff?.length ? data.staff.map((staff, index) => <button key={staff.staff_id} type="button" onClick={() => onStaff(staff)} className="rounded-xl border border-[#F3E8EF] p-3 text-left transition hover:border-[#D65A9A]/40 hover:bg-[#FFF8FB]"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFF0F7] font-extrabold text-[#C9558F]">{staff.full_name.slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#1F2937]">{staff.full_name}</p><p className="truncate text-[10px] text-[#6B7280]">{staff.job_title}</p></div></div>{index === 0 && staff.services_completed > 0 && <HiOutlineTrophy className="h-5 w-5 text-[#D97706]" />}</div><div className="mt-3 grid grid-cols-3 gap-1 text-center"><MiniMetric value={staff.services_completed} label="Services" /><MiniMetric value={formatCurrency(staff.revenue)} label="Revenue" /><MiniMetric value={staff.average_rating || "—"} label="Rating" /></div></button>) : <p className="rounded-xl bg-[#FFF8FB] p-5 text-center text-sm text-[#6B7280] md:col-span-2">No staff activity this period.</p>}</div></div>
      </div>
    </>}
  </section>;
}

function Metric({ label, value }) { return <div className="rounded-xl bg-[#FFF8FB] p-3 ring-1 ring-[#F3E8EF]"><p className="text-lg font-extrabold text-[#1F2937]">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-[#6B7280]">{label}</p></div>; }
function MiniMetric({ label, value }) { return <div className="rounded-lg bg-[#FFF8FB] p-2"><p className="truncate text-xs font-extrabold text-[#1F2937]">{value}</p><p className="mt-1 text-[8px] uppercase text-[#6B7280]">{label}</p></div>; }

function StaffDrawer({ staff, period, onClose }) {
  return <div className="fixed inset-0 z-[230] bg-[#172033]/30 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside role="dialog" aria-modal="true" aria-label={`${staff.full_name} performance`} className="ml-auto flex h-full w-full max-w-md flex-col bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFF0F7] text-lg font-extrabold text-[#C9558F]">{staff.full_name.slice(0, 1)}</span><div><h2 className="font-extrabold text-[#1F2937]">{staff.full_name}</h2><p className="text-xs text-[#6B7280]">{staff.job_title}</p></div></div><button type="button" onClick={onClose} aria-label="Close staff details" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-6 w-6" /></button></div><span className="mt-5 self-start rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C9558F]">{period} performance</span><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Services completed" value={staff.services_completed} /><Metric label="Revenue generated" value={formatCurrency(staff.revenue)} /><Metric label="Commission earned" value={formatCurrency(staff.commission)} /><Metric label="Repeat clients" value={staff.repeat_clients} /><Metric label="Average rating" value={staff.average_rating ? `${staff.average_rating}/5` : "—"} /><Metric label="Ratings received" value={staff.rating_count} /></div><div className="mt-5 rounded-2xl bg-[#FFF8FB] p-4"><p className="flex items-center gap-2 font-bold text-[#1F2937]"><HiOutlineStar className="h-5 w-5 text-[#D97706]" /> Client retention</p><p className="mt-2 text-sm leading-6 text-[#6B7280]">{staff.repeat_clients} of {staff.client_count} unique clients returned to this provider during the selected period.</p></div></aside></div>;
}

function ForecastCard({ item, type }) { return <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-sm"><span className="text-[10px] font-bold uppercase text-[#C85B95]">{type}</span><p className="mt-2 font-bold text-[#1F2937]">{item.title || item.service_name || item.date || `${type} insight`}</p><p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.description || item.reason || item.recommendation || "Review branch staffing and demand."}</p></article>; }
