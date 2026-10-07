import { useCallback, useEffect, useState } from "react";
import managerService from "../../services/managerService";
import { ManagerWorkspace } from "./ManagerWorkspace";
import { formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";

export default function ManagerAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setError(""); setLogs((await managerService.auditLogs()).audit_logs || []); }
    catch (err) { setError(getApiError(err, "We couldn't load audit logs.")); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <ManagerWorkspace title="Audit Logs" eyebrow="Branch accountability trail">
    {error && <div className="mb-4 rounded-xl bg-[#FEE2E2] p-4 text-sm font-bold text-[#991B1B]">{error} <button onClick={load} className="ml-2 underline">Retry</button></div>}
    <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm text-[#6B7280]">Audit records are permanent and cannot be deleted.</p>
      {logs.length ? logs.map((log, index) => <article key={`${log.created_at}-${index}`} className="grid gap-2 border-b border-[#F3E8EF] py-4 last:border-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center"><span className="w-fit rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{log.type}</span><div><p className="font-bold text-[#1F2937]">{log.action}</p><p className="text-sm text-[#6B7280]">Actor: {log.actor}</p></div><time className="text-xs font-semibold text-[#9CA3AF]">{formatDateTime(log.created_at)}</time></article>) : <p className="py-8 text-center text-sm text-[#6B7280]">No audit events yet.</p>}
    </section>
  </ManagerWorkspace>;
}
