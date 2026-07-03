import { useCallback, useEffect, useState } from "react";
import { HiOutlineBuildingStorefront, HiOutlinePencilSquare, HiOutlinePlus } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

const emptyForm = { name: "", address: "", phone: "", is_active: true };

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.branches();
      setBranches(payload.branches || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load branches."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadBranches());
  }, [loadBranches]);

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingId) await ownerService.updateBranch(editingId, form);
      else await ownerService.createBranch(form);
      setSuccess(editingId ? "Branch updated." : "Branch created.");
      setEditingId(null);
      setForm(emptyForm);
      await loadBranches();
    } catch (err) {
      setError(getApiError(err, "We couldn't save this branch."));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (branch) => {
    setEditingId(branch.id);
    setForm({ name: branch.name || "", address: branch.address || "", phone: branch.phone || "", is_active: Boolean(branch.is_active) });
  };

  return (
    <OwnerWorkspace title="Branch Management" eyebrow="Create and maintain salon branches">
      {error && <Notice message={error} onRetry={loadBranches} />}
      {success && <Notice tone="success" message={success} />}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Branches" value={branches.length} icon={HiOutlineBuildingStorefront} tone="pink" />
        <StatCard label="Active" value={branches.filter((branch) => branch.is_active).length} icon={HiOutlineBuildingStorefront} tone="green" />
        <StatCard label="Sales" value={formatCurrency(branches.reduce((sum, branch) => sum + Number(branch.sales || 0), 0))} icon={HiOutlineBuildingStorefront} tone="blue" />
      </section>

      <form onSubmit={submit} className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.8fr_auto_auto] lg:items-end">
          <Field label="Branch name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
          <Field label="Address" value={form.address} onChange={(value) => setForm((prev) => ({ ...prev, address: value }))} required />
          <Field label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm font-bold text-[#1F2937]">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
            Active
          </label>
          <button disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {editingId ? <HiOutlinePencilSquare className="h-5 w-5" /> : <HiOutlinePlus className="h-5 w-5" />}
            {editingId ? "Update" : "Create"}
          </button>
        </div>
      </form>

      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={4} /> : branches.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {branches.map((branch) => (
              <article key={branch.id} className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[#1F2937]">{branch.name}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">{branch.address}</p>
                    <p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{branch.phone || "No phone listed"}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${branch.is_active ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{branch.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Bookings" value={branch.bookings || 0} />
                  <Metric label="Users" value={branch.assigned_users || 0} />
                  <Metric label="Sales" value={formatCurrency(branch.sales)} />
                </div>
                <button type="button" onClick={() => startEdit(branch)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#FFF0F7]">
                  <HiOutlinePencilSquare className="h-5 w-5 text-[#D65A9A]" />
                  Edit
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No branches yet" description="Create branches so bookings, transactions, inventory, and managers can be assigned accurately." />}
      </section>
    </OwnerWorkspace>
  );
}

function Field({ label, value, onChange, required = false }) {
  return (
    <label className="text-sm font-bold text-[#1F2937]">
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
    </label>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-[#FFF8FB] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">{label}</p><p className="mt-1 truncate font-bold text-[#1F2937]">{value}</p></div>;
}
