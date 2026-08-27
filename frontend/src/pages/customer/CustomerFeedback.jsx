import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlinePaperAirplane,
  HiOutlineStar,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getCustomerAppointments,
  submitFeedback,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerShell";

export default function CustomerFeedback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState({
    booking_id: searchParams.get("booking") || "",
    rating: 5,
    service_provider_id: "",
    staff_rating: 5,
    staff_review: "",
    branch_rating: 5,
    branch_review: "",
    review: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAppointments() {
      setIsLoading(true);
      setError("");
      try {
        const payload = await getCustomerAppointments(controller.signal);
        const completed = (payload || []).filter((item) => item.status === "completed");
        setAppointments(completed);
        setForm((prev) => {
          const bookingId = prev.booking_id || completed[0]?.id || "";
          const appointment = completed.find((item) => String(item.id) === String(bookingId));
          return { ...prev, booking_id: bookingId, service_provider_id: appointment?.service_provider?.id || "" };
        });
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setError("We couldn't load completed appointments.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadAppointments();
    return () => controller.abort();
  }, []);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => String(item.id) === String(form.booking_id)),
    [appointments, form.booking_id]
  );
  const ratingLabels = ["Poor", "Fair", "Good", "Very good", "Excellent"];
  const selectedProvider = selectedAppointment?.available_providers?.find((staff) => String(staff.id) === String(form.service_provider_id));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.booking_id) {
      setError("Select a completed appointment first.");
      return;
    }
    if (form.review.trim().length < 10) {
      setError("Please share at least 10 characters about the service.");
      return;
    }
    if (form.staff_review.trim().length < 10) {
      setError("Please share at least 10 characters about the staff service.");
      return;
    }
    if (form.branch_review.trim().length < 10) {
      setError("Please share at least 10 characters about the branch experience.");
      return;
    }
    if (!form.service_provider_id) {
      setError("Please select the staff member who performed your service.");
      return;
    }

    setIsSaving(true);
    try {
      await submitFeedback({
        booking_id: Number(form.booking_id),
        rating: Number(form.rating),
        review: form.review.trim() || null,
        service_provider_id: Number(form.service_provider_id),
        staff_rating: Number(form.staff_rating),
        staff_review: form.staff_review.trim(),
        branch_rating: Number(form.branch_rating),
        branch_review: form.branch_review.trim(),
      });
      setSuccess("Thank you. Your feedback was submitted for management review.");
      setShowSuccessModal(true);
      setForm((prev) => ({ ...prev, review: "", staff_review: "", branch_review: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't submit your feedback.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomerShell title="Submit Feedback" showHeading={false} backTo="/customer/dashboard" backBesideLogo>
      {error && <Notice>{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#D65A9A]">
              <HiOutlineChatBubbleLeftRight className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#1F2937]">Service review</h2>
              <p className="text-sm text-[#6B7280]">Tell us about a completed salon visit.</p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-bold text-[#1F2937]">
            Completed Appointment
            <select
              value={form.booking_id}
              onChange={(event) => {
                const appointment = appointments.find((item) => String(item.id) === String(event.target.value));
                setForm((prev) => ({ ...prev, booking_id: event.target.value, service_provider_id: appointment?.service_provider?.id || "", staff_rating: 5 }));
              }}
              disabled={isLoading || appointments.length === 0}
              className="form-input mt-2"
            >
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.service?.name} — {appointment.branch?.name} — {new Date(appointment.appointment_date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Staff member who served you
            {selectedAppointment?.service_provider ? (
              <div className="form-input mt-2 flex min-h-12 items-center bg-[#FFF8FB]">
                {selectedAppointment.service_provider.full_name} — {selectedAppointment.service_provider.job_title}
              </div>
            ) : (
              <select required value={form.service_provider_id} onChange={(event) => setForm((prev) => ({ ...prev, service_provider_id: event.target.value }))} disabled={!selectedAppointment} className="form-input mt-2">
                <option value="">Select staff member</option>
                {(selectedAppointment?.available_providers || []).map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} — {staff.job_title}</option>)}
              </select>
            )}
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Service Rating
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, rating }))}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 ${rating <= form.rating ? "border-[#D65A9A] bg-[#FFF0F7] text-[#D65A9A] shadow-sm" : "border-[#F3E8EF] bg-white text-[#9CA3AF]"}`}
                  aria-label={`${rating} star rating`}
                >
                  <HiOutlineStar className="h-6 w-6" />
                </button>
              ))}
            </div>
            <span className="mt-2 block text-xs font-semibold text-[#C85B95]">{form.rating}/5 · {ratingLabels[form.rating - 1]}</span>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Staff Rating {selectedProvider && <span className="font-normal text-[#6B7280]">— {selectedProvider.full_name}</span>}
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" onClick={() => setForm((prev) => ({ ...prev, staff_rating: rating }))} className={`flex h-11 w-11 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 ${rating <= form.staff_rating ? "border-[#D65A9A] bg-[#FFF0F7] text-[#D65A9A] shadow-sm" : "border-[#F3E8EF] bg-white text-[#9CA3AF]"}`} aria-label={`${rating} star staff rating`}><HiOutlineStar className="h-6 w-6" /></button>
              ))}
            </div>
            <span className="mt-2 block text-xs font-semibold text-[#C85B95]">{form.staff_rating}/5 · {ratingLabels[form.staff_rating - 1]}</span>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Service Review
            <textarea
              value={form.review}
              onChange={(event) => setForm((prev) => ({ ...prev, review: event.target.value }))}
              rows={6}
              minLength={10}
              maxLength={500}
              required
              placeholder="How was the treatment or service you received?"
              className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
            <span className="mt-1 block text-right text-[11px] font-medium text-[#98A2B3]">{form.review.length}/500</span>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Staff Review {selectedProvider && <span className="font-normal text-[#6B7280]">— {selectedProvider.full_name}</span>}
            <textarea value={form.staff_review} onChange={(event) => setForm((prev) => ({ ...prev, staff_review: event.target.value }))} rows={4} minLength={10} maxLength={500} required placeholder="How was the staff member's assistance, professionalism, and care?" className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
            <span className="mt-1 block text-right text-[11px] font-medium text-[#98A2B3]">{form.staff_review.length}/500</span>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Branch Rating <span className="font-normal text-[#6B7280]">— {selectedAppointment?.branch?.name || "Selected branch"}</span>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => setForm((prev) => ({ ...prev, branch_rating: rating }))} className={`flex h-11 w-11 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 ${rating <= form.branch_rating ? "border-[#D65A9A] bg-[#FFF0F7] text-[#D65A9A] shadow-sm" : "border-[#F3E8EF] bg-white text-[#9CA3AF]"}`} aria-label={`${rating} star branch rating`}><HiOutlineStar className="h-6 w-6" /></button>)}
            </div>
            <span className="mt-2 block text-xs font-semibold text-[#C85B95]">{form.branch_rating}/5 · {ratingLabels[form.branch_rating - 1]}</span>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Branch Review
            <textarea value={form.branch_review} onChange={(event) => setForm((prev) => ({ ...prev, branch_review: event.target.value }))} rows={4} minLength={10} maxLength={500} required placeholder="How was the branch cleanliness, comfort, and overall atmosphere?" className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20" />
            <span className="mt-1 block text-right text-[11px] font-medium text-[#98A2B3]">{form.branch_review.length}/500</span>
          </label>

          <button
            type="submit"
            disabled={isSaving || isLoading || appointments.length === 0}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86] disabled:opacity-60"
          >
            <HiOutlinePaperAirplane className="h-5 w-5" />
            {isSaving ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>

        <aside className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Selected appointment</p>
          {selectedAppointment ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB]">
              {selectedAppointment.service?.image && <img src={selectedAppointment.service.image} alt={selectedAppointment.service?.name} className="h-52 w-full object-cover" />}
              <div className="p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#166534]"><HiOutlineCheckCircle className="h-4 w-4" /> Completed visit</span>
                <h2 className="mt-4 text-xl font-bold text-[#1F2937]">{selectedAppointment.service?.name}</h2>
                <div className="mt-4 grid gap-3 text-sm text-[#667085] sm:grid-cols-2">
                  <p className="flex items-start gap-2"><HiOutlineMapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#D65A9A]" /> {selectedAppointment.branch?.name}</p>
                  <p className="flex items-center gap-2"><HiOutlineCalendarDays className="h-5 w-5 shrink-0 text-[#D65A9A]" /> {new Date(selectedAppointment.appointment_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                  <p className="flex items-center gap-2"><HiOutlineClock className="h-5 w-5 shrink-0 text-[#D65A9A]" /> {new Date(selectedAppointment.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {selectedAppointment.notes && <div className="mt-4 rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#C85B95]">Visit notes</p><p className="mt-1 text-sm text-[#667085]">{selectedAppointment.notes}</p></div>}
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <HiOutlineStar className="mx-auto h-10 w-10 text-[#D65A9A]" />
              <h2 className="mt-3 text-lg font-bold text-[#1F2937]">No completed bookings</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Completed appointments will become available for review here.</p>
            </div>
          )}
        </aside>
      </section>

      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1F2937]/45 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="feedback-success-title">
          <div className="w-full max-w-sm rounded-[1.75rem] border border-[#F3E8EF] bg-white p-6 text-center shadow-[0_24px_70px_rgba(31,41,55,0.22)]">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
              <HiOutlineCheckCircle className="h-9 w-9" />
            </span>
            <h2 id="feedback-success-title" className="mt-4 text-xl font-extrabold text-[#1F2937]">Review submitted!</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">Thank you for sharing your experience. Your ratings and review were successfully sent to Happy Skin.</p>
            <button type="button" onClick={() => navigate("/customer/dashboard")} className="mt-6 min-h-12 w-full rounded-xl bg-[#C85B95] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86]">Back to Dashboard</button>
            <button type="button" onClick={() => setShowSuccessModal(false)} className="mt-2 min-h-10 w-full rounded-xl px-4 py-2 text-sm font-bold text-[#667085] transition hover:bg-[#FFF0F7]">Stay on this page</button>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}
