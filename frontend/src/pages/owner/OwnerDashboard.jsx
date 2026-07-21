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
  HiOutlineTrophy,
  HiOutlineCheckBadge,
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
      brandOnly
      actions={
        <Link to="/owner/reports" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]">
          <HiOutlineChartBar className="h-5 w-5" />
          View Reports
        </Link>
      }
    >
      {error && <Notice message={error} onRetry={loadDashboard} />}

      <section className="rounded-[1.25rem] bg-gradient-to-br from-[#B94B86] via-[#D968A3] to-[#F4AFCF] p-4 text-white shadow-[0_20px_55px_rgba(214,90,154,0.22)] sm:rounded-[1.5rem] sm:p-7">
        <span className="inline-flex rounded-full border border-white/45 bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm backdrop-blur">Owner control</span>
        <h2 className="mt-4 max-w-3xl text-2xl font-bold leading-tight sm:mt-5 sm:text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          Monitor bookings, transactions, branch performance, and demand trends in one centralized view.
        </h2>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:mt-5 sm:gap-4 xl:grid-cols-6">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#1F2937]">Branch Performance</h2>
            <Link to="/owner/branches" className="min-h-10 rounded-xl px-2 py-2.5 text-sm font-bold text-[#C85B95] hover:bg-[#FFF0F7]">Manage branches</Link>
          </div>
          {isLoading ? <CardSkeleton rows={4} /> : data?.branch_performance?.length ? (
            <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              {data.branch_performance.map((row) => (
                <div key={row.branch_id} className="grid gap-2 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3 sm:px-5">
                  <span className="font-bold text-[#1F2937]">{row.branch}</span>
                  <span className="text-sm text-[#6B7280]">{row.bookings} bookings</span>
                  <span className="font-bold text-[#166534]">{formatCurrency(row.sales)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No branch activity yet" description="Multi-branch bookings and sales will appear here once staff record operations." />}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#1F2937]">Recent Bookings</h2>
            <Link to="/owner/bookings" className="min-h-10 rounded-xl px-2 py-2.5 text-sm font-bold text-[#C85B95] hover:bg-[#FFF0F7]">View all</Link>
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

      <section className="mt-6">
        <div className="mb-4"><h2 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]"><HiOutlineTrophy className="h-5 w-5 text-[#D65A9A]" /> Branch Excellence Ranking</h2><p className="mt-1 text-xs text-[#6B7280]">Ranked by recorded sales, completed services, and booking activity.</p></div>
        {isLoading ? <CardSkeleton rows={3} /> : data?.branch_rankings?.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {data.branch_rankings.map((branch) => (
              <article key={branch.branch_id} className={`rounded-[1.25rem] border bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)] ${branch.rank === 1 ? "border-[#D65A9A] ring-4 ring-[#D65A9A]/10" : "border-[#F3E8EF]"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#C85B95]">Rank #{branch.rank}</p><h3 className="mt-1 font-bold text-[#1F2937]">{branch.branch}</h3></div>{branch.rank === 1 && <span className="grid h-10 w-10 place-items-center rounded-full bg-[#FEF3C7] text-[#D97706]"><HiOutlineTrophy className="h-5 w-5" /></span>}</div>
                <p className="mt-5 text-2xl font-extrabold text-[#166534]">{formatCurrency(branch.sales)}</p><p className="text-[10px] font-bold uppercase text-[#6B7280]">Recorded sales</p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#F3E8EF] pt-3 text-xs text-[#6B7280]"><span>{branch.completed} completed</span><span className="inline-flex items-center gap-1 font-bold text-[#C85B95]"><HiOutlineCheckBadge className="h-4 w-4" /> {branch.completion_rate}% rate</span></div>
              </article>
            ))}
          </div>
        ) : <EmptyState icon={HiOutlineTrophy} title="No branch ranking yet" description="Branch excellence will appear after bookings and transactions are recorded." />}
      </section>
    </OwnerWorkspace>
  );
}
