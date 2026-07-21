import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineShoppingBag,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard, StatusBadge } from "./ManagerWorkspace";

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecast, setForecast] = useState({ demand_forecast: [], workforce_recommendations: [] });

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [dashboardPayload, forecastPayload] = await Promise.all([
        managerService.dashboard(),
        managerService.forecasting(),
      ]);
      setData(dashboardPayload);
      setForecast(forecastPayload || { demand_forecast: [], workforce_recommendations: [] });
    } catch (err) {
      setError(getApiError(err, "We couldn't load the manager dashboard."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadDashboard());
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const source = data?.stats || {};
    return [
      { label: "Today's Bookings", value: source.today_bookings || 0, icon: HiOutlineCalendarDays, tone: "pink" },
      { label: "Completed", value: source.completed_bookings || 0, icon: HiOutlineCheckCircle, tone: "green" },
      { label: "Total Sales", value: formatCurrency(source.total_sales), icon: HiOutlineBanknotes, tone: "blue" },
      { label: "Pending", value: source.pending_bookings || 0, icon: HiOutlineClock, tone: "amber" },
      { label: "Low Stock", value: source.low_stock_items || 0, icon: HiOutlineExclamationTriangle, tone: "red" },
    ];
  }, [data]);

  return (
    <ManagerWorkspace
      title="Manager Dashboard"
      eyebrow={data?.branch?.name || "Assigned branch"}
      brandOnly
      headerStats={stats}
      actions={
        <Link to="/manager/bookings" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]">
          <HiOutlineCalendarDays className="h-5 w-5" />
          Manage Bookings
        </Link>
      }
    >
      {error && <Notice message={error} onRetry={loadDashboard} />}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Recent Bookings</h2>
            <Link to="/manager/bookings" className="text-sm font-bold text-[#C85B95] hover:underline">View all</Link>
          </div>
          {isLoading ? <CardSkeleton rows={4} /> : data?.recent_bookings?.length ? (
            <div className="space-y-3">
              {data.recent_bookings.map((booking) => <BookingPreview key={booking.id} booking={booking} />)}
            </div>
          ) : <EmptyState title="No branch bookings yet" description="Customer appointments for your assigned branch will appear here." />}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Branch Performance</h2>
            <Link to="/manager/reports" className="text-sm font-bold text-[#C85B95] hover:underline">Reports</Link>
          </div>
          <div className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            {data?.branch_performance?.length ? data.branch_performance.map((row) => (
              <div key={row.date} className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F3E8EF] py-3 last:border-0">
                <span className="text-sm font-bold text-[#1F2937]">{row.date}</span>
                <span className="inline-flex items-center gap-2 text-sm text-[#6B7280]"><HiOutlineShoppingBag className="h-4 w-4 text-[#D65A9A]" /> {row.bookings} bookings</span>
                <span className="text-sm font-bold text-[#166534]">{formatCurrency(row.sales)}</span>
              </div>
            )) : <EmptyState icon={HiOutlineSparkles} title="No performance data" description="Daily sales and bookings will build up as branch activity is recorded." />}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-4"><h2 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]"><HiOutlineArrowPath className="h-5 w-5 text-[#D65A9A]" /> Staff Customers Return To</h2><p className="mt-1 text-xs text-[#6B7280]">Based on repeat paying customers handled by each provider in this branch.</p></div>
        {isLoading ? <CardSkeleton rows={3} /> : data?.staff_retention?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.staff_retention.map((staff, index) => (
              <article key={staff.staff_id} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF0F7] font-extrabold text-[#D65A9A]">{staff.full_name.slice(0, 1)}</span><div><p className="font-bold text-[#1F2937]">{staff.full_name}</p><p className="text-xs text-[#6B7280]">{staff.job_title}</p></div></div>{index === 0 && staff.total_visits > 0 && <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-[#92400E]">Top provider</span>}</div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-xl bg-[#FFF8FB] p-2"><p className="font-extrabold">{staff.repeat_customers}</p><p className="text-[9px] uppercase text-[#6B7280]">Repeat clients</p></div><div className="rounded-xl bg-[#FFF8FB] p-2"><p className="font-extrabold">{staff.total_visits}</p><p className="text-[9px] uppercase text-[#6B7280]">Visits</p></div><div className="rounded-xl bg-[#FFF8FB] p-2"><p className="font-extrabold text-[#D97706]">★ {staff.average_rating || "—"}</p><p className="text-[9px] uppercase text-[#6B7280]">{staff.rating_count} ratings</p></div><div className="rounded-xl bg-[#FFF8FB] p-2"><p className="font-extrabold text-[#C85B95]">{formatCurrency(staff.commission_earned)}</p><p className="text-[9px] uppercase text-[#6B7280]">Commission</p></div></div>
              </article>
            ))}
          </div>
        ) : <EmptyState icon={HiOutlineUserGroup} title="No repeat-customer data yet" description="Provider retention will appear after customers return using the same phone number and complete another paid visit." />}
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold text-[#1F2937]">Demand Forecast</h2><p className="mt-1 text-xs text-[#6B7280]">Workforce and service-demand guidance for this branch.</p></div>
        </div>
        {isLoading ? <CardSkeleton rows={2} /> : forecast.workforce_recommendations?.length || forecast.demand_forecast?.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {(forecast.demand_forecast || []).slice(0, 3).map((item, index) => <ForecastCard key={item.id || `demand-${index}`} item={item} type="Demand" />)}
            {(forecast.workforce_recommendations || []).slice(0, 3).map((item, index) => <ForecastCard key={item.id || `staff-${index}`} item={item} type="Workforce" />)}
          </div>
        ) : <EmptyState icon={HiOutlineSparkles} title="No forecast available" description={forecast.message || "Demand and staffing recommendations will appear as branch activity grows."} />}
      </section>
    </ManagerWorkspace>
  );
}

function ForecastCard({ item, type }) {
  return <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]"><span className="text-[10px] font-bold uppercase tracking-wide text-[#C85B95]">{type}</span><p className="mt-2 font-bold text-[#1F2937]">{item.title || item.service_name || item.date || item.recommendation || `${type} insight`}</p><p className="mt-2 text-sm leading-6 text-[#6B7280]">{item.description || item.reason || item.recommendation || (item.predicted_bookings != null ? `${item.predicted_bookings} expected bookings` : "Review branch staffing and appointment demand.")}</p></article>;
}

function BookingPreview({ booking }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1F2937]">{booking.service?.name || "Service"}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || "Customer"} • {formatDateTime(booking.appointment_date)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
    </article>
  );
}
