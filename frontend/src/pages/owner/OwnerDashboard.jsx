import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlineBuildingStorefront,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineUsers,
  HiOutlineTrophy,
  HiOutlineCheckBadge,
  HiOutlineMapPin,
} from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("weekly");
  const [performance, setPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

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

  const loadPerformance = useCallback(async () => {
    setPerformanceLoading(true);
    try {
      const payload = await ownerService.dashboardPerformance(period);
      setPerformance(payload);
      setSelectedBranchId((current) => current && payload.branches.some((branch) => branch.branch_id === current) ? current : payload.branches[0]?.branch_id || null);
    } catch (err) {
      setError(getApiError(err, "We couldn't load multi-branch performance."));
    } finally {
      setPerformanceLoading(false);
    }
  }, [period]);

  useEffect(() => {
    Promise.resolve().then(() => loadDashboard());
  }, [loadDashboard]);

  useEffect(() => {
    Promise.resolve().then(loadPerformance);
  }, [loadPerformance]);

  const stats = useMemo(() => {
    const source = data?.stats || {};
    return [
      { label: "Active Branches", value: source.active_branches || 0, icon: HiOutlineBuildingStorefront, tone: "pink" },
      { label: "Users", value: source.users || 0, icon: HiOutlineUsers, tone: "blue" },
      { label: "Today's Bookings", value: source.today_bookings || 0, icon: HiOutlineCalendarDays, tone: "amber" },
      { label: "Pending", value: source.pending_bookings || 0, icon: HiOutlineClock, tone: "red" },
      { label: "Total Sales", value: formatCurrency(source.total_sales), icon: HiOutlineBanknotes, tone: "green" },
    ];
  }, [data]);

  return (
    <OwnerWorkspace
      title="Owner Dashboard"
      eyebrow="Centralized multi-branch monitoring"
      brandOnly
      headerStats={stats}
    >
      {error && <Notice message={error} onRetry={loadDashboard} />}

      <MultiBranchPerformance data={performance} loading={performanceLoading} period={period} onPeriod={setPeriod} selectedBranchId={selectedBranchId} onBranch={setSelectedBranchId} />

      <div className="mt-6">
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

function MultiBranchPerformance({ data, loading, period, onPeriod, selectedBranchId, onBranch }) {
  const selected = data?.branches?.find((branch) => branch.branch_id === selectedBranchId);
  return <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C9558F]">Super Admin · All locations</p><h2 className="mt-1 text-xl font-extrabold text-[#1F2937]">Three-branch performance</h2><p className="mt-1 text-xs text-[#6B7280]">Compare every active branch, then select one to review its staff.</p></div><div className="flex self-start rounded-xl bg-[#FFF8FB] p-1 ring-1 ring-[#F3E8EF]">{["weekly", "monthly", "yearly"].map((item) => <button key={item} type="button" onClick={() => onPeriod(item)} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${period === item ? "bg-[#C9558F] text-white shadow-sm" : "text-[#6B7280] hover:text-[#C9558F]"}`}>{item}</button>)}</div></div>
    {loading ? <div className="mt-5"><CardSkeleton rows={3} /></div> : <>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">{data?.branches?.map((branch, index) => <button key={branch.branch_id} type="button" onClick={() => onBranch(branch.branch_id)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${selectedBranchId === branch.branch_id ? "border-[#D65A9A] bg-[#FFF8FB] ring-4 ring-[#D65A9A]/10" : "border-[#F3E8EF] bg-white"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-extrabold text-[#1F2937]">{branch.name}</p><p className="mt-1 flex items-start gap-1 text-[10px] text-[#6B7280]"><HiOutlineMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D65A9A]" /> {branch.address}</p></div>{index === 0 && branch.completed > 0 && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FEF3C7] text-[#D97706]"><HiOutlineTrophy className="h-5 w-5" /></span>}</div><p className="mt-4 text-xl font-extrabold text-[#166534]">{formatCurrency(branch.sales)}</p><p className="text-[9px] font-bold uppercase text-[#6B7280]">Period sales</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><OwnerMini value={branch.bookings} label="Bookings" /><OwnerMini value={`${branch.completion_rate}%`} label="Completed" /><OwnerMini value={branch.average_rating || "—"} label="Rating" /></div></button>)}</div>
      {selected && <div className="mt-5 border-t border-[#F3E8EF] pt-5"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-extrabold text-[#1F2937]">{selected.name} staff performance</h3><p className="mt-1 text-xs text-[#6B7280]">Performance for the selected {period} period.</p></div><span className="text-xs font-bold text-[#C9558F]">{selected.staff.length} staff members</span></div>{selected.staff.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{selected.staff.map((staff, index) => <article key={staff.staff_id} className="rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-white font-extrabold text-[#C9558F]">{staff.full_name.slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#1F2937]">{staff.full_name}</p><p className="truncate text-[9px] text-[#6B7280]">{staff.job_title}</p></div>{index === 0 && staff.services_completed > 0 && <HiOutlineTrophy className="ml-auto h-4 w-4 text-[#D97706]" />}</div><div className="mt-3 grid grid-cols-2 gap-2"><OwnerMini value={staff.services_completed} label="Services" /><OwnerMini value={formatCurrency(staff.revenue)} label="Revenue" /><OwnerMini value={formatCurrency(staff.commission)} label="Commission" /><OwnerMini value={staff.average_rating ? `${staff.average_rating}/5` : "—"} label={`${staff.rating_count} ratings`} /></div></article>)}</div> : <p className="rounded-xl bg-[#FFF8FB] p-6 text-center text-sm text-[#6B7280]">No staff activity for this period.</p>}</div>}
    </>}
  </section>;
}

function OwnerMini({ value, label }) { return <div className="rounded-lg bg-white p-2"><p className="truncate text-xs font-extrabold text-[#1F2937]">{value}</p><p className="mt-1 text-[8px] font-bold uppercase text-[#6B7280]">{label}</p></div>; }
