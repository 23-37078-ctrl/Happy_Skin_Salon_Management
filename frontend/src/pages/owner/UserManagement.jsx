import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlinePencilSquare, HiOutlineUsers, HiOutlineXMark } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace } from "./OwnerWorkspace";
import useModalLayer from "../../hooks/useModalLayer";

const roles = ["owner", "manager", "staff", "customer"];
const emptyForm = { full_name: "", email: "", role: "staff", branch_id: "", phone_number: "" };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const closeForm = useCallback(() => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingId(null);
  }, [isSaving]);
  useModalLayer(isFormOpen, closeForm);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.users();
      setUsers(payload.users || []);
      setBranches(payload.branches || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load users."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadUsers());
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchingUsers = term
      ? users.filter((user) => [user.full_name, user.email, user.role, user.branch_name].join(" ").toLowerCase().includes(term))
      : users;
    return [...matchingUsers].sort((first, second) => (first.full_name || "").localeCompare(second.full_name || "", undefined, { sensitivity: "base" }));
  }, [search, users]);

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    const payload = { ...form, branch_id: form.role === "customer" ? null : form.branch_id ? Number(form.branch_id) : null, phone_number: form.phone_number || null };
    try {
      await ownerService.updateUser(editingId, {
        full_name: payload.full_name,
        role: payload.role,
        branch_id: payload.branch_id,
        phone_number: payload.phone_number,
      });
      setSuccess("User updated.");
      setEditingId(null);
      setForm(emptyForm);
      setIsFormOpen(false);
      await loadUsers();
    } catch (err) {
      setError(getApiError(err, "We couldn't save this user."));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "staff",
      branch_id: user.branch_id || "",
      phone_number: user.phone_number || "",
    });
    setError("");
    setIsFormOpen(true);
  };

  return (
    <OwnerWorkspace title="User Management" eyebrow="Role-based account control" headerStats={roles.map((role) => ({ label: role, value: users.filter((user) => user.role === role).length, icon: HiOutlineUsers, tone: role === "owner" ? "pink" : role === "manager" ? "blue" : role === "staff" ? "green" : "amber" }))}>
      {error && !isFormOpen && <Notice message={error} onRetry={loadUsers} />}
      {success && <Notice tone="success" message={success} />}

      {isFormOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#1F1720]/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="my-auto w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-[0_24px_80px_rgba(31,23,32,0.25)]">
          <div className="flex items-start justify-between gap-4 border-b border-[#F3E8EF] bg-gradient-to-r from-white to-[#FFF7FB] px-5 py-4 sm:px-6">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C85B95]">Account administration</p><h2 id="user-form-title" className="mt-1 text-xl font-bold text-[#1F2937]">Edit user</h2><p className="mt-1 text-sm text-[#6B7280]">{form.role === "customer" ? "Customer role stays fixed. Customers can book at any branch." : "Update account details and branch access."}</p></div>
            <button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close user form" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#8A6B7D] transition hover:bg-[#FFF0F7] hover:text-[#C85B95] disabled:opacity-50"><HiOutlineXMark className="h-5 w-5" /></button>
          </div>
          <form onSubmit={submit} className="p-5 sm:p-6">
            {error && <p role="alert" className="mb-4 rounded-xl border border-[#FECACA] bg-[#FFF1F2] px-4 py-3 text-sm text-[#B42332]">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" value={form.full_name} onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))} required autoFocus />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required disabled={Boolean(editingId)} />
          <label className="text-sm font-bold text-[#1F2937]">
            Role
            <select value={form.role} disabled={Boolean(editingId && form.role === "customer")} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value, branch_id: event.target.value === "customer" ? "" : prev.branch_id }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-70">
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          {form.role !== "customer" && <label className="text-sm font-bold text-[#1F2937]">
            Assigned branch
            <select value={form.branch_id} onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none">
              <option value="">No branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>}
          <Field label="Phone" value={form.phone_number} onChange={(value) => setForm((prev) => ({ ...prev, phone_number: value }))} />
          <button disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            <HiOutlinePencilSquare className="h-5 w-5" />
            Update User
          </button>
        </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#F3E8EF] pt-4"><button type="button" onClick={closeForm} disabled={isSaving} className="min-h-10 rounded-xl border border-[#E9DCE4] px-4 py-2 text-sm font-bold text-[#6B5561] hover:bg-[#FFF8FB] disabled:opacity-50">Cancel</button></div>
          </form>
        </section>
      </div>}

      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, role, or branch" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none" />
          </div>
        </div>
      </section>

      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : visibleUsers.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="hidden grid-cols-[1.2fr_1fr_0.7fr_1fr_auto] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] lg:grid">
              <span>User</span><span>Email</span><span>Role</span><span>Branch</span><span></span>
            </div>
            {visibleUsers.map((user) => (
              <article key={user.id} className="grid gap-3 border-b border-[#F3E8EF] px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1.2fr_1fr_0.7fr_1fr_auto] lg:items-center">
                <p className="font-bold text-[#1F2937]">{user.full_name}</p>
                <p className="break-all text-sm text-[#6B7280]">{user.email}</p>
                <span className="w-fit rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{user.role}</span>
                <p className="text-sm text-[#6B7280]">{user.role === "customer" ? "Any branch" : user.branch_name || "No branch"}</p>
                <button type="button" onClick={() => startEdit(user)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#FFF0F7] sm:w-auto">
                  <HiOutlinePencilSquare className="h-5 w-5 text-[#D65A9A]" />
                  Edit
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No users found" description="No accounts match your search." />}
      </section>
    </OwnerWorkspace>
  );
}

function Field({ label, value, onChange, type = "text", required = false, disabled = false, autoFocus = false }) {
  return (
    <label className="text-sm font-bold text-[#1F2937]">
      {label}
      <input type={type} required={required} disabled={disabled} autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none disabled:opacity-60 focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
    </label>
  );
}
