import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineUsers } from "react-icons/hi2";
import ownerService from "../../services/ownerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, Notice, OwnerWorkspace, StatCard } from "./OwnerWorkspace";

const roles = ["owner", "manager", "staff", "customer"];
const emptyForm = { full_name: "", email: "", password: "", role: "staff", branch_id: "", phone_number: "", email_verified: true };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await ownerService.users({ role: roleFilter === "all" ? null : roleFilter });
      setUsers(payload.users || []);
      setBranches(payload.branches || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load users."));
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    Promise.resolve().then(() => loadUsers());
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.full_name, user.email, user.role, user.branch_name].join(" ").toLowerCase().includes(term));
  }, [search, users]);

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    const payload = { ...form, branch_id: form.branch_id ? Number(form.branch_id) : null, phone_number: form.phone_number || null };
    try {
      if (editingId) {
        await ownerService.updateUser(editingId, {
          full_name: payload.full_name,
          role: payload.role,
          branch_id: payload.branch_id,
          phone_number: payload.phone_number,
          email_verified: payload.email_verified,
        });
      } else {
        await ownerService.createUser(payload);
      }
      setSuccess(editingId ? "User updated." : "User created.");
      setEditingId(null);
      setForm(emptyForm);
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
      password: "",
      role: user.role || "staff",
      branch_id: user.branch_id || "",
      phone_number: user.phone_number || "",
      email_verified: Boolean(user.email_verified),
    });
  };

  return (
    <OwnerWorkspace title="User Management" eyebrow="Role-based account control">
      {error && <Notice message={error} onRetry={loadUsers} />}
      {success && <Notice tone="success" message={success} />}

      <section className="grid gap-3 sm:grid-cols-4">
        {roles.map((role) => <StatCard key={role} label={role} value={users.filter((user) => user.role === role).length} icon={HiOutlineUsers} tone={role === "owner" ? "pink" : role === "manager" ? "blue" : role === "staff" ? "green" : "amber"} />)}
      </section>

      <form onSubmit={submit} className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Full name" value={form.full_name} onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required disabled={Boolean(editingId)} />
          {!editingId && <Field label="Password" type="password" value={form.password} onChange={(value) => setForm((prev) => ({ ...prev, password: value }))} required />}
          <label className="text-sm font-bold text-[#1F2937]">
            Role
            <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none">
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#1F2937]">
            Assigned branch
            <select value={form.branch_id} onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none">
              <option value="">No branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <Field label="Phone" value={form.phone_number} onChange={(value) => setForm((prev) => ({ ...prev, phone_number: value }))} />
          <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm font-bold text-[#1F2937]">
            <input type="checkbox" checked={form.email_verified} onChange={(event) => setForm((prev) => ({ ...prev, email_verified: event.target.checked }))} />
            Verified
          </label>
          <button disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {editingId ? <HiOutlinePencilSquare className="h-5 w-5" /> : <HiOutlinePlus className="h-5 w-5" />}
            {editingId ? "Update User" : "Create User"}
          </button>
        </div>
      </form>

      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, role, or branch" className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {["all", ...roles].map((role) => <button key={role} type="button" onClick={() => setRoleFilter(role)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold capitalize ${roleFilter === role ? "bg-[#C85B95] text-white" : "bg-[#FFF8FB] text-[#6B7280]"}`}>{role}</button>)}
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
              <article key={user.id} className="grid gap-3 border-b border-[#F3E8EF] px-5 py-4 last:border-0 lg:grid-cols-[1.2fr_1fr_0.7fr_1fr_auto] lg:items-center">
                <p className="font-bold text-[#1F2937]">{user.full_name}</p>
                <p className="break-all text-sm text-[#6B7280]">{user.email}</p>
                <span className="w-fit rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold capitalize text-[#C85B95]">{user.role}</span>
                <p className="text-sm text-[#6B7280]">{user.branch_name || "No branch"}</p>
                <button type="button" onClick={() => startEdit(user)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#FFF0F7]">
                  <HiOutlinePencilSquare className="h-5 w-5 text-[#D65A9A]" />
                  Edit
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No users found" description="Create owner, manager, staff, or customer accounts and assign branch access where needed." />}
      </section>
    </OwnerWorkspace>
  );
}

function Field({ label, value, onChange, type = "text", required = false, disabled = false }) {
  return (
    <label className="text-sm font-bold text-[#1F2937]">
      {label}
      <input type={type} required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none disabled:opacity-60 focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
    </label>
  );
}
