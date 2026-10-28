import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineArrowLeft,
  HiOutlineChatBubbleLeftRight,
  HiOutlinePaperAirplane,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  createCustomerSupportThread,
  getCustomerBranches,
  getCustomerProfile,
  getCustomerSupportThread,
  getCustomerSupportThreads,
  requestCustomerEmailChange,
  sendCustomerProfilePhoneOtp,
  sendCustomerSupportMessage,
  verifyCustomerProfilePhoneOtp,
} from "../../services/customerService";

const MODES = [
  { id: "email", label: "Change email", description: "Request a new account email" },
  { id: "phone", label: "Change phone number", description: "Verify your new number by SMS" },
  { id: "booking", label: "Booking concern", description: "Ask about or update a booking" },
  { id: "other", label: "Other concern", description: "Message the Happy Skin owner" },
];

export default function CustomerSupportWidget() {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [profile, setProfile] = useState(null);
  const [threads, setThreads] = useState([]);
  const [thread, setThread] = useState(null);
  const [mode, setMode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otp, setOtp] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshThreads = useCallback(async () => {
    setThreads((await getCustomerSupportThreads()).threads || []);
  }, []);
  const selectThread = useCallback(async (id) => {
    setError("");
    setThread(await getCustomerSupportThread(id));
    setMode("");
  }, []);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("happy-skin-support-open", show);
    return () => window.removeEventListener("happy-skin-support-open", show);
  }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([getCustomerBranches(), getCustomerProfile(), refreshThreads()])
      .then(([branchData, customer]) => {
        const list = branchData?.branches || branchData || [];
        setBranches(list);
        setProfile(customer);
        setBranchId((current) => current || String(
          list.find((item) => item.name?.toLowerCase().includes("main"))?.id || list[0]?.id || "",
        ));
      })
      .catch((err) => setError(err.response?.data?.detail || "Unable to load customer support."));
  }, [open, refreshThreads]);

  useEffect(() => {
    if (!open || !thread?.id) return undefined;
    const timer = window.setInterval(() => selectThread(thread.id).catch(() => {}), 12000);
    return () => window.clearInterval(timer);
  }, [open, thread?.id, selectThread]);

  const resetFlow = () => {
    setMode(""); setEmail(""); setPhone(""); setOtpId(""); setOtp("");
    setBookingRef(""); setBookingDate(""); setSubject(""); setDetails("");
    setError("");
  };

  const submitEmail = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await requestCustomerEmailChange({ branch_id: Number(branchId), requested_value: email.trim() });
      setNotice("Email change request sent. Your account email will update after the owner approves it.");
      resetFlow(); await refreshThreads();
    } catch (err) { setError(err.response?.data?.detail || "Unable to request an email change."); }
    finally { setBusy(false); }
  };

  const sendPhoneCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await sendCustomerProfilePhoneOtp({
        branch_id: Number(branchId), full_name: profile?.full_name || "Customer", phone_number: phone.trim(),
      });
      setOtpId(result.verification_id);
      setNotice(`We sent a code to your new number. It expires in ${result.expires_in_minutes} minutes.`);
    } catch (err) { setError(err.response?.data?.detail || "Unable to send the SMS code."); }
    finally { setBusy(false); }
  };

  const verifyPhoneCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await verifyCustomerProfilePhoneOtp({ verification_id: otpId, branch_id: Number(branchId), code: otp });
      setNotice("Number verified. The owner will review the change before your account is updated.");
      resetFlow();
    } catch (err) { setError(err.response?.data?.detail || "Unable to verify that code."); }
    finally { setBusy(false); }
  };

  const startMessageThread = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const chatSubject = mode === "booking"
      ? `Booking concern${bookingRef.trim() ? ` · ${bookingRef.trim()}` : ""}`
      : subject.trim();
    const chatBody = mode === "booking"
      ? `Booking reference: ${bookingRef.trim() || "Not provided"}\nAppointment date: ${bookingDate || "Not provided"}\n\n${details.trim()}`
      : details.trim();
    try {
      const created = await createCustomerSupportThread({ branch_id: Number(branchId), subject: chatSubject, message: chatBody });
      setThread(created); setNotice(""); resetFlow(); await refreshThreads();
    } catch (err) { setError(err.response?.data?.detail || "Unable to send your concern."); }
    finally { setBusy(false); }
  };

  const sendReply = async (event) => {
    event.preventDefault(); if (!thread || !reply.trim()) return;
    setBusy(true); setError("");
    try { setThread(await sendCustomerSupportMessage(thread.id, reply.trim())); setReply(""); await refreshThreads(); }
    catch (err) { setError(err.response?.data?.detail || "Unable to send your message."); }
    finally { setBusy(false); }
  };

  const startNewFlow = () => { setThread(null); resetFlow(); setNotice(""); setMode("choose"); };

  return <div className="fixed bottom-5 right-4 z-[70] sm:bottom-6 sm:right-6">
    {open && <section aria-label="Happy Skin customer support" className="mb-3 flex h-[min(40rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#F0DCE7] bg-white shadow-[0_20px_60px_rgba(58,30,48,0.24)]">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#B94B86] to-[#D65A9A] px-4 py-3 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20"><HiOutlineChatBubbleLeftRight className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-extrabold">Happy Skin support</h2><p className="text-[11px] text-white/85">Chat directly with the owner</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"><HiOutlineXMark className="h-5 w-5" /></button>
      </header>

      {thread ? <>
        <div className="flex items-center gap-2 border-b border-[#F3E8EF] px-3 py-2"><button type="button" onClick={() => { setThread(null); setError(""); }} aria-label="Back to conversations" className="grid h-8 w-8 place-items-center rounded-lg text-[#A83F78] hover:bg-[#FFF0F7]"><HiOutlineArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><p className="truncate text-xs font-bold text-[#374151]">{thread.subject}</p><p className="text-[10px] text-[#667085]">{thread.branch_name}</p></div></div>
        <MessageList thread={thread} />
        <form onSubmit={sendReply} className="flex gap-2 border-t border-[#F3E8EF] p-3"><input required maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={thread.status === "closed" ? "Conversation closed" : "Write a message…"} disabled={busy || thread.status === "closed"} className="form-input min-w-0 flex-1 text-sm" /><button aria-label="Send message" disabled={busy || !reply.trim() || thread.status === "closed"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#B94B86] text-white disabled:opacity-50"><HiOutlinePaperAirplane className="h-5 w-5" /></button></form>
      </> : mode === "choose" ? <div className="flex-1 overflow-y-auto p-4"><h3 className="text-sm font-extrabold text-[#202534]">What do you need to change?</h3><p className="mt-1 text-xs text-[#667085]">Choose an option and I’ll guide you through the request.</p><div className="mt-4 space-y-2">{MODES.map((item) => <button key={item.id} type="button" onClick={() => { setMode(item.id); setError(""); }} className="w-full rounded-xl border border-[#F0E3EA] p-3 text-left transition hover:border-[#E3A9C7] hover:bg-[#FFFBFD]"><span className="block text-sm font-bold text-[#374151]">{item.label}</span><span className="mt-1 block text-[11px] text-[#667085]">{item.description}</span></button>)}</div></div>
      : mode ? <GuidedForm mode={mode} branches={branches} branchId={branchId} setBranchId={setBranchId} email={email} setEmail={setEmail} phone={phone} setPhone={setPhone} otpId={otpId} otp={otp} setOtp={setOtp} bookingRef={bookingRef} setBookingRef={setBookingRef} bookingDate={bookingDate} setBookingDate={setBookingDate} subject={subject} setSubject={setSubject} details={details} setDetails={setDetails} busy={busy} onEmail={submitEmail} onSendOtp={sendPhoneCode} onVerifyOtp={verifyPhoneCode} onMessage={startMessageThread} onBack={startNewFlow} />
      : <>
        <div className="flex-1 overflow-y-auto p-3"><p className="px-1 pb-2 text-xs text-[#667085]">Select a previous conversation or start a guided request.</p>{threads.map((item) => <button key={item.id} type="button" onClick={() => selectThread(item.id)} className="mb-2 w-full rounded-xl border border-[#F3E8EF] p-3 text-left transition hover:border-[#E8B7D0] hover:bg-[#FFFBFD]"><span className="block truncate text-xs font-extrabold text-[#374151]">{item.subject}</span><span className="mt-1 block truncate text-[10px] text-[#667085]">{item.branch_name} · {new Date(item.updated_at).toLocaleString()}</span></button>)}{!threads.length && <div className="rounded-xl bg-[#FFFBFD] p-4 text-center text-xs text-[#667085]">No conversations yet. Start a request and the owner will reply here.</div>}</div>
        <div className="border-t border-[#F3E8EF] p-3"><button type="button" onClick={startNewFlow} className="min-h-11 w-full rounded-xl bg-[#B94B86] px-4 text-sm font-bold text-white">Start a request</button></div>
      </>}
      {notice && <p role="status" className="border-t border-green-100 bg-green-50 px-3 py-2 text-xs leading-5 text-green-800">{notice}</p>}
      {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close customer support" : "Open customer support"} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#B94B86] px-4 text-white shadow-[0_10px_30px_rgba(185,75,134,0.35)] transition hover:-translate-y-0.5 hover:bg-[#A83F78] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/25"><HiOutlineChatBubbleLeftRight className="h-6 w-6" /><span className="pr-1 text-sm font-extrabold">Chat with us</span></button>
  </div>;
}

function GuidedForm({ mode, branches, branchId, setBranchId, email, setEmail, phone, setPhone, otpId, otp, setOtp, bookingRef, setBookingRef, bookingDate, setBookingDate, subject, setSubject, details, setDetails, busy, onEmail, onSendOtp, onVerifyOtp, onMessage, onBack }) {
  const title = MODES.find((item) => item.id === mode)?.label || "New request";
  return <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"><div className="flex items-center gap-2"><button type="button" onClick={onBack} aria-label="Back to request options" className="grid h-8 w-8 place-items-center rounded-lg text-[#A83F78] hover:bg-[#FFF0F7]"><HiOutlineArrowLeft className="h-4 w-4" /></button><h3 className="text-sm font-extrabold text-[#202534]">{title}</h3></div>
    {(mode === "email" || mode === "phone" || mode === "booking" || mode === "other") && <BranchField branches={branches} value={branchId} onChange={setBranchId} />}
    {mode === "email" && <form onSubmit={onEmail} className="space-y-3"><p className="text-xs leading-5 text-[#667085]">The owner will review your new email before your account is changed.</p><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="New email address" className="form-input w-full text-sm" /><SubmitButton busy={busy} label="Send email change request" /></form>}
    {mode === "phone" && (!otpId ? <form onSubmit={onSendOtp} className="space-y-3"><p className="text-xs leading-5 text-[#667085]">We’ll verify the new number by SMS, then send it to the owner for approval.</p><input required type="tel" inputMode="tel" autoComplete="tel" minLength={7} maxLength={20} pattern="[+0-9 ()-]{7,20}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="New mobile number" className="form-input w-full text-sm" /><SubmitButton busy={busy} label="Send SMS code" /></form> : <form onSubmit={onVerifyOtp} className="space-y-3"><p className="text-xs leading-5 text-[#667085]">Enter the code sent to {phone}.</p><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="form-input w-full text-sm" /><SubmitButton busy={busy} label="Verify and request approval" /></form>)}
    {(mode === "booking" || mode === "other") && <form onSubmit={onMessage} className="space-y-3">{mode === "booking" ? <><p className="text-xs leading-5 text-[#667085]">Add your booking details so the owner can find the right appointment.</p><input value={bookingRef} onChange={(event) => setBookingRef(event.target.value)} placeholder="Booking reference (if available)" className="form-input w-full text-sm" /><label className="block text-xs font-bold text-[#667085]">Appointment date<input type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} className="form-input mt-1 w-full text-sm" /></label></> : <input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What is your concern about?" className="form-input w-full text-sm" />}<textarea required maxLength={4000} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder={mode === "booking" ? "Describe what you need help with…" : "Add details for the owner…"} className="form-input w-full resize-y text-sm" /><SubmitButton busy={busy} label="Send to owner" /></form>}
  </div>;
}

function BranchField({ branches, value, onChange }) { return <label className="block text-xs font-bold text-[#667085]">Branch<select required value={value} onChange={(event) => onChange(event.target.value)} className="form-input mt-1 w-full text-sm">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>; }
function SubmitButton({ busy, label }) { return <button disabled={busy} className="min-h-11 w-full rounded-xl bg-[#B94B86] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "Please wait…" : label}</button>; }
function MessageList({ thread }) { return <div className="flex-1 space-y-3 overflow-y-auto bg-[#FFFBFD] p-3">{thread.messages?.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2 ${message.sender_role === "customer" ? "ml-auto bg-[#B94B86] text-white" : "border border-[#F0E3EA] bg-white text-[#374151]"}`}><p className="mb-1 text-[10px] font-bold opacity-70">{message.sender_role === "customer" ? "You" : "Happy Skin owner"}</p><p className="whitespace-pre-wrap text-xs leading-5">{message.body}</p><time className="mt-1 block text-right text-[9px] opacity-70">{new Date(message.created_at).toLocaleString()}</time></div>)}</div>; }
