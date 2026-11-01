import { useCallback, useEffect, useState } from "react";
import { OwnerWorkspace } from "./OwnerWorkspace";
import ownerService from "../../services/ownerService";

const DEFAULT_ANSWERS = [
  { question: "What services do you offer?", answer: "Browse our Services section to see current treatments, descriptions, prices, and durations." },
  { question: "How much does a service cost?", answer: "Prices depend on the selected service. Check the service cards for current pricing." },
  { question: "How long does a service take?", answer: "Duration depends on the treatment. Each service card shows its estimated duration." },
  { question: "How can I book an appointment?", answer: "Choose a service and select Book to continue to branch and schedule selection." },
  { question: "Where are your branches?", answer: "Visit the Branches section to view locations and branch contact details." },
  { question: "What is the salon contact number?", answer: "The salon contact number and branch phone numbers are listed in the Contact and Branches sections." },
];

export default function OwnerCustomerSupport() {
  const [tab, setTab] = useState("chatbot");
  const [requests, setRequests] = useState([]);
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshRequests = useCallback(async () => {
    const result = await ownerService.profileChangeRequests("pending");
    setRequests(result.requests || []);
  }, []);

  useEffect(() => { refreshRequests().catch((err) => setError(err.response?.data?.detail || "Unable to load contact change requests.")); }, [refreshRequests]);

  const decide = async (id, decision) => {
    setBusyId(id); setError(""); setNotice("");
    try {
      await ownerService.reviewProfileChangeRequest(id, { decision, manager_note: note.trim() || null });
      setNote(""); setNotice("Contact change request updated."); await refreshRequests();
    } catch (err) { setError(err.response?.data?.detail || "Unable to review this request."); }
    finally { setBusyId(null); }
  };

  const updateAnswer = (index, field, value) => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));

  return <OwnerWorkspace title="Customer support" eyebrow="Service chatbot and contact care">
    <section className="rounded-2xl border border-[#F0E3EA] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap gap-2 border-b border-[#F3E8EF] pb-4">
        <button onClick={() => setTab("chatbot")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "chatbot" ? "bg-[#B94B86] text-white" : "bg-[#FFF8FB] text-[#667085]"}`}>Chatbot answers</button>
        <button onClick={() => setTab("requests")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "requests" ? "bg-[#B94B86] text-white" : "bg-[#FFF8FB] text-[#667085]"}`}>Contact changes ({requests.length})</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {tab === "chatbot" ? <div className="mt-5">
        <h2 className="text-lg font-extrabold text-[#202534]">Automated service FAQ</h2>
        <p className="mt-1 text-sm text-[#667085]">These are the answers shown by the landing-page chatbot. The chatbot also reads service names, descriptions, prices, and durations from the service list.</p>
        <div className="mt-4 space-y-3">{answers.map((item, index) => <article key={item.question} className="rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] p-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-[#A83F78]">Sample question<input readOnly value={item.question} className="form-input mt-2 w-full bg-white normal-case tracking-normal text-[#374151]" /></label>
          <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#A83F78]">Chatbot answer<textarea rows={2} value={item.answer} onChange={(event) => updateAnswer(index, "answer", event.target.value)} className="form-input mt-2 w-full resize-y bg-white normal-case tracking-normal text-[#374151]" /></label>
        </article>)}</div>
        <p className="mt-4 rounded-xl bg-[#FFF8FB] p-3 text-xs leading-5 text-[#667085]">FAQ answer editing is a preview in this version and resets when the page reloads. Customer and owner phone numbers remain managed in their existing contact settings.</p>
      </div> : <div className="mt-4 space-y-3">
        <h2 className="text-lg font-extrabold text-[#202534]">Customer contact change requests</h2>
        {requests.map((item) => <article key={item.id} className="rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#202534]">{item.customer?.full_name} · {item.field === "email" ? "Email change" : "Phone change"}</h3><p className="mt-1 text-sm text-[#667085]">{item.customer?.email} · {item.customer?.phone_number || "No phone saved"}</p><p className="mt-3 text-sm"><span className="text-[#667085]">Current:</span> <strong>{item.current_value || "Not provided"}</strong></p><p className="text-sm"><span className="text-[#667085]">Requested:</span> <strong className="text-[#A83F78]">{item.requested_value}</strong></p><p className="mt-2 text-xs text-[#667085]">{item.branch_name} · {item.field === "phone_number" ? "SMS verified" : "Email request"} · {item.created_at ? new Date(item.created_at).toLocaleString() : ""}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending</span></div>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note to customer" className="form-input mt-4 w-full" />
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={busyId === item.id} onClick={() => decide(item.id, "approved")} className="min-h-10 rounded-xl bg-[#B94B86] px-5 text-sm font-bold text-white disabled:opacity-50">Approve and update account</button><button disabled={busyId === item.id} onClick={() => decide(item.id, "rejected")} className="min-h-10 rounded-xl border border-red-200 px-5 text-sm font-bold text-red-700 disabled:opacity-50">Reject</button></div>
        </article>)}
        {!requests.length && <p className="py-10 text-center text-sm text-[#667085]">No contact change requests waiting for review.</p>}
      </div>}
    </section>
  </OwnerWorkspace>;
}
