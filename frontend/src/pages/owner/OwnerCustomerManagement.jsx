import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlinePencilSquare, HiOutlineUserGroup, HiOutlineXMark } from "react-icons/hi2";
import { OwnerWorkspace } from "./OwnerWorkspace";
import ownerService from "../../services/ownerService";

export default function OwnerCustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone_number: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true); setError("");
    try { setCustomers((await ownerService.customers(search.trim())).customers || []); }
    catch (err) { setError(err.response?.data?.detail || "Unable to load customers."); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { const timer = window.setTimeout(loadCustomers, 250); return () => window.clearTimeout(timer); }, [loadCustomers]);

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({ full_name: customer.full_name || "", email: customer.email || "", phone_number: customer.phone_number || "" });
    setError(""); setSuccess("");
  };
  const closeEdit = () => { if (!saving) setEditing(null); };
  const save = async (event) => {
    event.preventDefault(); if (!editing) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await ownerService.updateCustomer(editing.id, {
        full_name: form.full_name.trim(), email: form.email.trim(), phone_number: form.phone_number.trim() || null,
      });
      setCustomers((rows) => rows.map((row) => row.id === result.id ? { ...row, ...result } : row));
      setEditing(null);
      setSuccess(`Updated ${result.full_name}'s customer account.${result.phone_changed ? " The new phone number needs SMS verification." : ""}`);
    } catch (err) { setError(err.response?.data?.detail || "Unable to update this customer."); }
    finally { setSaving(false); }
  };

  const verificationSummary = useMemo(() => ({
    verified: customers.filter((customer) => customer.phone_verified).length,
    needsVerification: customers.filter((customer) => customer.phone_number && !customer.phone_verified).length,
  }), [customers]);

  return <OwnerWorkspace title="Customer management" eyebrow="All customers" headerStats={[
    { label: "Customers", value: customers.length, icon: HiOutlineUserGroup, tone: "pink" },
    { label: "Phone verified", value: verificationSummary.verified, icon: HiOutlineUserGroup, tone: "green" },
    { label: "Needs verification", value: verificationSummary.needsVerification, icon: HiOutlineUserGroup, tone: "amber" },
  ]}>
    <section className="rounded-2xl border border-[#F0E3EA] bg-white p-4 shadow-sm sm:p-6">
      <div className="relative"><HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#B94B86]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer name, email, or phone" className="form-input w-full pl-10" /></div>
      <p className="mt-3 text-xs leading-5 text-[#667085]">You can update customer contact information across all branches. If you change a phone number, the customer must verify the new number by SMS before it can be used as verified contact information.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      {loading ? <p className="py-12 text-center text-sm text-[#667085]">Loading customers…</p> : customers.length ? <div className="mt-5 divide-y divide-[#F3E8EF] overflow-hidden rounded-xl border border-[#F3E8EF]">{customers.map((customer) => <article key={customer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="truncate font-bold text-[#202534]">{customer.full_name}</h2><p className="mt-1 break-all text-sm text-[#667085]">{customer.email}</p><p className="mt-1 text-sm text-[#667085]">{customer.phone_number || "No phone number"}</p><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${customer.email_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>Email {customer.email_verified ? "verified" : "unverified"}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${customer.phone_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>Phone {customer.phone_verified ? "verified" : "unverified"}</span></div></div><button type="button" onClick={() => openEdit(customer)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E8B7D0] px-4 text-sm font-bold text-[#A83F78] hover:bg-[#FFF0F7]"><HiOutlinePencilSquare className="h-4 w-4" /> Edit customer</button></article>)}</div> : <p className="py-12 text-center text-sm text-[#667085]">No customer accounts found.</p>}
    </section>

    {editing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F1720]/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit(); }}><section role="dialog" aria-modal="true" aria-labelledby="edit-customer-title" className="w-full max-w-xl rounded-2xl border border-[#F0E3EA] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#B94B86]">Customer account</p><h2 id="edit-customer-title" className="mt-1 text-xl font-extrabold text-[#202534]">Edit customer details</h2><p className="mt-1 text-sm text-[#667085]">Changes apply to this customer's account.</p></div><button type="button" onClick={closeEdit} disabled={saving} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-[#667085] hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-5 w-5" /></button></div><form onSubmit={save} className="mt-5 space-y-4">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="block text-sm font-bold text-[#374151]">Full name<input required minLength={2} maxLength={100} value={form.full_name} onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))} className="form-input mt-1 w-full" /></label><label className="block text-sm font-bold text-[#374151]">Email<input required type="email" maxLength={255} value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} className="form-input mt-1 w-full" /></label><label className="block text-sm font-bold text-[#374151]">Phone number<input type="tel" inputMode="tel" maxLength={20} value={form.phone_number} onChange={(event) => setForm((value) => ({ ...value, phone_number: event.target.value }))} className="form-input mt-1 w-full" placeholder="09XX XXX XXXX" /><span className="mt-1 block text-xs font-normal text-[#667085]">Changing this number marks it unverified until the customer completes SMS verification.</span></label><div className="flex justify-end gap-2 border-t border-[#F3E8EF] pt-4"><button type="button" onClick={closeEdit} disabled={saving} className="min-h-10 rounded-xl border border-[#E8B7D0] px-4 text-sm font-bold text-[#A83F78]">Cancel</button><button disabled={saving} className="min-h-10 rounded-xl bg-[#B94B86] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div></form></section></div>}
  </OwnerWorkspace>;
}
