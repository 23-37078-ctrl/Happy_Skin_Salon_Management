import { formatCurrency, formatDateTime, paymentLabels } from "./staffWorkspaceUtils";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

export function getTransactionSale(transaction) {
  return Math.max(0, Number(transaction.amount || 0) - Number(transaction.commission_amount || 0));
}

export function printTransactionReceipt(transaction) {
  const receiptWindow = window.open("", "_blank", "width=520,height=760");
  if (!receiptWindow) return;

  const booking = transaction.booking || {};
  const branch = booking.branch?.name || "Happy Skin Nails Spa & Aesthetics";
  const customer = booking.customer?.full_name || booking.guest_name || "Walk-in customer";
  const phone = booking.customer?.phone_number || booking.guest_phone || "";
  const service = booking.service?.name || "Salon service";
  const addOns = Number(transaction.additional_charge || 0);
  const subtotal = getTransactionSale(transaction);
  const total = Number(transaction.amount || 0);
  const receiptNumber = `HS-${String(transaction.id).padStart(8, "0")}`;
  const businessTin = import.meta.env.VITE_BUSINESS_TIN || "Not configured";
  const businessAddress = import.meta.env.VITE_BUSINESS_ADDRESS || "";
  const businessPhone = import.meta.env.VITE_BUSINESS_PHONE || "";
  const serviceRows = `<tr><td>${escapeHtml(service)}</td><td class="qty">1</td><td class="amount">${escapeHtml(formatCurrency(Math.max(0, subtotal - addOns)))}</td></tr>${addOns > 0 ? `<tr><td>Additional services / charges${transaction.charge_reason ? `<small>${escapeHtml(transaction.charge_reason)}</small>` : ""}</td><td class="qty">1</td><td class="amount">${escapeHtml(formatCurrency(addOns))}</td></tr>` : ""}`;

  receiptWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(receiptNumber)}</title><style>
    *{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#111;margin:0;padding:22px}.receipt{max-width:420px;margin:auto;border:1px solid #222;padding:20px}.center{text-align:center}.business{font-size:18px;font-weight:700;margin:0 0 5px}.business-detail{font-size:11px;margin:3px 0}.title{font-size:15px;font-weight:700;letter-spacing:.08em;margin:14px 0 4px}.muted{color:#555;font-size:11px}.rule{border:0;border-top:1px dashed #555;margin:13px 0}.meta{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:12px}.meta strong{text-align:right}.label{color:#444}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th{text-align:left;border-bottom:1px solid #222;padding:5px 2px}td{padding:7px 2px;vertical-align:top}.qty{width:35px;text-align:center}.amount{text-align:right;white-space:nowrap}small{display:block;color:#555;margin-top:3px}.totals{margin-left:auto;width:65%;font-size:12px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.grand{font-weight:700;font-size:15px;border-top:1px solid #222;margin-top:4px;padding-top:8px!important}.thanks{text-align:center;margin:16px 0 0;font-size:12px}@media print{body{padding:0}.receipt{border:0;max-width:none;padding:8mm}@page{margin:8mm}}
  </style></head><body><main class="receipt"><header class="center"><h1 class="business">${escapeHtml(branch)}</h1>${businessAddress ? `<p class="business-detail">${escapeHtml(businessAddress)}</p>` : ""}${businessPhone ? `<p class="business-detail">Tel: ${escapeHtml(businessPhone)}</p>` : ""}<p class="business-detail">TIN: ${escapeHtml(businessTin)}</p><p class="title">SALES RECEIPT</p><p class="muted">Receipt No. ${escapeHtml(receiptNumber)}</p></header><hr class="rule"><section class="meta"><span class="label">Date / time</span><strong>${escapeHtml(formatDateTime(transaction.created_at))}</strong><span class="label">Customer</span><strong>${escapeHtml(customer)}</strong>${phone ? `<span class="label">Contact</span><strong>${escapeHtml(phone)}</strong>` : ""}<span class="label">Booking no.</span><strong>${escapeHtml(booking.id ? `#${booking.id}` : "Walk-in")}</strong><span class="label">Payment method</span><strong>${escapeHtml(paymentLabels[transaction.payment_method] || transaction.payment_method || "—")}</strong></section><table><thead><tr><th>Item / service</th><th class="qty">Qty</th><th class="amount">Amount</th></tr></thead><tbody>${serviceRows}</tbody></table><hr class="rule"><section class="totals"><div><span>Subtotal</span><strong>${escapeHtml(formatCurrency(total))}</strong></div><div class="grand"><span>TOTAL PAID</span><span>${escapeHtml(formatCurrency(total))}</span></div></section><hr class="rule"><p class="thanks">Thank you for your visit!</p></main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();};</script></body></html>`);
  receiptWindow.document.close();
}
