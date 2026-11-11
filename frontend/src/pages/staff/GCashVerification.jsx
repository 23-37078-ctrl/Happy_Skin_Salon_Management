import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { StaffWorkspace } from "./StaffWorkspace";

export default function GCashVerification() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState("");
  const load = useCallback(async () => {
    setIsLoading(true);
    try { const { data } = await api.get("/staff/transactions/gcash/verification-queue"); setRows(data); setError(""); }
    catch (err) { setError(err.response?.data?.detail || "Verification queue could not be loaded."); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const viewProof = async (id) => {
    try {
      const { data } = await api.get(`/staff/transactions/gcash/${id}/proof`, { responseType: "blob" });
      if (proofUrl) URL.revokeObjectURL(proofUrl);
      setProofUrl(URL.createObjectURL(data));
    } catch (err) { setError(err.response?.data?.detail || "Proof image could not be loaded."); }
  };
  const decide = async (row, decision) => {
    const remarks = window.prompt(decision === "approved" ? "Record which merchant record you checked and the matching payment details:" : "Reason for rejecting this proof:");
    if (remarks === null || !remarks.trim()) return;
    if (!window.confirm(`Confirm ${decision} for booking ${row.booking_reference}? Verify the funds in merchant records first.`)) return;
    setBusy(String(row.submission_id));
    try { await api.post(`/staff/transactions/gcash/${row.submission_id}/decision`, { decision, remarks }); await load(); }
    catch (err) { setError(err.response?.data?.detail || "Payment decision could not be recorded."); }
    finally { setBusy(""); }
  };

  return <StaffWorkspace title="GCash Verification" eyebrow="Payments">
    <div className="space-y-4">
      <p className="rounded-xl border border-[#F2D8B7] bg-[#FFFAF2] p-4 text-sm leading-6 text-[#755B3B]">Compare every submission with the official merchant wallet or business portal before making a decision. Uploaded screenshots and customer references do not prove funds were received.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {isLoading && <p role="status" className="rounded-xl border border-[#F3E8EF] bg-white p-6 text-center text-sm text-[#667085]">Loading the verification queue…</p>}
      {!isLoading && !rows.length && !error && <p className="rounded-xl border border-dashed border-[#E8B7D0] bg-white p-8 text-center text-sm text-[#667085]">No GCash submissions are waiting for verification.</p>}
      {rows.map((row) => <article key={row.submission_id} className="rounded-2xl border border-[#F3E8EF] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Booking:</strong> {row.booking_reference}</p><p><strong>Customer:</strong> {row.customer}</p><p><strong>Expected amount:</strong> PHP {Number(row.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p><p><strong>GCash reference:</strong> {row.reference_number}</p><p><strong>Proof submitted:</strong> {new Date(row.submitted_at).toLocaleString()}</p></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => viewProof(row.submission_id)} className="min-h-10 rounded-lg border px-4 text-sm font-bold">View proof</button><button disabled={!!busy} type="button" onClick={() => decide(row, "approved")} className="min-h-10 rounded-lg bg-green-700 px-4 text-sm font-bold text-white disabled:opacity-50">Approve after verification</button><button disabled={!!busy} type="button" onClick={() => decide(row, "rejected")} className="min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">Reject</button></div>
      </article>)}
      {proofUrl && <div role="dialog" aria-modal="true" aria-label="GCash proof image" className="fixed inset-0 z-[150] grid place-items-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { URL.revokeObjectURL(proofUrl); setProofUrl(""); } }}><div className="max-h-[90vh] max-w-full rounded-xl bg-white p-3"><button type="button" className="mb-2 rounded-lg border px-3 py-2 text-sm" onClick={() => { URL.revokeObjectURL(proofUrl); setProofUrl(""); }}>Close proof</button><img src={proofUrl} alt="Customer submitted GCash payment proof" className="max-h-[78vh] max-w-full object-contain" /></div></div>}
    </div>
  </StaffWorkspace>;
}
