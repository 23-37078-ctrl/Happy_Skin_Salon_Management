import { useEffect, useId, useRef, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXMark } from "react-icons/hi2";

const variants = {
  error: { title: "Something went wrong", icon: HiOutlineExclamationTriangle, iconClass: "bg-[#FFF1F2] text-[#DC2626]" },
  warning: { title: "Please check this", icon: HiOutlineExclamationTriangle, iconClass: "bg-[#FFF7D6] text-[#D97706]" },
  success: { title: "Success", icon: HiOutlineCheckCircle, iconClass: "bg-[#DCFCE7] text-[#16A34A]" },
  info: { title: "Notice", icon: HiOutlineInformationCircle, iconClass: "bg-[#FFF0F7] text-[#D65A9A]" },
};

export default function SystemPopup({ message, children, tone = "error", title, onClose, onRetry, autoClose = false }) {
  const [dismissedContent, setDismissedContent] = useState(null);
  const dialogId = useId();
  const dialogRef = useRef(null);
  const content = message ?? children;
  const variant = variants[tone] || variants.info;
  const Icon = variant.icon;

  const visible = Boolean(content) && dismissedContent !== content;

  useEffect(() => {
    if (!visible) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDismissedContent(content);
        onClose?.();
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [content, onClose, visible]);

  useEffect(() => {
    if (!autoClose || !visible) return undefined;
    const timer = window.setTimeout(() => { setDismissedContent(content); onClose?.(); }, 4000);
    return () => window.clearTimeout(timer);
  }, [autoClose, content, onClose, visible]);

  if (!content || !visible) return null;
  const close = () => { setDismissedContent(content); onClose?.(); };
  const retry = () => { onRetry?.(); };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#172033]/35 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} aria-describedby={`${dialogId}-message`} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-[#F3E8EF] bg-white p-6 text-center shadow-[0_24px_80px_rgba(31,41,55,0.22)] focus:outline-none sm:p-7">
        <button type="button" onClick={close} aria-label="Close message" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#FFF0F7] hover:text-[#D65A9A]"><HiOutlineXMark className="h-5 w-5" /></button>
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${variant.iconClass}`}><Icon className="h-7 w-7" /></span>
        <h2 id={`${dialogId}-title`} className="mt-4 text-xl font-extrabold text-[#1F2937]">{title || variant.title}</h2>
        <div id={`${dialogId}-message`} className="mt-2 text-sm leading-6 text-[#6B7280]">{content}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {onRetry && <button type="button" onClick={retry} className="min-w-28 rounded-xl border border-[#E8B7D0] px-5 py-2.5 text-sm font-bold text-[#C85B95] transition hover:bg-[#FFF0F7]">Retry</button>}
          <button type="button" onClick={close} className="min-h-11 min-w-28 rounded-xl bg-[var(--color-action-bg)] px-5 py-2.5 text-sm font-bold text-[var(--color-action-text)] shadow-[0_8px_20px_rgba(201,85,143,0.24)] transition hover:brightness-95">Okay</button>
        </div>
      </section>
    </div>
  );
}
