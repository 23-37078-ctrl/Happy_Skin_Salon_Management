import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlineBuildingStorefront,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineUsers,
} from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard, StatusBadge } from "./OwnerWorkspace";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await ownerService.dashboard());
    } catch (err) {
      setError(getApiError(err, "We couldn't load the owner dashboard."));
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
      { label: "Active Branches", value: source.active_branches || 0, icon: HiOutlineBuildingStorefront, tone: "pink" },
      { label: "Users", value: source.users || 0, icon: HiOutlineUsers, tone: "blue" },
      { label: "Today's Bookings", value: source.today_bookings || 0, icon: HiOutlineCalendarDays, tone: "amber" },
      { label: "Pending", value: source.pending_bookings || 0, icon: HiOutlineClock, tone: "red" },
      { label: "Total Sales", value: formatCurrency(source.total_sales), icon: HiOutlineBanknotes, tone: "green" },
      { label: "Low Stock", value: source.low_stock_items || 0, icon: HiOutlineExclamationTriangle, tone: "red" },
    ];
  }, [data]);

  return (
    <OwnerWorkspace
      title="Owner Dashboard"
      eyebrow="Centralized multi-branch monitoring"
      actions={
        <Link to="/owner/reports" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]">
          <HiOutlineChartBar className="h-5 w-5" />
          View Reports
        </Link>
      }
    >
      {error && <Notice message={error} onRetry={loadDashboard} />}

      <section className="rounded-[1.5rem] bg-gradient-to-br from-[#C85B95] via-[#E879B0] to-[#F8BBD6] p-5 text-white shadow-[0_24px_70px_rgba(214,90,154,0.24)] sm:p-7">
        <span className="inline-flex rounded-full border border-white/45 bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm backdrop-blur">Owner control</span>
        <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          Monitor bookings, transactions, branch performance, and demand trends in one centralized view.
        </h2>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Branch Performance</h2>
            <Link to="/owner/branches" className="text-sm font-bold text-[#C85B95] hover:underline">Manage branches</Link>
          </div>
          {isLoading ? <CardSkeleton rows={4} /> : data?.branch_performance?.length ? (
            <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              {data.branch_performance.map((row) => (
                <div key={row.branch_id} className="grid gap-3 border-b border-[#F3E8EF] px-5 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <span className="font-bold text-[#1F2937]">{row.branch}</span>
                  <span className="text-sm text-[#6B7280]">{row.bookings} bookings</span>
                  <span className="font-bold text-[#166534]">{formatCurrency(row.sales)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No branch activity yet" description="Multi-branch bookings and sales will appear here once staff record operations." />}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Recent Bookings</h2>
            <Link to="/owner/bookings" className="text-sm font-bold text-[#C85B95] hover:underline">View all</Link>
          </div>
          {isLoading ? <CardSkeleton rows={4} /> : data?.recent_bookings?.length ? (
            <div className="space-y-3">
              {data.recent_bookings.map((booking) => (
                <article key={booking.id} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#1F2937]">{booking.service?.name || "Service"}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{booking.branch?.name || "Branch"} - {booking.customer?.full_name || "Customer"}</p>
                      <p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(booking.appointment_date)}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No recent bookings" description="Customer appointments across branches will appear here." />}
        </section>
      </div>
    </OwnerWorkspace>
  );
}
