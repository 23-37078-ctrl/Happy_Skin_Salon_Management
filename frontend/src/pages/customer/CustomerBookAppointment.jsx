import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineArrowRightOnRectangle,
  HiChevronDown,
  HiOutlineArrowLeft,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
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
        setForm((prev) => {
          const requestedService = String(prev.service_id || "");
          const requestedBranch = String(prev.branch_id || "");
          const serviceBranch = requestedService
            ? branchData?.find((branch) =>
                branch.services?.some((service) => String(service.id) === requestedService)
              )
            : null;
          const branch =
            branchData?.find((item) => String(item.id) === requestedBranch) ||
            serviceBranch ||
            branchData?.[0];
          const branchServices = branch?.services || [];
          const serviceIsOffered = branchServices.some(
            (service) => String(service.id) === requestedService
          );

          return {
            ...prev,
            branch_id: branch?.id || "",
            service_id: serviceIsOffered ? requestedService : branchServices[0]?.id || "",
          };
        });
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
  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(form.branch_id)),
    [branches, form.branch_id]
  );
  const availableServices = useMemo(
    () => selectedBranch?.services || [],
    [selectedBranch]
  );

  const handleBranchChange = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    const branchServices = branch?.services || [];
    setForm((prev) => {
      const currentServiceIsOffered = branchServices.some(
        (service) => String(service.id) === String(prev.service_id)
      );
      return {
        ...prev,
        branch_id: branchId,
        service_id: currentServiceIsOffered
          ? prev.service_id
          : branchServices[0]?.id || "",
      };
    });
  };

  const cameFromDiscovery = searchParams.has("branch") || searchParams.has("service");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.branch_id || !form.service_id || !form.appointment_date || !form.appointment_time) {
      setError("Please complete the branch, service, date, and time fields.");
      return;
    }
    const selectedDateTime = new Date(`${form.appointment_date}T${form.appointment_time}:00`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime <= new Date()) {
      setError("Please choose a future appointment date and time.");
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
      const detail = err.response?.data?.detail;
      const validationMessage = Array.isArray(detail)
        ? detail.map((item) => item.msg).filter(Boolean).join(" ")
        : detail;
      setError(
        validationMessage ||
        (!err.response
          ? "The booking server is temporarily unavailable. Please check that the backend is running, then try again."
          : "We couldn't create that appointment. Please review your schedule and try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomerShell title="Book Appointment" subtitle="Select a service, branch, and schedule.">
      {cameFromDiscovery && (
        <Notice tone="success">
          We preselected your landing-page choice. You can still change the branch or service below.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch (you can change this)" icon={HiOutlineMapPin}>
              <select
                value={form.branch_id}
                onChange={(event) => handleBranchChange(event.target.value)}
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
                {availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
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
          {selectedBranch && (
            <div className="mt-3 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-[#1F2937]"><HiOutlineMapPin className="h-5 w-5 text-[#D65A9A]" /> {selectedBranch.name}</p>
              <p className="mt-1 pl-7 text-xs leading-5 text-[#6B7280]">{selectedBranch.address}</p>
            </div>
          )}
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

export function CustomerShell({ title, subtitle, stats, showHeading = true, backTo, children }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const displayName = currentUser?.first_name || currentUser?.full_name || currentUser?.name || currentUser?.email?.split("@")[0] || "Customer";
  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };
  return (
    <main className="min-h-screen bg-[#FFF8FB]">
      <div className="w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white px-4 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.05)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              {backTo && <button type="button" onClick={() => navigate(backTo)} aria-label="Back to dashboard" title="Back to dashboard" className="grid h-10 w-10 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"><HiOutlineArrowLeft className="h-6 w-6" /></button>}
              <button type="button" onClick={() => navigate("/customer/dashboard")} className="flex items-center gap-3 text-left">
                <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-12 w-12 rounded-full object-cover ring-2 ring-[#F8DCEB]" />
                <div><p className="font-bold leading-tight text-[#1F2A44]">Happy Skin</p><p className="text-[10px] text-[#6B7280]">Customer Portal</p></div>
              </button>
            </div>
            {stats?.length ? (
              <div className="grid flex-1 grid-cols-3 gap-2 lg:mx-5 lg:max-w-xl">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-[#FFF8FB] px-3 py-2 text-center ring-1 ring-[#F3E8EF]">
                    <p className="text-lg font-extrabold leading-tight text-[#1F2937]">{stat.value}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#C85B95]">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : <div className="flex-1" />}
            <details className="group relative border-t border-[#F3E8EF] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[#FFF0F7] [&::-webkit-details-marker]:hidden">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D65A9A] font-bold text-white">{displayName.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 text-left"><span className="block max-w-32 truncate text-xs font-bold text-[#1F2937]">{displayName}</span><span className="block max-w-32 truncate text-[10px] text-[#6B7280]">{currentUser?.email}</span></span>
                <HiChevronDown className="h-4 w-4 text-[#6B7280] transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-xl border border-[#F3E8EF] bg-white p-2 shadow-xl"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#FFF0F7] hover:text-[#C85B95]"><HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" /> Logout</button></div>
            </details>
          </div>
          {showHeading && (
            <div className="mt-4 border-t border-[#F3E8EF] pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Customer portal</p>
              <h1 className="mt-1 text-2xl font-bold text-[#1F2937]">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
            </div>
          )}
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
