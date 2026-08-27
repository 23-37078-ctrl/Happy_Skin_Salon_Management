import { formatCurrency, formatDateTime, paymentLabels } from "./staffWorkspaceUtils";
import QRCode from "qrcode";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

export function getTransactionSale(transaction) {
  return Math.max(0, Number(transaction.amount || 0) - Number(transaction.commission_amount || 0));
}

export async function printTransactionReceipt(transaction) {
  const receiptWindow = window.open("", "_blank", "width=520,height=760");
  if (!receiptWindow) return;
  const booking = transaction.booking || {};
  const commission = Number(transaction.commission_amount || 0);
  const sale = getTransactionSale(transaction);
  const logo = `${window.location.origin}/images/happy-skin-logo.svg`;
  const branch = booking.branch?.name || "Happy Skin Branch";
  const customer = booking.customer?.full_name || "Walk-in customer";
  const service = booking.service?.name || "Salon service";
  const provider = transaction.service_provider?.full_name || "Salon staff";
  const addOns = Number(transaction.additional_charge || 0);
  const ratingUrl = `${window.location.origin}/feedback?booking=${encodeURIComponent(booking.id)}&receipt=${encodeURIComponent(transaction.id)}`;
  const ratingQr = await QRCode.toDataURL(ratingUrl, { width: 220, margin: 1, errorCorrectionLevel: "M", color: { dark: "#713B5A", light: "#FFFFFF" } });

  receiptWindow.document.write(`<!doctype html><html><head><title>Receipt #${escapeHtml(transaction.id)}</title><style>
    body{font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:28px}.receipt{max-width:430px;margin:auto;border:1px solid #eadbe3;border-radius:18px;overflow:hidden}.head{text-align:center;background:#fff0f7;padding:24px}.head img{width:76px;height:76px}.head h1{font-size:20px;margin:8px 0 4px;color:#713b5a}.head p{margin:3px;color:#6b7280;font-size:12px}.body{padding:22px}.row{display:flex;justify-content:space-between;gap:20px;margin:10px 0}.muted{color:#6b7280}.divider{border-top:1px dashed #d1d5db;margin:16px 0}.strong{font-weight:800}.pink{color:#c85b95}.green{color:#166534}.total{font-size:18px}.rating{text-align:center;margin-top:20px;border-top:1px dashed #d1d5db;padding-top:16px}.rating img{width:128px;height:128px}.rating p{font-size:12px;color:#6b7280;margin:5px}.rating .title{font-weight:800;color:#c85b95;text-transform:uppercase}.thanks{text-align:center;color:#6b7280;font-size:12px;margin-top:18px}@media print{body{padding:0}.receipt{border:0}}
  </style></head><body><main class="receipt"><header class="head"><img src="${escapeHtml(logo)}" alt="Happy Skin logo"><h1>Happy Skin Nails Spa &amp; Aesthetics</h1><p>${escapeHtml(branch)}</p><p class="strong">OFFICIAL PAYMENT RECEIPT</p></header><section class="body">
    <div class="row"><span class="muted">Receipt no.</span><strong>#${escapeHtml(transaction.id)}</strong></div><div class="row"><span class="muted">Booking no.</span><strong>#${escapeHtml(booking.id)}</strong></div><div class="row"><span class="muted">Date and time</span><strong>${escapeHtml(formatDateTime(transaction.created_at))}</strong></div><div class="divider"></div>
    <div class="row"><span class="muted">Customer</span><strong>${escapeHtml(customer)}</strong></div>${booking.customer?.phone_number ? `<div class="row"><span class="muted">Contact number</span><strong>${escapeHtml(booking.customer.phone_number)}</strong></div>` : ""}<div class="row"><span class="muted">Service</span><strong>${escapeHtml(service)}</strong></div><div class="row"><span class="muted">Provider</span><strong>${escapeHtml(provider)}</strong></div><div class="row"><span class="muted">Payment method</span><strong>${escapeHtml(paymentLabels[transaction.payment_method] || transaction.payment_method)}</strong></div><div class="divider"></div>
    <div class="row"><span>Salon sale</span><strong>${escapeHtml(formatCurrency(sale))}</strong></div>${addOns > 0 ? `<div class="row"><span class="muted">Included add-ons</span><strong>${escapeHtml(formatCurrency(addOns))}</strong></div>` : ""}${transaction.charge_reason ? `<p class="muted">${escapeHtml(transaction.charge_reason)}</p>` : ""}<div class="row pink"><span>Staff commission / tip</span><strong>${escapeHtml(formatCurrency(commission))}</strong></div><div class="divider"></div><div class="row strong green total"><span>Total paid</span><span>${escapeHtml(formatCurrency(transaction.amount))}</span></div><div class="rating"><p class="title">Rate your salon experience</p><p>Scan this unique QR for booking #${escapeHtml(booking.id)}.</p><img src="${escapeHtml(ratingQr)}" alt="Unique rating QR code"><p>Receipt #${escapeHtml(transaction.id)}</p></div><p class="thanks">Thank you for choosing Happy Skin!</p>
  </section></main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();};<\/script></body></html>`);
  receiptWindow.document.close();
}
