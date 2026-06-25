import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineMapPin,
  HiOutlineSparkles,
} from "react-icons/hi2";
import {
  createAppointment,
  getCustomerBranches,
  getCustomerServices,
} from "../../services/customerService";

export default function CustomerBookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    branch_id: searchParams.get("branch") || "",
    service_id: searchParams.get("service") || "",
    appointment_date: "",
    appointment_time: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      setIsLoading(true);
      setError("");
      try {
        const [branchData, serviceData] = await Promise.all([
          getCustomerBranches(controller.signal),
          getCustomerServices(controller.signal),
        ]);
        setBranches(branchData || []);
        setServices(serviceData || []);
        setForm((prev) => ({
          ...prev,
          branch_id: prev.branch_id || branchData?.[0]?.id || "",
          service_id: prev.service_id || serviceData?.[0]?.id || "",
        }));
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setError("We couldn't load booking options. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
    return () => controller.abort();
  }, []);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(form.service_id)),
    [form.service_id, services]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.branch_id || !form.service_id || !form.appointment_date || !form.appointment_time) {
      setError("Please complete the branch, service, date, and time fields.");
      return;
    }

    setIsSaving(true);
    try {
      await createAppointment({
        branch_id: Number(form.branch_id),
        service_id: Number(form.service_id),
        appointment_date: `${form.appointment_date}T${form.appointment_time}:00`,
        notes: form.notes.trim() || null,
      });
      setSuccess("Your appointment request was sent. Staff will confirm it soon.");
      setTimeout(() => navigate("/customer/history"), 900);
    } catch (err) {
      setError(err.response?.data?.detail || "We couldn't create that appointment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomerShell title="Book Appointment" subtitle="Select a service, branch, and schedule.">
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch" icon={HiOutlineMapPin}>
              <select
                value={form.branch_id}
                onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
                disabled={isLoading}
                className="form-input"
              >
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>

            <Field label="Service" icon={HiOutlineSparkles}>
              <select
                value={form.service_id}
                onChange={(event) => setForm((prev) => ({ ...prev, service_id: event.target.value }))}
                disabled={isLoading}
                className="form-input"
              >
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </Field>

            <Field label="Date" icon={HiOutlineCalendarDays}>
              <input
                type="date"
                value={form.appointment_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setForm((prev) => ({ ...prev, appointment_date: event.target.value }))}
                className="form-input"
              />
            </Field>

            <Field label="Time" icon={HiOutlineCalendarDays}>
              <input
                type="time"
                value={form.appointment_time}
                onChange={(event) => setForm((prev) => ({ ...prev, appointment_time: event.target.value }))}
                className="form-input"
              />
            </Field>
          </div>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={4}
              placeholder="Optional requests or reminders for staff"
              className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86] disabled:opacity-60"
          >
            <HiOutlineCheckCircle className="h-5 w-5" />
            {isSaving ? "Sending..." : "Send Appointment Request"}
          </button>
        </form>

        <aside className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Selected service</p>
          {selectedService ? (
            <div className="mt-4">
              <img src={selectedService.image} alt="" className="h-44 w-full rounded-xl object-cover" />
              <h2 className="mt-4 text-xl font-bold text-[#1F2937]">{selectedService.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{selectedService.description || selectedService.reason}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-[#FFF8FB] p-3">
                  <dt className="font-semibold text-[#6B7280]">Duration</dt>
                  <dd className="mt-1 font-bold text-[#1F2937]">{selectedService.duration_minutes || 0} min</dd>
                </div>
                <div className="rounded-xl bg-[#FFF8FB] p-3">
                  <dt className="font-semibold text-[#6B7280]">Price</dt>
                  <dd className="mt-1 font-bold text-[#1F2937]">PHP {Number(selectedService.price || 0).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6B7280]">No services are available yet.</p>
          )}
        </aside>
      </div>
    </CustomerShell>
  );
}

export function CustomerShell({ title, subtitle, children }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#FFF8FB]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white px-4 py-4 shadow-[0_12px_34px_rgba(31,41,55,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Customer portal</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1F2937]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate("/customer/dashboard")} className="nav-button">Dashboard</button>
            <button type="button" onClick={() => navigate("/customer/history")} className="nav-button">History</button>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block text-sm font-bold text-[#1F2937]">
      <span className="inline-flex items-center gap-2"><Icon className="h-5 w-5 text-[#D65A9A]" /> {label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function Notice({ tone = "error", children }) {
  const style = tone === "success"
    ? "border-[#22C55E]/20 text-[#166534]"
    : "border-[#EF4444]/20 text-[#B91C1C]";
  return <div className={`mb-5 rounded-[1.25rem] border bg-white px-4 py-3 text-sm font-semibold shadow-sm ${style}`}>{children}</div>;
}
