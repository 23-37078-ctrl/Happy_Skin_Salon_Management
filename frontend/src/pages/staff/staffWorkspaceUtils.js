export const statusStyles = {
  pending: "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/25",
  confirmed: "bg-[#DBEAFE] text-[#1D4ED8] border-[#60A5FA]/25",
  completed: "bg-[#DCFCE7] text-[#166534] border-[#22C55E]/25",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]/25",
};

export const paymentLabels = {
  cash: "Cash",
  gcash: "GCash",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getFirstName(value) {
  if (!value) return "";
  const cleanValue = String(value).trim();
  if (!cleanValue) return "";
  if (cleanValue.includes("@")) return cleanValue.split("@")[0];
  return cleanValue.split(/\s+/)[0];
}

export function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" ");
  return detail || error?.message || fallback;
}
