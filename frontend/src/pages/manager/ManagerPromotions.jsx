import { useCallback, useEffect, useState } from "react";
import { HiOutlineGift, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";
import managerService from "../../services/managerService";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import SystemPopup from "../../components/common/SystemPopup";
import { CardSkeleton, ManagerWorkspace } from "./ManagerWorkspace";
import { getApiError } from "../staff/staffWorkspaceUtils";

const blank = { title: "", subtitle: "", image_url: "", start_date: "", end_date: "", is_active: true };

export default function ManagerPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPromotions((await managerService.promotions()).promotions || []); }
    catch (error) { setPopup({ tone: "error", message: getApiError(error, "Promotions could not be loaded.") }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const openCreate = () => { setEditingId(null); setForm(blank); setShowForm(true); };
  const openEdit = (item) => { setEditingId(item.id); setForm({ title: item.title, subtitle: item.subtitle || "", image_url: item.image_url || "", start_date: String(item.start_date).slice(0, 10), end_date: String(item.end_date).slice(0, 10), is_active: item.is_active }); setShowForm(true); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const wasEditing = Boolean(editingId);
      if (editingId) await managerService.updatePromotion(editingId, form); else await managerService.createPromotion(form);
      setShowForm(false); setForm(blank); setEditingId(null); await load();
      setPopup({ tone: "success", message: wasEditing ? "Promotion updated successfully." : "Promotion published successfully." });
    } catch (error) { setPopup({ tone: "error", message: getApiError(error, "Promotion could not be saved.") }); }
    finally { setBusy(false); }
  };
  const toggle = async (item) => {
    setBusy(true);
    try { await managerService.updatePromotion(item.id, { title: item.title, subtitle: item.subtitle, image_url: item.image_url, start_date: item.start_date, end_date: item.end_date, is_active: !item.is_active }); await load(); }
    catch (error) { setPopup({ tone: "error", message: getApiError(error, "Promotion status could not be changed.") }); }
    finally { setBusy(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const liveCount = promotions.filter((item) => item.is_active && String(item.start_date).slice(0, 10) <= today && String(item.end_date).slice(0, 10) >= today).length;
  return <ManagerWorkspace title="Promotions" eyebrow="Customer special offers" headerStats={[{ label: "Promotions", value: promotions.length, icon: HiOutlineGift, tone: "pink" }, { label: "Live now", value: liveCount, icon: HiOutlineGift, tone: "green" }]} actions={<button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C9558F] px-4 text-sm font-bold text-white"><HiOutlinePlus className="h-5 w-5" /> New promotion</button>}>
    {popup && <SystemPopup tone={popup.tone} message={popup.message} onClose={() => setPopup(null)} />}
    {loading ? <CardSkeleton rows={4} /> : promotions.length ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{promotions.map((item) => { const live = item.is_active && String(item.start_date).slice(0, 10) <= today && String(item.end_date).slice(0, 10) >= today; return <article key={item.id} className="overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-sm"><div className="h-36 bg-gradient-to-br from-[#D65A9A] to-[#9B3F75] bg-cover bg-center" style={item.image_url ? { backgroundImage: `linear-gradient(135deg,rgba(31,41,55,.12),rgba(214,90,154,.72)),url(${item.image_url})` } : undefined} /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-[#C85B95]">{item.subtitle || "Limited offer"}</span><h2 className="mt-1 font-extrabold text-[#1F2937]">{item.title}</h2></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${live ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{live ? "Live" : item.is_active ? "Scheduled/ended" : "Inactive"}</span></div><p className="mt-3 text-xs text-[#6B7280]">{String(item.start_date).slice(0, 10)} to {String(item.end_date).slice(0, 10)}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => openEdit(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#F3E8EF] text-xs font-bold"><HiOutlinePencilSquare className="h-4 w-4" /> Edit</button><button disabled={busy} type="button" onClick={() => toggle(item)} className="min-h-10 rounded-xl bg-[#FFF0F7] text-xs font-bold text-[#C85B95]">{item.is_active ? "Deactivate" : "Activate"}</button></div></div></article>; })}</section> : <section className="rounded-[1.5rem] border border-dashed border-[#E8C9D9] bg-white p-12 text-center"><HiOutlineGift className="mx-auto h-12 w-12 text-[#D65A9A]" /><h2 className="mt-3 font-extrabold">No promotions yet</h2><p className="mt-1 text-sm text-[#6B7280]">Create an offer and it will appear in the customer Promotions popup during its scheduled dates.</p></section>}
    {showForm && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1F2937]/50 p-4 backdrop-blur-sm"><form onSubmit={save} className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl sm:p-6"><button type="button" onClick={() => setShowForm(false)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl hover:bg-[#FFF0F7]" aria-label="Close promotion form"><HiOutlineXMark className="h-5 w-5" /></button><p className="text-xs font-bold uppercase text-[#C85B95]">{editingId ? "Edit promotion" : "New promotion"}</p><h2 className="mt-1 text-xl font-extrabold">Customer special offer</h2><label className="mt-5 block text-sm font-bold">Promotion title<input required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Example: 20% Off Facial Package" className="form-input mt-2" /></label><label className="mt-4 block text-sm font-bold">Offer label<input maxLength={80} value={form.subtitle} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Example: Weekend Special" className="form-input mt-2" /></label><label className="mt-4 block text-sm font-bold">Image URL <span className="font-normal text-[#6B7280]">(optional)</span><input type="url" maxLength={500} value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="https://..." className="form-input mt-2" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Start date<ModernDatePicker value={form.start_date} onChange={(value) => setForm((p) => ({ ...p, start_date: value }))} placeholder="Start date" ariaLabel="Promotion start date" /></label><label className="text-sm font-bold">End date<ModernDatePicker value={form.end_date} onChange={(value) => setForm((p) => ({ ...p, end_date: value }))} placeholder="End date" ariaLabel="Promotion end date" /></label></div><label className="mt-4 flex items-center gap-3 rounded-xl bg-[#FFF8FB] p-3 text-sm font-bold"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="h-5 w-5 accent-[#C85B95]" /> Active and visible during scheduled dates</label><button disabled={busy || !form.start_date || !form.end_date} className="mt-5 min-h-12 w-full rounded-xl bg-[#C9558F] font-bold text-white disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Publish promotion"}</button></form></div>}
  </ManagerWorkspace>;
}
