import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineBanknotes, HiOutlineUserGroup } from "react-icons/hi2";
import { useAuth } from "../hooks/useAuth";
import ownerService from "../services/ownerService";
import managerService from "../services/managerService";
import staffTransactionService from "../services/staffTransactionService";
import { formatCurrency, getApiError } from "./staff/staffWorkspaceUtils";
import { OwnerWorkspace } from "./owner/OwnerWorkspace";
import { ManagerWorkspace } from "./manager/ManagerWorkspace";
import { StaffWorkspace } from "./staff/StaffWorkspace";

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function CommissionOverview() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const [period, setPeriod] = useState(role === "owner" ? "weekly" : "daily");
  const [reportDate, setReportDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (role === "owner") setReport(await ownerService.dashboardPerformance(period));
      else if (role === "manager") setReport(await managerService.reports({ period }));
      else setReport(await staffTransactionService.periodReport({ period, report_date: reportDate }));
    } catch (err) {
      setError(getApiError(err, "Commission details could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [period, reportDate, role]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const rows = useMemo(() => {
    let providerRows;
    if (role === "owner") providerRows = (report?.branches || []).flatMap((branch) => (branch.staff || []).map((staff) => ({
      id: `${branch.branch_id}-${staff.staff_id}`,
      name: staff.full_name,
      branch: branch.name,
      commission: Number(staff.commission || 0),
      services: staff.services_completed || 0,
    })));
    else if (role === "manager") providerRows = (report?.staff || []).map((staff) => ({
      id: staff.staff_id,
      name: staff.full_name,
      branch: report?.branch?.name || "Assigned branch",
      commission: Number(staff.commission || 0),
      services: staff.services_completed || 0,
    }));
    else providerRows = (report?.staff_performance || []).map((staff) => ({
      id: staff.name,
      name: staff.name,
      branch: report?.branch_name || "Assigned branch",
      commission: Number(staff.commission || 0),
      services: staff.services || 0,
    }));
    return providerRows.filter((row) => row.commission > 0);
  }, [report, role]);

  const total = rows.reduce((sum, row) => sum + row.commission, 0);

  const Workspace = role === "owner" ? OwnerWorkspace : role === "manager" ? ManagerWorkspace : StaffWorkspace;
  const periodOptions = role === "owner" ? ["weekly", "monthly", "yearly"] : role === "staff" ? ["daily", "weekly", "monthly", "yearly"] : ["daily", "weekly", "monthly"];

  return <Workspace title="Commissions" eyebrow="Staff commission by service provider" headerStats={[
    { label: "Staff Commission / Tips", value: formatCurrency(total), icon: HiOutlineBanknotes, tone: "pink" },
    { label: "Providers", value: rows.length, icon: HiOutlineUserGroup, tone: "blue" },
  ]}>
    <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#1F2937]">Commission by provider</h2>
          <p className="mt-1 text-sm text-[#6B7280]">Commission is tracked separately from salon revenue and attributed to the service provider.</p>
        </div>
        <label className="text-sm font-bold text-[#1F2937]">Reporting period
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="form-input mt-1 min-w-40">
            {periodOptions.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}
          </select>
        </label>
      </div>
      {role === "staff" && period === "daily" && <label className="mt-3 block max-w-xs text-sm font-bold text-[#1F2937]">Report date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="form-input mt-1" /></label>}
      {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" onClick={load} className="ml-3 font-bold underline">Retry</button></div>}
      {loading ? <p className="mt-5 rounded-xl bg-[#FFF8FB] p-6 text-center text-sm text-[#6B7280]">Loading commission details…</p> : !error && <div className="mt-5 overflow-x-auto rounded-xl border border-[#F3E8EF]">
        <div className="grid grid-cols-2 gap-3 bg-[#FFF8FB] px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-[#6B7280]"><span>Commission recipient</span><span>Commission amount</span></div>
        {rows.length ? rows.map((row) => <div key={row.id} className="grid grid-cols-2 items-center gap-3 border-t border-[#F3E8EF] px-4 py-3 text-center text-sm"><strong className="text-[#1F2937]">{row.name}</strong><strong className="text-[#C85B95]">{formatCurrency(row.commission)}</strong></div>) : <p className="p-6 text-center text-sm text-[#6B7280]">No commission recorded for this period.</p>}
      </div>}
    </section>
  </Workspace>;
}
