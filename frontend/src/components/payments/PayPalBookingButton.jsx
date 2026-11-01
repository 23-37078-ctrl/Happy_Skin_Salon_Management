import { useState } from "react";
import { PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import {
  captureCustomerPayPalOrder,
  captureGuestPayPalOrder,
  createCustomerPayPalOrder,
  createGuestPayPalOrder,
} from "../../services/customerService";

export default function PayPalBookingButton({ bookingId, paymentToken, amount, onPaid }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guest = Boolean(paymentToken);

  return <div>
    {error && <p role="alert" className="mb-2 text-xs font-semibold text-[#B42318]">{error}</p>}
    <PayPalOneTimePaymentButton
      disabled={busy || !bookingId}
      createOrder={async () => {
        setError("");
        const result = guest
          ? await createGuestPayPalOrder(bookingId, paymentToken)
          : await createCustomerPayPalOrder(bookingId);
        return { orderId: result.order_id };
      }}
      onApprove={async ({ orderId }) => {
        setBusy(true);
        setError("");
        try {
          const result = guest
            ? await captureGuestPayPalOrder(orderId, paymentToken)
            : await captureCustomerPayPalOrder(orderId);
          if (result.status === "paid") onPaid?.(result);
        } catch (captureError) {
          setError(captureError.response?.data?.detail || "We couldn't verify this payment. Check your booking status before trying again.");
        } finally {
          setBusy(false);
        }
      }}
      onError={() => setError("PayPal could not complete this payment. Please retry or contact the branch.")}
      onCancel={() => setError("Payment was cancelled. Your booking remains pending until full payment is completed.")}
    />
    <p className="mt-2 text-center text-xs text-[#667085]">Full payment: PHP {Number(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
  </div>;
}
