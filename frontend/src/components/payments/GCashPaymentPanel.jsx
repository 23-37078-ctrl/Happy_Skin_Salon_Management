import { useEffect, useState } from "react";
import api from "../../services/api";
import { getGCashInstructions, submitGCashProof } from "../../services/customerService";

export default function GCashPaymentPanel({ bookingId, paymentToken, amount, onSubmitted }) {
  const [instructions, setInstructions] = useState(null);
  const [qrUrl, setQrUrl] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    let objectUrl = "";
    getGCashInstructions(bookingId, paymentToken).then(async (data) => {
      if (!live) return;
      setInstructions(data);
      if (data.qr_available) {
        const { data: image } = await api.get(`/customer/payments/${bookingId}/gcash/qr`, { params: paymentToken ? { payment_token: paymentToken } : {}, responseType: "blob" });
        objectUrl = URL.createObjectURL(image);
        if (live) setQrUrl(objectUrl);
      }
    }).catch((err) => live && setError(err.response?.data?.detail || "Payment instructions could not be loaded."));
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bookingId, paymentToken]);

  useEffect(() => {
    if (!proof) { setProofPreviewUrl(""); return undefined; }
    const objectUrl = URL.createObjectURL(proof);
    setProofPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [proof]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!proof || proof.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(proof.type)) {
      setError("Choose a PNG, JPG, or WEBP screenshot up to 5 MB."); return;
    }
    setBusy(true);
    try {
      await submitGCashProof(bookingId, { reference_number: reference, proof }, paymentToken,
        ({ loaded, total }) => setProgress(total ? Math.round(loaded * 100 / total) : 0));
      onSubmitted?.();
    } catch (err) { setError(err.response?.data?.detail || "Payment proof could not be submitted."); }
    finally { setBusy(false); }
  };

  return <section className="mt-4 rounded-2xl border border-[#F0E3EA] bg-white p-4 text-left" aria-label="GCash manual payment">
    <h3 className="text-sm font-extrabold text-[#344054]">Pay with GCash · Manual verification</h3>
    <p className="mt-2 text-sm text-[#475467]">Amount due: <strong>PHP {Number(amount || instructions?.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></p>
    <p className="mt-1 text-xs text-[#667085]">Booking reference: <strong>{instructions?.booking_reference || "Loading…"}</strong></p>
    {qrUrl ? <div className="relative mx-auto my-4 h-72 w-72 max-w-full overflow-hidden rounded-xl border border-[#F0E3EA] bg-white sm:h-80 sm:w-80" aria-label="Large GCash QR for scanning"><img src={qrUrl} alt="Official Happy Skin GCash merchant QR, enlarged for scanning" className="absolute left-1/2 top-1/2 w-[620px] max-w-none -translate-x-1/2 -translate-y-[34%]" /></div> : <div className="my-4 rounded-xl bg-[#FFF8FB] p-4 text-xs leading-5 text-[#667085]">{instructions?.qr_available === false ? "The salon's official GCash QR has not been configured yet. Contact the branch for payment instructions." : "Loading the merchant QR…"}</div>}
    {instructions?.merchant_name && <p className="text-center text-xs text-[#475467]">Salon display name: <strong>{instructions.merchant_name}</strong></p>}
    {instructions?.qr_available && <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-xs font-semibold text-[#344054]">GCash transaction reference<input required minLength={6} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} className="form-input mt-1 w-full" /></label>
      <div className="rounded-xl border border-dashed border-[#D9B8CA] bg-[#FFFAFC] p-3 sm:p-4">
        <label htmlFor={`gcash-proof-${bookingId}`} className="block text-xs font-bold text-[#344054]">Payment screenshot <span className="font-normal text-[#667085]">(PNG, JPG, WEBP; max 5 MB)</span></label>
        <input id={`gcash-proof-${bookingId}`} required type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} className="mt-2 block w-full cursor-pointer rounded-lg border border-[#E8DCE3] bg-white p-2 text-xs text-[#475467] file:mr-3 file:rounded-md file:border-0 file:bg-[#FFF0F7] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#A83F78]" />
        {proofPreviewUrl && <div className="mt-3 overflow-hidden rounded-lg border border-[#F0E3EA] bg-white p-2"><img src={proofPreviewUrl} alt="Preview of your GCash payment screenshot" className="mx-auto max-h-64 max-w-full rounded-md object-contain" /><p className="mt-2 truncate text-center text-[11px] font-semibold text-[#667085]">{proof?.name}</p></div>}
        {!proof && <p className="mt-2 text-[11px] leading-4 text-[#667085]">Your selected payment screenshot will appear here before you submit it for verification.</p>}
      </div>
      {busy && <p role="status" className="text-xs text-[#667085]">Uploading proof… {progress}%</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <button disabled={busy || !instructions?.qr_available} className="min-h-11 w-full rounded-xl bg-[#B94B86] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for verification"}</button>
    </form>}
  </section>;
}
