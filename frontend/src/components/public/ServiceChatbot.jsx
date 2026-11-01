import { useMemo, useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiOutlinePaperAirplane, HiOutlineXMark } from "react-icons/hi2";
import { SALON_SERVICES, formatServicePrice } from "../../constants/salonServices";

const FAQS = [
  { keywords: ["service", "services", "offer", "treatment", "facial", "nail", "hair", "massage", "wax", "peel"], answer: "You can browse our current salon services, descriptions, prices, and duration in the Services section on this page." },
  { keywords: ["price", "cost", "how much", "rates"], answer: "Prices depend on the service. Browse the Services section for current prices, or ask me about a specific treatment." },
  { keywords: ["duration", "long", "minutes", "time"], answer: "Service duration depends on the treatment. Check the duration shown on each service card." },
  { keywords: ["book", "booking", "appointment", "schedule", "reserve"], answer: "To book, choose a service and use its Book button. You can then select your branch and an available appointment schedule." },
  { keywords: ["branch", "location", "where", "address"], answer: "Open the Branches section on this page to see salon locations and branch contact details." },
  { keywords: ["phone", "number", "call", "contact"], answer: "You can find the salon contact number and branch phone numbers in the Contact and Branches sections." },
  { keywords: ["open", "hours", "operating"], answer: "Please check the selected branch details for its current operating hours." },
];

const SUGGESTED_QUESTIONS = [
  "What services do you offer?",
  "How much does a service cost?",
  "How can I book an appointment?",
  "Where are your branches?",
];

function answerQuestion(question, services) {
  const text = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const service = services.find((item) => text.includes(item.name.toLowerCase()));
  if (service) {
    return `${service.name}: ${service.description || "A salon service offered by Happy Skin."} Price: ${formatServicePrice(service.price)}. Duration: ${service.duration_minutes || service.duration || "Varies"} minutes.`;
  }
  const faq = FAQS.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  return faq?.answer || "I can help with service details, prices, durations, bookings, and branch information. Try asking about a specific service, or browse the Services section.";
}

export default function ServiceChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "bot", text: "Hi! I can answer questions about Happy Skin services, prices, durations, and booking." }]);
  const serviceList = useMemo(() => SALON_SERVICES, []);

  const send = (event) => {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    ask(question);
  };

  const ask = (question) => {
    setMessages((current) => [...current, { role: "user", text: question }, { role: "bot", text: answerQuestion(question, serviceList) }]);
  };

  return <div className="fixed bottom-5 right-4 z-[70] sm:bottom-6 sm:right-6">
    {open && <section aria-label="Happy Skin service chatbot" className="mb-3 flex h-[min(36rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#F0DCE7] bg-white shadow-[0_20px_60px_rgba(58,30,48,0.24)]">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#B94B86] to-[#D65A9A] px-4 py-3 text-white"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/20"><HiOutlineChatBubbleLeftRight className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-extrabold">Happy Skin service assistant</h2><p className="text-[11px] text-white/85">Automated answers about our services</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"><HiOutlineXMark className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#FFFBFD] p-4" aria-live="polite">{messages.map((message, index) => <div key={`${index}-${message.role}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${message.role === "user" ? "ml-auto bg-[#B94B86] text-white" : "border border-[#F0E3EA] bg-white text-[#374151]"}`}>{message.text}</div>)}{messages.length === 1 && <div className="flex flex-wrap gap-2" aria-label="Suggested questions">{SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => ask(question)} className="rounded-full border border-[#E8B7D0] bg-white px-3 py-2 text-left text-xs font-semibold text-[#A83F78] transition hover:bg-[#FFF0F7]">{question}</button>)}</div>}</div>
      <form onSubmit={send} className="flex gap-2 border-t border-[#F3E8EF] p-3"><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Ask about a service…" aria-label="Ask about salon services" className="form-input min-w-0 flex-1 text-sm" /><button aria-label="Send question" disabled={!input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#B94B86] text-white disabled:opacity-50"><HiOutlinePaperAirplane className="h-5 w-5" /></button></form>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close service chatbot" : "Open service chatbot"} className="ml-auto flex h-14 items-center gap-2 rounded-full bg-[#B94B86] px-4 text-white shadow-[0_10px_30px_rgba(185,75,134,0.35)] transition hover:-translate-y-0.5 hover:bg-[#A83F78]"><HiOutlineChatBubbleLeftRight className="h-6 w-6" /><span className="pr-1 text-sm font-extrabold">Chat with us</span></button>
  </div>;
}
