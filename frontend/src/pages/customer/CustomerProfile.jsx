import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineCheckCircle, HiOutlineEnvelope, HiOutlinePhone, HiOutlineUser, HiOutlineCamera } from "react-icons/hi2";
import { CustomerShell } from "./CustomerShell";
import { useAuth } from "../../hooks/useAuth";
import { getCustomerProfile, getCustomerProfileChangeRequests, requestCustomerEmailChange, sendCustomerProfilePhoneOtp, uploadCustomerProfilePhoto, verifyCustomerProfilePhoneOtp } from "../../services/customerService";

const fieldLabels = { phone_number: "Phone number", email: "Email" };

export default function CustomerProfile() {
  const { syncCurrentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef(null);

  const refreshRequests = useCallback(async () => setRequests((await getCustomerProfileChangeRequests()).requests || []), []);
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [person, requestData] = await Promise.all([getCustomerProfile(), getCustomerProfileChangeRequests()]);
      setProfile(person);
      setRequests(requestData?.requests || []);
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't load your profile. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  const startEdit = (field) => { setEditing(field); setError(""); setMessage(""); setPhoneNumber(""); setEmail(""); setVerificationId(""); setCode(""); };
  const cancelEdit = () => { setEditing(""); setVerificationId(""); setCode(""); setError(""); };
  const sendCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await sendCustomerProfilePhoneOtp({ full_name: profile.full_name, phone_number: normalizePhilippinePhone(phoneNumber) });
      setVerificationId(result.verification_id); setMessage(`Code sent by SMS. It expires in ${result.expires_in_minutes} minutes.`);
    } catch (err) { setError(err.response?.data?.detail || "We couldn't send the SMS code."); }
    finally { setBusy(false); }
  };
  const verifyCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await verifyCustomerProfilePhoneOtp({ verification_id: verificationId, code });
      setEditing(""); setVerificationId(""); setCode(""); await refreshRequests();
      setMessage("Your number is verified. The owner will review your change request before it appears on your account.");
    } catch (err) { setError(err.response?.data?.detail || "We couldn't verify that code."); }
    finally { setBusy(false); }
  };
  const submitEmail = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await requestCustomerEmailChange({ requested_value: email.trim() });
      setEditing(""); setEmail(""); await refreshRequests();
      setMessage("Your email change request was sent to the owner for review.");
    } catch (err) { setError(err.response?.data?.detail || "We couldn't submit your email change request."); }
    finally { setBusy(false); }
  };
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG, or WebP photo."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("Profile photos must be 3 MB or smaller."); return; }
    setPhotoBusy(true);
    try {
      const result = await uploadCustomerProfilePhoto(file);
      setProfile((current) => ({ ...current, profile_image_url: result.profile_image_url }));
      await syncCurrentUser({ ...profile, profile_image_url: result.profile_image_url });
      setMessage("Your profile photo has been updated.");
    } catch (err) { setError(err.response?.data?.detail || "We couldn't upload your profile photo."); }
    finally { setPhotoBusy(false); }
  };
  const phonePending = requests.some((request) => request.field === "phone_number" && request.status === "pending");
  const emailPending = requests.some((request) => request.field === "email" && request.status === "pending");

  return <CustomerShell user={profile} backTo="/customer/dashboard" backBesideLogo showHeading={false}>
    <section className="mx-auto max-w-4xl rounded-[1.5rem] border border-[#F0E3EA] bg-white p-5 shadow-[0_14px_40px_rgba(74,43,58,0.06)] sm:p-8">
      <div className="mb-6 flex items-center gap-4 border-b border-[#F3E8EF] pb-5"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-12 w-12 rounded-full border border-[#F3E8EF] object-cover" /><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B94B86]">Customer profile</p></div>
      {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3"><p className="text-sm font-medium text-red-700">{error}</p><button type="button" onClick={loadProfileData} disabled={loading} className="min-h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 disabled:opacity-50">{loading ? "Retrying…" : "Retry"}</button></div>}
      {message && <p role="status" className="mt-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>}
      {loading ? <p className="py-8 text-sm text-[#667085]">Loading your profile...</p> : profile && <>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#F0D7E4] bg-[#FFF0F7] text-2xl font-extrabold text-[#B94B86]">
              {profile.profile_image_url ? <img src={profilePhotoUrl(profile.profile_image_url)} alt="Your profile" className="h-full w-full object-cover" /> : (profile.full_name || "C").trim().charAt(0).toUpperCase()}
            </div>
            <div><p className="text-sm font-extrabold text-[#202534]">Profile photo</p><p className="mt-1 text-xs text-[#667085]">JPG, PNG, or WebP up to 3 MB.</p><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" /><button type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#E8B7D0] bg-white px-3 text-sm font-bold text-[#A83F78] hover:bg-[#FFF0F7] disabled:opacity-60"><HiOutlineCamera className="h-4 w-4" />{photoBusy ? "Uploading…" : profile.profile_image_url ? "Change photo" : "Add profile photo"}</button></div>
          </div>
          <div className="min-w-0 flex-1"><InfoField icon={HiOutlineUser} label="Full name" value={profile.full_name} /></div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ContactCard icon={HiOutlineEnvelope} title="Email address" value={profile.email} verified={profile.email_verified} pending={emailPending} onEdit={() => startEdit("email")}>
            {editing === "email" && <form onSubmit={submitEmail} className="mt-4 space-y-3"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="New email address" className="form-input w-full" /><ActionButtons busy={busy} submitText="Send approval request" onCancel={cancelEdit} /></form>}
          </ContactCard>
          <ContactCard icon={HiOutlinePhone} title="Mobile number" value={formatPhilippinePhone(profile.phone_number) || "Not provided"} verified={profile.phone_verified} pending={phonePending} onEdit={() => startEdit("phone_number")}>
            {editing === "phone_number" && <div className="mt-4 space-y-3">{!verificationId ? <form onSubmit={sendCode} className="space-y-3"><input required type="tel" inputMode="tel" autoComplete="tel" minLength={7} maxLength={20} pattern="[+0-9 ()-]{7,20}" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="New mobile number" className="form-input w-full" /><ActionButtons busy={busy} submitText="Send verification code" onCancel={cancelEdit} /></form> : <form onSubmit={verifyCode} className="space-y-3"><label className="block text-sm font-semibold text-[#374151]">6-digit SMS code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="form-input mt-2 w-full" /></label><ActionButtons busy={busy} submitText="Verify and request change" onCancel={cancelEdit} /></form>}</div>}
          </ContactCard>
        </div>
      </>}
    </section>
  </CustomerShell>;
}

function InfoField({ icon: Icon, label, value }) { return <div className="rounded-xl border border-[#F3E8EF] p-4"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#98A2B3]"><Icon className="h-4 w-4 text-[#B94B86]" />{label}</p><p className="mt-2 break-all font-semibold text-[#374151]">{value || "Not provided"}</p></div>; }
function formatPhilippinePhone(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  return String(value);
}
function normalizePhilippinePhone(value) {
  const trimmed = String(value || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("+63") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return trimmed;
}
function profilePhotoUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
  if (/^https?:\/\//i.test(base)) return new URL(path, base).toString();
  return path;
}
function ContactCard({ icon: Icon, title, value, verified, pending, onEdit, children }) { return <div className="rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] p-4"><div className="flex items-start justify-between gap-2"><div><p className="inline-flex items-center gap-2 text-sm font-extrabold text-[#202534]">{Icon && <Icon aria-hidden="true" className="h-4 w-4 text-[#B94B86]" />}{title}</p><p className="mt-2 break-all text-sm text-[#4B5563]">{value}</p></div>{verified && <HiOutlineCheckCircle className="h-5 w-5 shrink-0 text-green-600" />}</div>{pending ? <p className="mt-3 text-xs font-semibold text-amber-700">A change request is awaiting owner approval.</p> : (!children || !children.props?.children) ? <button type="button" onClick={onEdit} className="mt-3 min-h-9 rounded-lg border border-[#E8B7D0] bg-white px-3 text-sm font-bold text-[#A83F78] hover:bg-[#FFF0F7]">Change</button> : null}{children}</div>; }
function ActionButtons({ busy, submitText, onCancel }) { return <div className="flex flex-wrap gap-2"><button disabled={busy} className="min-h-10 rounded-lg bg-[#B94B86] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "Please wait…" : submitText}</button><button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-[#E8B7D0] px-4 text-sm font-bold text-[#A83F78]">Cancel</button></div>; }
