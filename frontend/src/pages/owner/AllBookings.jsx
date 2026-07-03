import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineCalendarDays, HiOutlineClock, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatusBadge } from "./OwnerWorkspace";

const statuses = ["all", "pending", "confirmed", "completed", "cancelled"];

export default function AllBookings() {
  const [bookings, setBookings] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.bookings({ branch_id: branchId || null, status_filter: statusFilter === "all" ? null : statusFilter });
      setBookings(payload.bookings || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load all-branch bookings."));
    } finally {
      setIsLoading(false);
    }
  }, [branchId, statusFilter]);

  useEffect(() => {
    Promise.resolve().then(() => loadBookings());
  }, [loadBookings]);

  const branches = useMemo(() => Array.from(new Map(bookings.map((booking) => [booking.branch?.id, booking.branch]).filter(([id]) => id)).values()), [bookings]);
  const visibleBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((booking) => [booking.id, booking.customer?.full_name, booking.branch?.name, booking.service?.name, booking.status].join(" ").toLowerCase().includes(term));
  }, [bookings, search]);

  return (
    <OwnerWorkspace title="All Bookings" eyebrow="Centralized appointment monitoring">
      {error && <Notice message={error} onRetry={loadBookings} />}
      <Filters search={search} setSearch={setSearch} branchId={branchId} setBranchId={setBranchId} branches={branches} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : visibleBookings.length ? (
          <div className="space-y-4">
            {visibleBookings.map((booking) => (
              <article key={booking.id} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">Booking #{booking.id}</p><StatusBadge status={booking.status} /></div>
                    <h2 className="mt-3 text-lg font-bold text-[#1F2937]">{booking.service?.name || "Service"}</h2>
                    <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || "Customer"} - {booking.branch?.name || "Branch"}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-[#6B7280]">
                    <span className="inline-flex items-center gap-2"><HiOutlineCalendarDays className="h-5 w-5 text-[#D65A9A]" /> {formatDateTime(booking.appointment_date)}</span>
                    <span className="inline-flex items-center gap-2"><HiOutlineClock className="h-5 w-5 text-[#D65A9A]" /> {booking.service?.duration_minutes || 0} minutes</span>
                  </div>
                  <p className="text-lg font-bold text-[#166534]">{formatCurrency(booking.service?.price)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No bookings found" description="Appointments from every branch will appear here with customer, service, and status details." />}
      </section>
    </OwnerWorkspace>
  );
}

function Filters({ search, setSearch, branchId, setBranchId, branches, statusFilter, setStatusFilter }) {
  return (
    <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, branch, service, or booking number" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none" />
        </div>
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="min-h-12 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm font-bold text-[#1F2937] outline-none">
          <option value="">All branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {statuses.map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold capitalize ${statusFilter === status ? "bg-[#C85B95] text-white" : "bg-[#FFF8FB] text-[#6B7280]"}`}>{status}</button>)}
      </div>
    </section>
  );
}
