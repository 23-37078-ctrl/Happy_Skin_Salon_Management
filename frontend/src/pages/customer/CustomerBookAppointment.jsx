import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineInformationCircle,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import {
  createAppointment,
  getBranchProviders,
  getCustomerBranches,
  getCustomerServices,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerShell";

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export default function CustomerBookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState({
    branch_id: searchParams.get("branch") || "",
    service_id: searchParams.get("service") || "",
    preferred_service_provider_id: "",
    appointment_date: "",
    appointment_time: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
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
        setForm((previous) => {
          const requestedService = String(previous.service_id || "");
          const requestedBranch = String(previous.branch_id || "");
          const serviceBranch = requestedService
            ? branchData?.find((branch) => branch.services?.some((service) => String(service.id) === requestedService))
            : null;
          const branch = branchData?.find((item) => String(item.id) === requestedBranch) || serviceBranch || branchData?.[0];
          const branchServices = branch?.services || [];
          const serviceIsOffered = branchServices.some((service) => String(service.id) === requestedService);
          return {
            ...previous,
            branch_id: branch?.id || "",
            service_id: serviceIsOffered ? requestedService : branchServices[0]?.id || "",
          };
        });
      } catch (requestError) {
        if (requestError.name !== "CanceledError" && requestError.code !== "ERR_CANCELED") {
          setError("We couldn't load booking options. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!form.branch_id) {
      return undefined;
    }
    const controller = new AbortController();
    async function loadProviders() {
      setIsLoadingProviders(true);
      try {
        const data = await getBranchProviders(form.branch_id, controller.signal);
        setProviders(data || []);
      } catch (requestError) {
        if (requestError.name !== "CanceledError" && requestError.code !== "ERR_CANCELED") {
          setProviders([]);
        }
      } finally {
        setIsLoadingProviders(false);
      }
    }
    loadProviders();
    return () => controller.abort();
  }, [form.branch_id]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(form.branch_id)),
    [branches, form.branch_id]
  );
  const availableServices = useMemo(() => selectedBranch?.services || [], [selectedBranch]);
  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(form.service_id)),
    [form.service_id, services]
  );
  const selectedProvider = useMemo(
    () => providers.find((provider) => String(provider.id) === String(form.preferred_service_provider_id)),
    [form.preferred_service_provider_id, providers]
  );
  const handleBranchChange = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    const branchServices = branch?.services || [];
    setForm((previous) => ({
      ...previous,
      branch_id: branchId,
      service_id: branchServices.some((service) => String(service.id) === String(previous.service_id))
        ? previous.service_id
        : branchServices[0]?.id || "",
      preferred_service_provider_id: "",
    }));
  };

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
        preferred_service_provider_id: form.preferred_service_provider_id
          ? Number(form.preferred_service_provider_id)
          : null,
        appointment_date: `${form.appointment_date}T${form.appointment_time}:00`,
        notes: form.notes.trim() || null,
      });
      setSuccess("Appointment requested. Our team will confirm your schedule and specialist soon.");
      setTimeout(() => navigate("/customer/history"), 900);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      const validationMessage = Array.isArray(detail) ? detail.map((item) => item.msg).filter(Boolean).join(" ") : detail;
      setError(validationMessage || (!requestError.response
        ? "The booking server is temporarily unavailable. Please try again shortly."
        : "We couldn't create that appointment. Please review your details and try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CustomerShell title="Book Appointment" showHeading={false}>
      <div className="mx-auto w-full max-w-[1500px]">
        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormSection number="1" title="Service and location" description="Select where you’d like to visit and what you need.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Branch" icon={HiOutlineMapPin}>
                  <select required value={form.branch_id} onChange={(event) => handleBranchChange(event.target.value)} disabled={isLoading} className="form-input">
                    <option value="">Select a branch</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </Field>
                <Field label="Service" icon={HiOutlineSparkles}>
                  <select required value={form.service_id} onChange={(event) => setForm((previous) => ({ ...previous, service_id: event.target.value }))} disabled={isLoading || !selectedBranch} className="form-input">
                    <option value="">Select a service</option>
                    {availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                </Field>
              </div>
            </FormSection>

            <FormSection number="2" title="Preferred specialist" description="Optional — choose someone you’d like to request for this service.">
              <div role="radiogroup" aria-label="Preferred specialist" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ProviderOption checked={!form.preferred_service_provider_id} name="Any available specialist" detail="Best flexibility" onSelect={() => setForm((previous) => ({ ...previous, preferred_service_provider_id: "" }))} />
                {providers.map((provider) => (
                  <ProviderOption key={provider.id} checked={String(form.preferred_service_provider_id) === String(provider.id)} name={provider.full_name} detail={provider.job_title || "Salon specialist"} onSelect={() => setForm((previous) => ({ ...previous, preferred_service_provider_id: String(provider.id) }))} />
                ))}
              </div>
              {isLoadingProviders && <p className="mt-3 text-xs text-[#667085]">Loading branch specialists…</p>}
              {!isLoadingProviders && selectedBranch && providers.length === 0 && <p className="mt-3 text-xs text-[#667085]">No specialists are listed for this branch yet. The salon will assign an available team member.</p>}
              <p className="mt-4 flex gap-2 rounded-xl bg-[#F9F5F7] px-3 py-2.5 text-xs leading-5 text-[#667085]"><HiOutlineInformationCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B94B86]" />Your preference is a request, not a guaranteed assignment. The salon keeps final staffing control based on availability and service requirements.</p>
            </FormSection>

            <FormSection number="3" title="Date and time" description="Tell us when you’d prefer to come in.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Preferred date" icon={HiOutlineCalendarDays}>
                  <input required type="date" value={form.appointment_date} min={today()} onChange={(event) => setForm((previous) => ({ ...previous, appointment_date: event.target.value }))} className="form-input" />
                </Field>
                <Field label="Preferred time" icon={HiOutlineClock}>
                  <input required type="time" value={form.appointment_time} onChange={(event) => setForm((previous) => ({ ...previous, appointment_time: event.target.value }))} className="form-input" />
                </Field>
              </div>
              <label className="mt-4 block text-sm font-bold text-[#344054]">Notes <span className="font-normal text-[#98A2B3]">(optional)</span>
                <textarea value={form.notes} maxLength={255} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} rows={3} placeholder="Share preferences or anything our team should know" className="form-input mt-2 resize-none" />
                <span className="mt-1 block text-right text-xs font-normal text-[#98A2B3]">{form.notes.length}/255</span>
              </label>
            </FormSection>

            <button type="submit" disabled={isSaving || isLoading} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#B94B86] px-5 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(185,75,134,0.26)] transition hover:-translate-y-0.5 hover:bg-[#A83F78] focus:outline-none focus:ring-4 focus:ring-[#B94B86]/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              <HiOutlineCheckCircle className="h-5 w-5" />
              {isSaving ? "Sending request…" : "Request appointment"}
            </button>
          </form>

          <aside className="h-fit overflow-hidden rounded-[1.5rem] border border-[#F0E3EA] bg-white shadow-[0_14px_40px_rgba(74,43,58,0.06)] xl:sticky xl:top-5">
            {selectedService?.image && <img src={selectedService.image} alt="" className="h-48 w-full object-cover" />}
            <div className="p-5 sm:p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B94B86]">Your request</p>
              <h2 className="mt-2 text-xl font-extrabold text-[#202534]">{selectedService?.name || "Choose a service"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">{selectedService?.description || selectedService?.reason || "Your service details will appear here."}</p>
              <div className="mt-5 divide-y divide-[#F0E3EA] rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] px-4">
                <SummaryRow icon={HiOutlineMapPin} label="Branch" value={selectedBranch?.name || "Not selected"} />
                <SummaryRow icon={HiOutlineUserGroup} label="Specialist" value={selectedProvider?.full_name || "Any available"} />
                <SummaryRow icon={HiOutlineClock} label="Duration" value={selectedService ? `${selectedService.duration_minutes || 0} minutes` : "—"} />
                <SummaryRow icon={HiOutlineSparkles} label="Estimated price" value={selectedService ? `PHP ${Number(selectedService.price || 0).toLocaleString()}` : "—"} />
              </div>
              {selectedBranch?.address && <p className="mt-4 text-xs leading-5 text-[#667085]">{selectedBranch.address}</p>}
            </div>
          </aside>
        </div>
      </div>
    </CustomerShell>
  );
}

function FormSection({ number, title, description, children }) {
  return <section className="rounded-[1.5rem] border border-[#F0E3EA] bg-white p-5 shadow-[0_14px_40px_rgba(74,43,58,0.055)] sm:p-6">
    <div className="mb-5 flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FCE7F3] text-sm font-extrabold text-[#A83F78]">{number}</span>
      <div><h2 className="font-extrabold text-[#202534]">{title}</h2><p className="mt-1 text-sm text-[#667085]">{description}</p></div>
    </div>
    {children}
  </section>;
}

function Field({ label, icon: Icon, children }) {
  return <label className="block text-sm font-bold text-[#344054]"><span className="mb-2 inline-flex items-center gap-2"><Icon className="h-5 w-5 text-[#B94B86]" />{label}</span>{children}</label>;
}

function ProviderOption({ checked, name, detail, onSelect }) {
  return <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-[#B94B86]/15 ${checked ? "border-[#B94B86] bg-[#FFF3F8] shadow-[0_8px_20px_rgba(185,75,134,0.09)]" : "border-[#E8E1E5] bg-white hover:border-[#D8A8C1]"}`}>
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${checked ? "bg-[#B94B86] text-white" : "bg-[#F4EEF1] text-[#8B687A]"}`}>{checked ? <HiOutlineCheck className="h-5 w-5" /> : <HiOutlineUserGroup className="h-5 w-5" />}</span>
    <span className="min-w-0"><span className="block truncate text-sm font-bold text-[#344054]">{name}</span><span className="mt-0.5 block truncate text-xs text-[#667085]">{detail}</span></span>
  </button>;
}

function SummaryRow({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 py-3"><Icon className="h-5 w-5 shrink-0 text-[#B94B86]" /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="truncate text-sm font-bold text-[#344054]">{value}</p></div></div>;
}
