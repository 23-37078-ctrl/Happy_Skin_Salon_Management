import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineClipboardDocumentList, HiOutlineFunnel, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import ListPagination from "../../components/common/ListPagination";

const PAGE_SIZE = 10;

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.auditLogs();
      setLogs(payload.audit_logs || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load audit logs."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadLogs());
  }, [loadLogs]);

  const types = useMemo(() => [...new Set(logs.map((log) => log.type).filter(Boolean))].sort(), [logs]);
  const actors = useMemo(() => [...new Set(logs.map((log) => log.actor).filter(Boolean))].sort(), [logs]);
  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const eventDate = String(log.created_at || "").slice(0, 10);
      const matchesSearch = !term || [log.type, log.action, log.actor].filter(Boolean).join(" ").toLowerCase().includes(term);
      return matchesSearch && (typeFilter === "all" || log.type === typeFilter) && (actorFilter === "all" || log.actor === actorFilter) && (!dateFrom || eventDate >= dateFrom) && (!dateTo || eventDate <= dateTo);
    });
  }, [logs, search, typeFilter, actorFilter, dateFrom, dateTo]);
  const visibleLogs = useMemo(() => filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredLogs, page]);
  useEffect(() => { setPage(1); }, [search, typeFilter, actorFilter, dateFrom, dateTo]);
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setActorFilter("all"); setDateFrom(""); setDateTo(""); };

  return (
    <OwnerWorkspace title="Audit Logs" eyebrow="Security and accountability trail" headerStats={[{ label: "Events shown", value: filteredLogs.length, icon: HiOutlineClipboardDocumentList, tone: "pink" }, { label: "Bookings", value: filteredLogs.filter((log) => log.type === "booking").length, icon: HiOutlineClipboardDocumentList, tone: "blue" }, { label: "Transactions", value: filteredLogs.filter((log) => log.type === "transaction").length, icon: HiOutlineClipboardDocumentList, tone: "green" }]}>
      {error && <Notice message={error} onRetry={loadLogs} />}
      <section className="mb-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_12rem_15rem_13rem_13rem_auto]"><div className="relative"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, or event" className="form-input pl-10" /></div><label className="flex items-center gap-2 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3"><HiOutlineFunnel className="h-5 w-5 text-[#D65A9A]" /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"><option value="all">All event types</option>{types.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label><select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} className="form-input"><option value="all">All actors</option>{actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select><ModernDatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" ariaLabel="Audit log start date" /><ModernDatePicker value={dateTo} onChange={setDateTo} placeholder="To date" ariaLabel="Audit log end date" /><button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-[#D65A9A]/30 px-4 text-sm font-bold text-[#C85B95] hover:bg-[#FFF0F7]">Clear</button></div>
        <p className="mt-3 text-right text-xs font-semibold text-[#6B7280]">Showing {filteredLogs.length} of {logs.length} events</p>
      </section>
      <section>
        {isLoading ? <CardSkeleton rows={5} /> : filteredLogs.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            {visibleLogs.map((log, index) => (
              <article key={`${log.type}-${log.created_at}-${index}`} className="grid gap-3 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[0.7fr_1.2fr_1fr] lg:items-center">
                <span className="w-fit rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{log.type}</span>
                <div><p className="font-bold text-[#1F2937]">{log.action}</p><p className="mt-1 text-sm text-[#6B7280]">Actor: {log.actor}</p></div>
                <p className="text-sm font-semibold text-[#9CA3AF] lg:text-right">{formatDateTime(log.created_at)}</p>
              </article>
            ))}<div className="border-t border-[#F3E8EF] px-4 pb-5"><ListPagination page={page} pageSize={PAGE_SIZE} totalItems={filteredLogs.length} onPageChange={setPage} itemLabel="audit events" /></div>
          </div>
        ) : <EmptyState title="No matching audit events" description="Try clearing or changing the audit log filters." />}
      </section>
    </OwnerWorkspace>
  );
}
