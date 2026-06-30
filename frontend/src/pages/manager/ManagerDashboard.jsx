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
} from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard, StatusBadge } from "./ManagerWorkspace";

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await managerService.dashboard());
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
      actions={
        <Link to="/manager/bookings" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]">
          <HiOutlineCalendarDays className="h-5 w-5" />
          Manage Bookings
        </Link>
      }
    >
      {error && <Notice message={error} onRetry={loadDashboard} />}

      <section className="rounded-[1.5rem] bg-gradient-to-br from-[#D65A9A] via-[#E879B0] to-[#F8BBD6] p-5 text-white shadow-[0_24px_70px_rgba(214,90,154,0.24)] sm:p-7">
        <span className="inline-flex rounded-full border border-white/45 bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm backdrop-blur">
          Branch control
        </span>
        <h2 className="mt-5 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          Keep bookings, sales, stock alerts, and service demand in one branch view.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">
          All figures are scoped to {data?.branch?.name || "your assigned branch"}.
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
    </ManagerWorkspace>
  );
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
