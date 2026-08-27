import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineSparkles,
} from "react-icons/hi2";
import {
  createAppointment,
  getBookingAvailability,
  getCustomerBranches,
  getCustomerServices,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerShell";
import ModernDatePicker from "../../components/common/ModernDatePicker";

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const APPOINTMENT_SLOTS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 9 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return { value, label: `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`, period };
});

const TIME_PERIODS = [
  { value: "morning", label: "Morning", range: "9:00 AM–11:30 AM" },
  { value: "afternoon", label: "Afternoon", range: "12:00 PM–4:30 PM" },
  { value: "evening", label: "Evening", range: "5:00 PM–7:00 PM" },
];

export default function CustomerBookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [slotAvailability, setSlotAvailability] = useState({});
  const [form, setForm] = useState({
    branch_id: searchParams.get("branch") || "",
    service_id: searchParams.get("service") || "",
    service_ids: searchParams.get("service") ? [searchParams.get("service")] : [],
    appointment_date: "",
    appointment_time: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
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
            service_ids: serviceIsOffered ? [requestedService] : branchServices[0]?.id ? [String(branchServices[0].id)] : [],
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
    if (!form.branch_id || !form.service_id || !form.appointment_date) {
      setSlotAvailability({});
      return undefined;
    }
    const controller = new AbortController();
    async function loadAvailability() {
      setIsLoadingAvailability(true);
      try {
        const data = await getBookingAvailability(
          form.branch_id,
          form.service_id,
          form.appointment_date,
          controller.signal,
          form.service_ids
        );
        setSlotAvailability(Object.fromEntries((data.slots || []).map((slot) => [slot.time, slot])));
      } catch (requestError) {
        if (requestError.name !== "CanceledError" && requestError.code !== "ERR_CANCELED") {
          setError("We couldn't load live availability. Please try again.");
          setSlotAvailability({});
        }
      } finally {
        setIsLoadingAvailability(false);
      }
    }
    loadAvailability();
    return () => controller.abort();
  }, [form.appointment_date, form.branch_id, form.service_id, form.service_ids]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(form.branch_id)),
    [branches, form.branch_id]
  );
  const availableServices = useMemo(() => selectedBranch?.services || [], [selectedBranch]);
  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === String(form.service_id)),
    [form.service_id, services]
  );
  const selectedServices = useMemo(() => availableServices.filter((service) => form.service_ids.map(String).includes(String(service.id))), [availableServices, form.service_ids]);
  const combinedDuration = selectedServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0);
  const combinedPrice = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const availableTimeSlots = useMemo(() => {
    if (!form.appointment_date) return APPOINTMENT_SLOTS;
    return APPOINTMENT_SLOTS.map((slot) => ({ ...slot, ...(slotAvailability[slot.value] || { available: false }) }));
  }, [form.appointment_date, slotAvailability]);
  const handleBranchChange = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    const branchServices = branch?.services || [];
    setForm((previous) => ({
      ...previous,
      branch_id: branchId,
      service_id: "",
      service_ids: [],
      appointment_time: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.branch_id || !form.service_ids.length || !form.appointment_date || !form.appointment_time) {
      setError("Please complete the branch, service, date, and time fields.");
      return;
    }
    const selectedDateTime = new Date(`${form.appointment_date}T${form.appointment_time}:00+08:00`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime.getTime() < Date.now() + 60 * 60 * 1000) {
      setError("Appointments must be booked at least 1 hour in advance.");
      return;
    }
    if (!slotAvailability[form.appointment_time]?.available) {
      setError("That time is unavailable or fully booked. Please choose another slot.");
      return;
    }

    setIsSaving(true);
    try {
      await createAppointment({
        branch_id: Number(form.branch_id),
        service_id: Number(form.service_id),
        service_ids: form.service_ids.map(Number),
        appointment_date: `${form.appointment_date}T${form.appointment_time}:00+08:00`,
        notes: form.notes.trim() || null,
      });
      setSuccess("Appointment requested for your selected date and time. Our team will confirm it soon.");
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
    <CustomerShell title="Book Appointment" showHeading={false} backTo="/customer/dashboard" backBesideLogo>
      <div className="mx-auto w-full max-w-[1500px]">
        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormSection number="1" title="Service and location" description="Select where you’d like to visit and what you need.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Branch" icon={HiOutlineMapPin}>
                  <select aria-label="Branch" required value={form.branch_id} onChange={(event) => handleBranchChange(event.target.value)} disabled={isLoading} className="form-input">
                    <option value="">Select a branch</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </Field>
                <Field label="Services (select one or more)" icon={HiOutlineSparkles}>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[#F0E3EA] bg-[#FFF8FB] p-3">{availableServices.map((service) => { const selected = form.service_ids.map(String).includes(String(service.id)); return <label key={service.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${selected ? "border-[#B94B86] bg-[#FCE7F3]" : "border-[#F0E3EA] bg-white"}`}><span><span className="block font-bold text-[#344054]">{service.name}</span><span className="text-xs text-[#667085]">{service.duration_minutes || 0} min · PHP {Number(service.price || 0).toLocaleString()}</span></span><input type="checkbox" checked={selected} onChange={() => setForm((previous) => { const ids = selected ? previous.service_ids.filter((id) => String(id) !== String(service.id)) : [...previous.service_ids, String(service.id)]; return { ...previous, service_ids: ids, service_id: ids[0] || "", appointment_time: "" }; })} className="h-5 w-5 accent-[#B94B86]" /></label>; })}</div>
                </Field>
              </div>
            </FormSection>

            <FormSection number="2" title="Date and time" description="Choose your exact schedule. Online bookings require at least 1 hour advance notice.">
              <div className="max-w-md">
                <Field label="Preferred date" icon={HiOutlineCalendarDays}>
                  <ModernDatePicker value={form.appointment_date} min={today()} onChange={(value) => setForm((previous) => ({ ...previous, appointment_date: value, appointment_time: "" }))} placeholder="Choose a preferred date" ariaLabel="Choose preferred appointment date" />
                </Field>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#344054]"><HiOutlineClock className="h-5 w-5 text-[#B94B86]" />Preferred time</span>
                  {form.appointment_time && <span className="rounded-full bg-[#FCE7F3] px-3 py-1 text-xs font-extrabold text-[#A83F78]">Selected: {APPOINTMENT_SLOTS.find((slot) => slot.value === form.appointment_time)?.label}</span>}
                </div>
                <TimeSlotPicker date={form.appointment_date} value={form.appointment_time} slots={availableTimeSlots} loading={isLoadingAvailability} onChange={(value) => setForm((previous) => ({ ...previous, appointment_time: value }))} />
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
              <h2 className="mt-2 text-xl font-extrabold text-[#202534]">{selectedServices.length ? `${selectedServices.length} service${selectedServices.length === 1 ? "" : "s"} selected` : "Choose services"}</h2>
              <div className="mt-2 space-y-1 text-sm text-[#667085]">{selectedServices.map((service) => <p key={service.id}>{service.name}</p>)}</div>
              <div className="mt-5 divide-y divide-[#F0E3EA] rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] px-4">
                <SummaryRow icon={HiOutlineMapPin} label="Branch" value={selectedBranch?.name || "Not selected"} />
                <SummaryRow icon={HiOutlineCalendarDays} label="Date" value={form.appointment_date || "Not selected"} />
                <SummaryRow icon={HiOutlineClock} label="Time" value={APPOINTMENT_SLOTS.find((slot) => slot.value === form.appointment_time)?.label || "Not selected"} />
                <SummaryRow icon={HiOutlineClock} label="Combined duration" value={selectedServices.length ? `${combinedDuration} minutes` : "—"} />
                <SummaryRow icon={HiOutlineSparkles} label="Estimated total" value={selectedServices.length ? `PHP ${combinedPrice.toLocaleString()}` : "—"} />
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
  return <div className="block text-sm font-bold text-[#344054]"><span className="mb-2 inline-flex items-center gap-2"><Icon className="h-5 w-5 text-[#B94B86]" />{label}</span>{children}</div>;
}

function TimeSlotPicker({ date, value, slots, loading, onChange }) {
  const firstAvailable = slots.find((slot) => slot.available)?.value || slots[0]?.value || "09:00";
  const [draftValue, setDraftValue] = useState(value || firstAvailable);

  useEffect(() => {
    setDraftValue(value || firstAvailable);
  }, [firstAvailable, value]);

  if (!date) {
    return <div className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-[#DDB8CB] bg-[#FFFAFC] px-5 py-6 text-center"><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#FCE7F3]"><HiOutlineCalendarDays className="h-5 w-5 text-[#B94B86]" /></span><p className="mt-2 text-sm font-bold text-[#475467]">Choose a date first</p><p className="mt-1 text-xs text-[#98A2B3]">Available appointment times will appear here.</p></div></div>;
  }

  if (loading) {
    return <div className="grid min-h-28 place-items-center rounded-2xl border border-[#F0E3EA] bg-[#FFFAFC] text-sm font-bold text-[#667085]">Checking live availability…</div>;
  }

  if (!slots.length) {
    return <div className="rounded-2xl border border-[#F0E3EA] bg-[#FFFAFC] px-5 py-6 text-center"><p className="text-sm font-bold text-[#475467]">No times available for this date</p><p className="mt-1 text-xs text-[#98A2B3]">Please choose another day.</p></div>;
  }

  const [draftHour24, draftMinute] = draftValue.split(":").map(Number);
  const draftPeriod = draftHour24 >= 12 ? "PM" : "AM";
  const draftHour12 = draftHour24 % 12 || 12;
  const draftSlot = slots.find((slot) => slot.value === draftValue);
  const hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minuteOptions = ["00", "30"];

  const updateDraft = ({ hour = draftHour12, minute = draftMinute, period = draftPeriod }) => {
    const hour24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
    setDraftValue(`${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  };

  return <div aria-label="Scrollable appointment time picker" className="overflow-hidden rounded-2xl border border-[#E7DCE2] bg-white shadow-sm">
    <div className="relative grid grid-cols-3 px-3 sm:px-8">
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-[#F1F2F4] sm:inset-x-8" />
      <WheelColumn label="Hour" options={hourOptions} selected={draftHour12} onSelect={(hour) => updateDraft({ hour })} />
      <WheelColumn label="Minute" options={minuteOptions} selected={String(draftMinute).padStart(2, "0")} onSelect={(minute) => updateDraft({ minute })} />
      <WheelColumn label="AM or PM" options={["AM", "PM"]} selected={draftPeriod} onSelect={(period) => updateDraft({ period })} />
    </div>

    <div className={`mx-4 mb-3 rounded-xl px-3 py-2 text-center text-xs font-bold ${draftSlot?.available ? "bg-[#ECFDF3] text-[#166534]" : draftSlot?.is_full ? "bg-[#FFF1F2] text-[#B42318]" : "bg-[#FFF7ED] text-[#9A3412]"}`}>
      {draftSlot?.available ? `${draftSlot.label} is available` : draftSlot?.is_full ? `${draftSlot.label} is fully booked` : "This time is unavailable. Choose another time."}
    </div>

    <div className="flex justify-end gap-2 border-t border-[#F0E3EA] px-4 py-3">
      <button type="button" onClick={() => setDraftValue(value || firstAvailable)} className="min-h-10 rounded-xl px-4 text-sm font-extrabold text-[#667085] hover:bg-[#F7F4F6]">Cancel</button>
      <button type="button" disabled={!draftSlot?.available} onClick={() => onChange(draftValue)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#B94B86] px-5 text-sm font-extrabold text-white hover:bg-[#A83F78] disabled:cursor-not-allowed disabled:opacity-40"><HiOutlineCheck className="h-4 w-4" /> OK</button>
    </div>
  </div>;
}

function WheelColumn({ label, options, selected, onSelect }) {
  const listRef = useRef(null);
  const settleTimer = useRef(null);
  const itemHeight = 44;

  useEffect(() => {
    const index = options.findIndex((option) => String(option) === String(selected));
    if (index >= 0 && listRef.current) listRef.current.scrollTo({ top: index * itemHeight, behavior: "smooth" });
  }, [options, selected]);

  const handleScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(listRef.current.scrollTop / itemHeight)));
      onSelect(options[index]);
    }, 80);
  };

  return <div ref={listRef} onScroll={handleScroll} aria-label={label} className="relative z-10 h-[220px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-[88px] text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {options.map((option) => {
      const active = String(option) === String(selected);
      return <button key={option} type="button" onClick={() => onSelect(option)} className={`block h-11 w-full snap-center text-xl transition ${active ? "font-extrabold text-[#111827]" : "font-medium text-[#7B8190]"}`}>{option}</button>;
    })}
  </div>;
}

function SummaryRow({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 py-3"><Icon className="h-5 w-5 shrink-0 text-[#B94B86]" /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="truncate text-sm font-bold text-[#344054]">{value}</p></div></div>;
}
