import { useCallback, useEffect, useState } from "react";
import { HiOutlineMapPin, HiOutlineSparkles, HiOutlineStar, HiOutlineTrophy, HiOutlineXMark } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice } from "./ManagerWorkspace";
import ModernDatePicker from "../../components/common/ModernDatePicker";

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState({ demand_forecast: [], workforce_recommendations: [] });
  const [forecastLoaded, setForecastLoaded] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [performance, setPerformance] = useState(null);
  const period = "daily";
  const [performanceDate, setPerformanceDate] = useState(localDate);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [error, setError] = useState("");
  const [performanceError, setPerformanceError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      setData(await managerService.dashboard());
    } catch (err) { setError(getApiError(err, "We couldn't load the manager dashboard.")); }
    finally { setIsLoading(false); }
  }, []);

  const loadForecast = useCallback(async () => {
    setForecastLoading(true); setForecastError(""); setForecastLoaded(true);
    try { setForecast(await managerService.forecasting() || { demand_forecast: [], workforce_recommendations: [] }); }
    catch (err) { setForecastError(getApiError(err, "We couldn't load the demand forecast.")); }
    finally { setForecastLoading(false); }
  }, []);

  const loadPerformance = useCallback(async () => {
    setPerformanceLoading(true); setPerformanceError("");
    try { setPerformance(await managerService.dashboardPerformance(period, performanceDate)); }
    catch (err) { setPerformanceError(getApiError(err, "We couldn't load branch performance.")); }
    finally { setPerformanceLoading(false); }
  }, [period, performanceDate]);

  useEffect(() => { Promise.resolve().then(loadDashboard); }, [loadDashboard]);
  useEffect(() => { Promise.resolve().then(loadPerformance); }, [loadPerformance]);

  return (
    <ManagerWorkspace title="Manager Dashboard" eyebrow={data?.branch?.name || "Assigned branch"} brandOnly>
      {error && <Notice message={error} onRetry={loadDashboard} />}
      {performanceError && <Notice message={performanceError} onRetry={loadPerformance} />}
      <PerformanceWorkspace data={performance} loading={performanceLoading} period={period} reportDate={performanceDate} onReportDate={setPerformanceDate} onStaff={setSelectedStaff} />

      <section className="mt-6">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#1F2937]">Plan ahead</h2><p className="mt-1 text-xs text-[#6B7280]">Expected appointments and a simple staffing tip for the coming week.</p></div>
        {forecastError && <Notice message={forecastError} onRetry={loadForecast} />}
        {forecastLoading ? <CardSkeleton rows={1} /> : forecastLoaded ? forecast.demand_forecast?.length ? <div className="grid gap-4 lg:grid-cols-2"><WeeklyForecastCard items={forecast.demand_forecast.slice(0, 7)} /></div> : <EmptyState icon={HiOutlineSparkles} title="No forecast available" description="There isn’t enough appointment history to show an outlook yet." /> : <div className="flex flex-col gap-3 rounded-2xl border border-[#F3E8EF] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[#6B7280]">See how busy the coming week may be.</p><button type="button" onClick={loadForecast} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white"><HiOutlineSparkles className="h-5 w-5" /> Show forecast</button></div>}
      </section>
      {selectedStaff && <StaffDrawer staff={selectedStaff} period={period} onClose={() => setSelectedStaff(null)} />}
    </ManagerWorkspace>
  );
}

function PerformanceWorkspace({ data, loading, period, reportDate, onReportDate, onStaff }) {
  const summary = data?.summary || {};
  return <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C9558F]">Assigned branch performance</p><h2 className="mt-1 text-xl font-extrabold text-[#1F2937]">{data?.branch?.name || "Branch performance"}</h2><p className="mt-1 inline-flex items-center gap-1 text-xs text-[#6B7280]"><HiOutlineMapPin className="h-4 w-4 text-[#D65A9A]" /> {data?.branch?.address || "Your assigned branch only"}</p></div><ModernDatePicker value={reportDate} onChange={onReportDate} placeholder="Filter by payment date" ariaLabel="Filter manager dashboard by date" className="w-full lg:w-72" /></div>
    {loading ? <div className="mt-5"><CardSkeleton rows={3} /></div> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Bookings" value={summary.bookings || 0} /><Metric label="Completed" value={summary.completed || 0} /><Metric label="Salon revenue" value={formatCurrency(summary.sales)} /><Metric label="Staff commission" value={formatCurrency(summary.staff_commission)} /><Metric label="Branch rating" value={summary.average_rating ? `${summary.average_rating}/5` : "—"} /></div>
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

function WeeklyForecastCard({ items }) {
  const datedItems = items.map((item) => ({
    ...item,
    parsedDate: item.date ? new Date(`${item.date}T12:00:00`) : null,
  }));
  const validDates = datedItems.map((item) => item.parsedDate).filter((value) => value && !Number.isNaN(value.getTime()));
  const formatDate = (value) => value?.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const weekLabel = validDates.length
    ? `${formatDate(validDates[0])} – ${formatDate(validDates[validDates.length - 1])}`
    : "Coming week";
  const appointmentCount = Math.round(items.reduce((sum, item) => sum + Number(item.predicted_demand || 0), 0));
  const demandLevels = items.map((item) => item.demand_level);
  const weeklyDemandLevel = demandLevels.includes("high") ? "high" : demandLevels.every((level) => level === "low") ? "low" : "moderate";
  const hasRecommendation = items.some((item) => item.recommendation);
  const staffingTip = !hasRecommendation
    ? "No recommendation"
    : weeklyDemandLevel === "high"
      ? "It may be a busy week. Make sure enough staff are scheduled."
      : weeklyDemandLevel === "low"
        ? "It may be a quieter week. Regular staffing should be enough."
        : "Usual staffing should be enough. Check the appointment list.";

  return <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-sm">
    <p className="text-sm font-bold text-[#1F2937]">Coming week <span className="font-medium text-[#6B7280]">({weekLabel})</span></p>
    <p className="mt-2 text-sm text-[#6B7280]">About <strong className="text-[#1F2937]">{appointmentCount}</strong> {appointmentCount === 1 ? "appointment" : "appointments"} expected this week.</p>
    <p className="mt-1 text-sm leading-6 text-[#6B7280]">{staffingTip}</p>
  </article>;
}
