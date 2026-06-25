import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlinePaperAirplane,
  HiOutlineStar,
} from "react-icons/hi2";
import { useSearchParams } from "react-router-dom";
import {
  getCustomerAppointments,
  submitFeedback,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerBookAppointment";

export default function CustomerFeedback() {
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState({
    booking_id: searchParams.get("booking") || "",
    rating: 5,
    review: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadAppointments() {
      setIsLoading(true);
      setError("");
      try {
        const payload = await getCustomerAppointments(controller.signal);
        const completed = (payload || []).filter((item) => item.status === "completed");
        setAppointments(completed);
        setForm((prev) => ({ ...prev, booking_id: prev.booking_id || completed[0]?.id || "" }));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.booking_id) {
      setError("Select a completed appointment first.");
      return;
    }

    setIsSaving(true);
    try {
      await submitFeedback({
        booking_id: Number(form.booking_id),
        rating: Number(form.rating),
        review: form.review.trim() || null,
      });
      setSuccess("Thank you. Your feedback was submitted for management review.");
      setForm((prev) => ({ ...prev, review: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't submit your feedback.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomerShell title="Submit Feedback" subtitle="Rate completed services and help management monitor satisfaction.">
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
              <p className="text-sm text-[#6B7280]">Feedback is available after staff completes a booking.</p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-bold text-[#1F2937]">
            Completed Appointment
            <select
              value={form.booking_id}
              onChange={(event) => setForm((prev) => ({ ...prev, booking_id: event.target.value }))}
              disabled={isLoading || appointments.length === 0}
              className="form-input mt-2"
            >
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  #{appointment.id} - {appointment.service?.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Rating
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, rating }))}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${rating <= form.rating ? "border-[#D65A9A] bg-[#FFF0F7] text-[#D65A9A]" : "border-[#F3E8EF] bg-white text-[#9CA3AF]"}`}
                  aria-label={`${rating} star rating`}
                >
                  <HiOutlineStar className="h-6 w-6" />
                </button>
              ))}
            </div>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Review
            <textarea
              value={form.review}
              onChange={(event) => setForm((prev) => ({ ...prev, review: event.target.value }))}
              rows={7}
              placeholder="Share notes about service quality, staff, or branch experience."
              className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
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
            <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
              <h2 className="text-xl font-bold text-[#1F2937]">{selectedAppointment.service?.name}</h2>
              <p>{selectedAppointment.branch?.name}</p>
              <p>{new Date(selectedAppointment.appointment_date).toLocaleString()}</p>
              {selectedAppointment.notes && <p className="rounded-xl bg-[#FFF8FB] p-3">{selectedAppointment.notes}</p>}
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
    </CustomerShell>
  );
}
