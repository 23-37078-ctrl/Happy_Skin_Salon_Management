export default function PaymentMethodPicker({ selected, onSelect }) {
  return <div role="group" aria-label="Payment method" className="grid grid-cols-2 gap-2">
    <button type="button" onClick={() => onSelect("gcash")} aria-pressed={selected === "gcash"} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${selected === "gcash" ? "border-[#B94B86] bg-[#FFF0F7] text-[#A83F78]" : "border-[#E4D4DE] text-[#667085]"}`}>GCash</button>
    <button type="button" onClick={() => onSelect("paypal")} aria-pressed={selected === "paypal"} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${selected === "paypal" ? "border-[#B94B86] bg-[#FFF0F7] text-[#A83F78]" : "border-[#E4D4DE] text-[#667085]"}`}>PayPal</button>
  </div>;
}
