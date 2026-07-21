import { useCallback, useEffect, useState } from "react";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <OwnerWorkspace title="Audit Logs" eyebrow="Security and accountability trail">
      {error && <Notice message={error} onRetry={loadLogs} />}
      <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3">
        <StatCard label="Events" value={logs.length} icon={HiOutlineClipboardDocumentList} tone="pink" />
        <StatCard label="Bookings" value={logs.filter((log) => log.type === "booking").length} icon={HiOutlineClipboardDocumentList} tone="blue" />
        <StatCard label="Transactions" value={logs.filter((log) => log.type === "transaction").length} icon={HiOutlineClipboardDocumentList} tone="green" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : logs.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            {logs.map((log, index) => (
              <article key={`${log.type}-${log.created_at}-${index}`} className="grid gap-3 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[0.7fr_1.2fr_1fr] lg:items-center">
                <span className="w-fit rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{log.type}</span>
                <div><p className="font-bold text-[#1F2937]">{log.action}</p><p className="mt-1 text-sm text-[#6B7280]">Actor: {log.actor}</p></div>
                <p className="text-sm font-semibold text-[#9CA3AF] lg:text-right">{formatDateTime(log.created_at)}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No audit events" description="User, booking, and transaction events will appear here for owner review." />}
      </section>
    </OwnerWorkspace>
  );
}
