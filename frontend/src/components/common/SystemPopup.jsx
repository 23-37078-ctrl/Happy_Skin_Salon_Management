import { useEffect, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXMark } from "react-icons/hi2";

const variants = {
  error: { title: "Something went wrong", icon: HiOutlineExclamationTriangle, iconClass: "bg-[#FFF1F2] text-[#DC2626]" },
  warning: { title: "Please check this", icon: HiOutlineExclamationTriangle, iconClass: "bg-[#FFF7D6] text-[#D97706]" },
  success: { title: "Success", icon: HiOutlineCheckCircle, iconClass: "bg-[#DCFCE7] text-[#16A34A]" },
  info: { title: "Notice", icon: HiOutlineInformationCircle, iconClass: "bg-[#FFF0F7] text-[#D65A9A]" },
};

export default function SystemPopup({ message, children, tone = "error", title, onClose, onRetry, autoClose = false }) {
  const [visible, setVisible] = useState(true);
  const content = message ?? children;
  const variant = variants[tone] || variants.info;
  const Icon = variant.icon;

  useEffect(() => {
    if (!autoClose || !visible) return undefined;
    const timer = window.setTimeout(() => { setVisible(false); onClose?.(); }, 4000);
    return () => window.clearTimeout(timer);
  }, [autoClose, onClose, visible]);

  if (!content || !visible) return null;
  const close = () => { setVisible(false); onClose?.(); };
  const retry = () => { setVisible(false); onRetry?.(); };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#172033]/35 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="system-popup-title" aria-describedby="system-popup-message" className="relative w-full max-w-md rounded-[1.75rem] border border-[#F3E8EF] bg-white p-6 text-center shadow-[0_24px_80px_rgba(31,41,55,0.22)] sm:p-7">
        <button type="button" onClick={close} aria-label="Close message" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#FFF0F7] hover:text-[#D65A9A]"><HiOutlineXMark className="h-5 w-5" /></button>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${variant.iconClass}`}><Icon className="h-7 w-7" /></span>
        <h2 id="system-popup-title" className="mt-4 text-xl font-extrabold text-[#1F2937]">{title || variant.title}</h2>
        <div id="system-popup-message" className="mt-2 text-sm leading-6 text-[#6B7280]">{content}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {onRetry && <button type="button" onClick={retry} className="min-w-28 rounded-xl border border-[#E8B7D0] px-5 py-2.5 text-sm font-bold text-[#C85B95] transition hover:bg-[#FFF0F7]">Retry</button>}
          <button type="button" onClick={close} autoFocus className="min-w-28 rounded-xl bg-[#C9558F] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(201,85,143,0.24)] transition hover:bg-[#B94780]">Okay</button>
        </div>
      </section>
    </div>
  );
}
