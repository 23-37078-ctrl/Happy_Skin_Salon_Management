import { useEffect, useState } from "react";
import { HiOutlinePrinter, HiOutlineXMark } from "react-icons/hi2";
import QRCode from "qrcode";
import { formatCurrency, formatDateTime } from "./staffWorkspaceUtils";

export default function PaymentReceipt({ receipt, onClose }) {
  const extras = receipt.additional_charges || [];
  const [ratingQr, setRatingQr] = useState("");
  const ratingUrl = `${window.location.origin}/feedback?booking=${encodeURIComponent(receipt.booking_id)}&receipt=${encodeURIComponent(receipt.transaction_id)}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(ratingUrl, { width: 220, margin: 1, errorCorrectionLevel: "M", color: { dark: "#713B5A", light: "#FFFFFF" } })
      .then((value) => { if (active) setRatingQr(value); })
      .catch(() => { if (active) setRatingQr(""); });
    return () => { active = false; };
  }, [ratingUrl]);

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1F2937]/55 p-4 backdrop-blur-sm print:static print:block print:bg-transparent print:p-0" role="dialog" aria-modal="true" aria-label={`Receipt number ${receipt.transaction_id}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
  <section className="payment-receipt-print relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-2xl print:max-h-none print:border-0 print:shadow-none">
    {onClose && <button type="button" onClick={onClose} aria-label="Close receipt" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl bg-white/90 text-[#6B7280] shadow-sm hover:bg-[#FFF0F7] print:hidden"><HiOutlineXMark className="h-5 w-5" /></button>}
    <div className="bg-gradient-to-r from-[#FFF0F7] to-[#FFF8FB] px-5 py-6 text-center">
      <img src="/images/happy-skin-logo.svg" alt="Happy Skin logo" className="mx-auto h-20 w-20 object-contain" />
      <h2 className="mt-2 text-xl font-extrabold text-[#713B5A]">Happy Skin Nails Spa &amp; Aesthetics</h2>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#C85B95]">Official payment receipt</p>
      {receipt.branch_name && <p className="mt-2 text-sm text-[#6B7280]">{receipt.branch_name}</p>}
    </div>

    <div className="p-5 text-sm text-[#374151]">
      <div className="grid gap-2 border-b border-dashed border-[#E5E7EB] pb-4 sm:grid-cols-2">
        <p><span className="text-[#6B7280]">Receipt no.</span><br /><strong>#{receipt.transaction_id}</strong></p>
        <p><span className="text-[#6B7280]">Booking no.</span><br /><strong>#{receipt.booking_id}</strong></p>
        <p><span className="text-[#6B7280]">Payment date &amp; time</span><br /><strong>{formatDateTime(receipt.created_at)}</strong></p>
        {receipt.appointment_date && <p><span className="text-[#6B7280]">Appointment date &amp; time</span><br /><strong>{formatDateTime(receipt.appointment_date)}</strong></p>}
      </div>

      <div className="grid gap-2 border-b border-dashed border-[#E5E7EB] py-4 sm:grid-cols-2">
        <p><span className="text-[#6B7280]">Customer</span><br /><strong>{receipt.customer_name}</strong></p>
        <p><span className="text-[#6B7280]">Contact number</span><br /><strong>{receipt.customer_phone || "Not provided"}</strong></p>
        <p><span className="text-[#6B7280]">Service</span><br /><strong>{receipt.service}</strong></p>
        <p><span className="text-[#6B7280]">Service provider</span><br /><strong>{receipt.service_provider}</strong></p>
      </div>

      <div className="space-y-2 py-4">
        <p className="flex justify-between gap-4"><span>Service</span><strong>{formatCurrency(receipt.base_price)}</strong></p>
        {extras.map((item, index) => <p key={`${item.reason}-${index}`} className="flex justify-between gap-4"><span>{item.reason}</span><strong>{formatCurrency(item.amount)}</strong></p>)}
        {Number(receipt.commission_amount || 0) > 0 && <p className="flex justify-between gap-4"><span>Staff commission / tip</span><strong>{formatCurrency(receipt.commission_amount)}</strong></p>}
        <p className="flex justify-between gap-4 border-t border-[#E5E7EB] pt-3 text-base"><span className="font-extrabold">Total paid</span><strong className="text-[#166534]">{formatCurrency(receipt.total)}</strong></p>
        <p className="flex justify-between gap-4"><span>Payment method</span><strong className="capitalize">{String(receipt.payment_method || "").replace("_", " ")}</strong></p>
        <p className="flex justify-between gap-4"><span>Amount tendered</span><strong>{formatCurrency(receipt.amount_tendered)}</strong></p>
        <p className="flex justify-between gap-4"><span>Change</span><strong>{formatCurrency(receipt.change)}</strong></p>
      </div>

      <div className="rounded-2xl border border-dashed border-[#E8C9D9] bg-[#FFF8FB] px-4 py-5 text-center"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#C85B95]">Rate your salon experience</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#6B7280]">Scan this unique QR using the customer account connected to booking #{receipt.booking_id}.</p>{ratingQr ? <img src={ratingQr} alt={`Rating QR code for receipt ${receipt.transaction_id}`} className="mx-auto mt-3 h-28 w-28 rounded-lg border border-[#E8C9D9] bg-white p-1 shadow-sm" /> : <div className="mx-auto mt-3 grid h-28 w-28 place-items-center rounded-lg bg-white text-xs text-[#6B7280]">Preparing QR…</div>}<p className="mt-3 text-[10px] font-semibold text-[#9CA3AF]">Unique rating code · Receipt #{receipt.transaction_id}</p></div><p className="mt-4 border-t border-dashed border-[#E5E7EB] pt-4 text-center text-xs text-[#6B7280]">Thank you for choosing Happy Skin!</p>
      <button type="button" disabled={!ratingQr} onClick={() => window.print()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#166534] px-4 font-bold text-white disabled:cursor-wait disabled:opacity-60 print:hidden"><HiOutlinePrinter className="h-5 w-5" /> {ratingQr ? "Print receipt" : "Preparing rating QR…"}</button>
    </div>
  </section>
  </div>;
}
