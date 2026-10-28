import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  createAppointment,
  createGuestAppointment,
  getBookingAvailability,
  getCustomerBranches,
  getCustomerServices,
  getGuestBookingAvailability,
  getPublicDiscovery,
  sendGuestBookingPhoneOtp,
  verifyGuestBookingPhoneOtp,
} from "../../services/customerService";
import { CustomerShell, Notice } from "./CustomerShell";
import ModernDatePicker from "../../components/common/ModernDatePicker";
import { getSalonServiceCategory, SALON_SERVICE_CATEGORIES } from "../../constants/salonServices";
import { useAuth } from "../../hooks/useAuth";

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
  { value: "morning", label: "Morning", range: "9:00 AM to 11:30 AM" },
  { value: "afternoon", label: "Afternoon", range: "12:00 PM to 4:30 PM" },
  { value: "evening", label: "Evening", range: "5:00 PM to 7:00 PM" },
];

export default function CustomerBookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceSearch, setServiceSearch] = useState("");
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
  const [doubleBookingMessage, setDoubleBookingMessage] = useState("");
  const [showDuplicateBookingConfirm, setShowDuplicateBookingConfirm] = useState(false);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [showGuestContact, setShowGuestContact] = useState(false);
  const [guestContact, setGuestContact] = useState({ guest_name: "", guest_email: "", guest_phone: "" });
  const [guestPhoneVerificationId, setGuestPhoneVerificationId] = useState("");
  const [guestPhoneVerified, setGuestPhoneVerified] = useState(false);
  const [guestOtpCode, setGuestOtpCode] = useState("");
  const [guestOtpSent, setGuestOtpSent] = useState(false);
  const [isPhoneOtpBusy, setIsPhoneOtpBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      setIsLoading(true);
      setError("");
      try {
        const { branchData, serviceData } = isAuthenticated
          ? await Promise.all([getCustomerBranches(controller.signal), getCustomerServices(controller.signal)]).then(([branchData, serviceData]) => ({ branchData, serviceData }))
          : await getPublicDiscovery(controller.signal).then((data) => ({ branchData: data.branches || [], serviceData: data.services || [] }));
        setBranches(branchData || []);
        setServices(serviceData || []);
        setForm((previous) => {
          const requestedService = String(previous.service_id || "");
          const requestedBranch = String(previous.branch_id || "");
          const serviceBranch = requestedService
            ? branchData?.find((branch) => branch.services?.some((service) => String(service.id) === requestedService))
            : null;
          const mainBranch = branchData?.find((item) => item.name?.toLowerCase().includes("main"));
          const branch = branchData?.find((item) => String(item.id) === requestedBranch)
            || (requestedService && !mainBranch?.services?.some((service) => String(service.id) === requestedService) ? serviceBranch : null)
            || mainBranch
            || serviceBranch
            || branchData?.[0];
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
  }, [isAuthenticated]);

  useEffect(() => {
    if (!form.branch_id || !form.service_id || !form.appointment_date) return undefined;
    const controller = new AbortController();
    async function loadAvailability() {
      setIsLoadingAvailability(true);
      try {
        const loadAvailability = isAuthenticated ? getBookingAvailability : getGuestBookingAvailability;
        const data = await loadAvailability(
          form.branch_id,
          form.service_id,
          form.appointment_date,
          controller.signal,
          form.service_ids
        );
        setSlotAvailability({ branchId: String(form.branch_id), serviceId: String(form.service_id), appointmentDate: form.appointment_date, slots: Object.fromEntries((data.slots || []).map((slot) => [slot.time, slot])) });
      } catch (requestError) {
        if (requestError.name !== "CanceledError" && requestError.code !== "ERR_CANCELED") {
          setError("We couldn't load live availability. Please try again.");
          setSlotAvailability({ branchId: String(form.branch_id), serviceId: String(form.service_id), appointmentDate: form.appointment_date, slots: {} });
        }
      } finally {
        setIsLoadingAvailability(false);
      }
    }
    loadAvailability();
    return () => controller.abort();
  }, [form.appointment_date, form.branch_id, form.service_id, form.service_ids, isAuthenticated]);

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
  const availableServiceGroups = useMemo(() => {
    const grouped = new Map();
    const query = serviceSearch.trim().toLocaleLowerCase();
    availableServices.forEach((service) => {
      const category = service.category || getSalonServiceCategory(service.name);
      if (query && ![service.name, service.description, category].some((value) => String(value || "").toLocaleLowerCase().includes(query))) return;
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(service);
    });
    return [...grouped.entries()].sort(([first], [second]) => {
      const firstOrder = SALON_SERVICE_CATEGORIES.indexOf(first);
      const secondOrder = SALON_SERVICE_CATEGORIES.indexOf(second);
      return (firstOrder < 0 ? Number.MAX_SAFE_INTEGER : firstOrder) - (secondOrder < 0 ? Number.MAX_SAFE_INTEGER : secondOrder);
    });
  }, [availableServices, serviceSearch]);
  const combinedDuration = selectedServices.reduce((sum, service) => sum + Number(service.duration_minutes || 0), 0);
  const combinedPrice = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const availabilityMatchesSelection = slotAvailability.branchId === String(form.branch_id)
    && slotAvailability.serviceId === String(form.service_id)
    && slotAvailability.appointmentDate === form.appointment_date;
  const availableTimeSlots = useMemo(() => {
    if (!form.appointment_date) return APPOINTMENT_SLOTS;
    const slots = availabilityMatchesSelection ? slotAvailability.slots : {};
    return APPOINTMENT_SLOTS.map((slot) => ({ ...slot, ...(slots[slot.value] || { available: false }) }));
  }, [availabilityMatchesSelection, form.appointment_date, slotAvailability]);
  const handleBranchChange = (branchId) => {
    setForm((previous) => ({
      ...previous,
      branch_id: branchId,
      service_id: "",
      service_ids: [],
      appointment_time: "",
    }));
  };

  const toggleService = (service) => {
    setError("");
    const selected = form.service_ids.map(String).includes(String(service.id));
    if (!selected && form.service_ids.length >= 20) {
      setError("You can select up to 20 services in one booking.");
      return;
    }
    setForm((previous) => {
      const ids = selected
        ? previous.service_ids.filter((id) => String(id) !== String(service.id))
        : [...previous.service_ids, String(service.id)];
      return { ...previous, service_ids: ids, service_id: ids[0] || "", appointment_time: "" };
    });
  };

  const toggleCategory = (categoryServices) => {
    setError("");
    const selectedIds = new Set(form.service_ids.map(String));
    const allSelected = categoryServices.every((service) => selectedIds.has(String(service.id)));
    if (allSelected) categoryServices.forEach((service) => selectedIds.delete(String(service.id)));
    else categoryServices.forEach((service) => selectedIds.add(String(service.id)));
    if (selectedIds.size > 20) {
      setError("You can select up to 20 services in one booking. Deselect a few before adding this category.");
      return;
    }
    const ids = [...selectedIds];
    setForm((previous) => {
      return { ...previous, service_ids: ids, service_id: ids[0] || "", appointment_time: "" };
    });
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
    if (!availabilityMatchesSelection || !slotAvailability.slots[form.appointment_time]?.available) {
      setError("That time is unavailable or fully booked. Please choose another slot.");
      return;
    }

    if (!isAuthenticated) {
      setShowGuestContact(true);
      return;
    }
    setShowBookingConfirm(true);
  };

  const handleGuestPhoneChange = (phone) => {
    setGuestContact((current) => ({ ...current, guest_phone: phone }));
    setGuestPhoneVerificationId("");
    setGuestPhoneVerified(false);
    setGuestOtpSent(false);
    setGuestOtpCode("");
  };

  const sendGuestPhoneCode = async () => {
    setError("");
    if (guestContact.guest_name.trim().length < 2 || !guestContact.guest_phone.trim()) {
      setError("Enter your full name and mobile number first.");
      return;
    }
    setIsPhoneOtpBusy(true);
    try {
      const result = await sendGuestBookingPhoneOtp({ full_name: guestContact.guest_name.trim(), phone_number: guestContact.guest_phone.trim() });
      setGuestPhoneVerificationId(result.verification_id);
      setGuestPhoneVerified(false);
      setGuestOtpSent(true);
      setGuestOtpCode("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "We couldn't send a code to that number. Check the number and try again.");
    } finally {
      setIsPhoneOtpBusy(false);
    }
  };

  const verifyGuestPhoneCode = async () => {
    setError("");
    setIsPhoneOtpBusy(true);
    try {
      await verifyGuestBookingPhoneOtp({ verification_id: guestPhoneVerificationId, code: guestOtpCode });
      setGuestPhoneVerified(true);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "The code couldn't be verified. Check it and try again.");
    } finally {
      setIsPhoneOtpBusy(false);
    }
  };

  const submitBooking = async (contact = null, allowDuplicate = false) => {
    setIsSaving(true);
    setError("");
    setDoubleBookingMessage("");
    try {
      const bookingPayload = {
        branch_id: Number(form.branch_id),
        service_id: Number(form.service_id),
        service_ids: form.service_ids.map(Number),
        allow_duplicate: allowDuplicate,
        appointment_date: `${form.appointment_date}T${form.appointment_time}:00+08:00`,
        notes: form.notes.trim() || null,
      };
      const bookingResult = contact
        ? await createGuestAppointment({ ...bookingPayload, ...contact, phone_verification_id: guestPhoneVerificationId })
        : await createAppointment(bookingPayload);
      setShowGuestContact(false);
      setGuestPhoneVerificationId("");
      setGuestPhoneVerified(false);
      setGuestOtpSent(false);
      setGuestOtpCode("");
      setSuccess(bookingResult.confirmation_sms_sent
        ? "Booking request received. We sent a confirmation SMS with your appointment details and arrival policy. Please arrive 10–15 minutes early."
        : "Booking request received, but the confirmation SMS could not be sent. Please contact the branch to confirm your number. Arrive 10–15 minutes early; bookings without check-in within 30 minutes may be cancelled.");
      navigate(contact ? "/" : "/customer/history");
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      if (typeof detail === "string" && detail.startsWith("DOUBLE_BOOKING:")) {
        setShowBookingConfirm(false);
        setDoubleBookingMessage(detail.slice("DOUBLE_BOOKING:".length).trim());
        setShowDuplicateBookingConfirm(true);
        return;
      }
      const validationMessage = Array.isArray(detail) ? detail.map((item) => item.msg).filter(Boolean).join(" ") : detail;
      setError(validationMessage || (!requestError.response
        ? "The booking server is temporarily unavailable. Please try again shortly."
        : "We couldn't create that appointment. Please review your details and try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGuestContactSubmit = (event) => {
    event.preventDefault();
    submitBooking(guestContact);
  };

  return (
    <CustomerShell title="Book Appointment" showHeading={false} backTo={isAuthenticated ? "/customer/dashboard" : "/"} backBesideLogo guestMode={!isAuthenticated}>
      <div className="mx-auto w-full max-w-[1680px]">
        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormSection number="1" title="Service and location" description="Select where you'd like to visit and what you need.">
              <div className="space-y-4">
                <Field label="Branch" icon={HiOutlineMapPin}>
                  <select aria-label="Branch" required value={form.branch_id} onChange={(event) => handleBranchChange(event.target.value)} disabled={isLoading} className="form-input">
                    <option value="">{isLoading ? "Loading branches..." : "Choose a branch"}</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </Field>
                {isLoading && <p className="-mt-2 text-xs text-[#667085]">Loading branches...</p>}
                <Field label="Services" icon={HiOutlineSparkles}>
                  <div className="rounded-2xl border border-[#F0E3EA] bg-[#FFF8FB] p-3 sm:p-4">
                    <label className="relative mb-4 block"><span className="sr-only">Search services</span><HiOutlineMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#B94B86]" /><input type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services by name or category" className="form-input w-full !pl-11 !pr-10 [&::-webkit-search-cancel-button]:ml-2 [&::-webkit-search-cancel-button]:cursor-pointer" /></label>
                    <div className="max-h-[40rem] space-y-5 overflow-y-auto pr-1">
                      {isLoading ? <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-[#667085]" role="status">Loading services...</p> : availableServiceGroups.length ? availableServiceGroups.map(([category, categoryServices]) => {
                        const allSelected = categoryServices.every((service) => form.service_ids.map(String).includes(String(service.id)));
                        return <section key={category}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#F0E3EA] pb-2"><h3 className="text-xs font-extrabold uppercase tracking-wide text-[#B94B86]">{category} <span className="font-semibold text-[#98A2B3]">({categoryServices.length})</span></h3><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold text-[#A83F78] hover:bg-[#FCE7F3]"><input type="checkbox" checked={allSelected} onChange={() => toggleCategory(categoryServices)} aria-label={`${allSelected ? "Deselect" : "Select"} all ${category} services`} className="h-4 w-4 accent-[#B94B86]" /><span>{allSelected ? "Deselect all" : "Select all"}</span></label></div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {categoryServices.map((service) => {
                              const selected = form.service_ids.map(String).includes(String(service.id));
                              return <label key={service.id} className={`flex min-h-28 cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition ${selected ? "border-[#B94B86] bg-[#FCE7F3] ring-1 ring-[#B94B86]/20" : "border-[#F0E3EA] bg-white hover:border-[#E7B8CF]"}`}>
                                <img src={service.image || service.image_url || "/images/services/signature-facial.jpg"} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/services/signature-facial.jpg"; }} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                                <span className="min-w-0 flex-1"><span className="block font-bold text-[#344054]">{service.name}</span><span className="mt-1 block line-clamp-2 text-xs text-[#667085]">{service.description || "Salon service"}</span><span className="mt-1 block text-xs font-semibold text-[#754463]">{service.duration_minutes || 0} min &middot; PHP {Number(service.price || 0).toLocaleString()}</span></span>
                                <input type="checkbox" checked={selected} onChange={() => toggleService(service)} className="mr-1 h-5 w-5 shrink-0 accent-[#B94B86]" />
                              </label>;
                            })}
                          </div>
                        </section>;
                      }) : <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-[#667085]">{serviceSearch ? "No services match your search." : "No services are offered at this branch yet."}</p>}
                    </div>
                    <p className="mt-3 text-right text-xs text-[#667085]">{isLoading ? "Loading services..." : `${form.service_ids.length} of 20 services selected`}</p>
                  </div>
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
              {isSaving ? "Sending request..." : "Request appointment"}
            </button>
          </form>

          <aside className="h-fit overflow-hidden rounded-[1.5rem] border border-[#F0E3EA] bg-white shadow-[0_14px_40px_rgba(74,43,58,0.06)] xl:sticky xl:top-5">
            {selectedService?.image && <img src={selectedService.image} alt="" className="h-36 w-full object-cover" />}
            <div className="p-5 sm:p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#B94B86]">Your request</p>
              <h2 className="mt-2 text-xl font-extrabold text-[#202534]">{selectedServices.length ? `${selectedServices.length} service${selectedServices.length === 1 ? "" : "s"} selected` : "Choose services"}</h2>
              <div className="mt-2 space-y-1 text-sm text-[#667085]">{selectedServices.map((service) => <p key={service.id}>{service.name}</p>)}</div>
              <div className="mt-5 divide-y divide-[#F0E3EA] rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] px-4">
                <SummaryRow icon={HiOutlineMapPin} label="Branch" value={selectedBranch?.name || "Not selected"} />
                <SummaryRow icon={HiOutlineCalendarDays} label="Date" value={form.appointment_date || "Not selected"} />
                <SummaryRow icon={HiOutlineClock} label="Time" value={APPOINTMENT_SLOTS.find((slot) => slot.value === form.appointment_time)?.label || "Not selected"} />
                <SummaryRow icon={HiOutlineClock} label="Combined duration" value={selectedServices.length ? `${combinedDuration} minutes` : "-"} />
                <SummaryRow icon={HiOutlineSparkles} label="Estimated total" value={selectedServices.length ? `PHP ${combinedPrice.toLocaleString()}` : "-"} />
              </div>
              {selectedBranch?.address && <p className="mt-4 text-xs leading-5 text-[#667085]">{selectedBranch.address}</p>}
              <div className="mt-5 rounded-2xl border border-[#F2D8B7] bg-[#FFFAF2] p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-[#9A5B13]">Arrival policy</p><p className="mt-2 text-xs leading-5 text-[#755B3B]">Please arrive 10-15 minutes early. If you arrive after your scheduled time, customers already at the branch may be served first. Bookings without staff check-in may be cancelled 30 minutes after the appointment time.</p></div>
            </div>
          </aside>
        </div>
      </div>
      {showGuestContact && <GuestContactDialog
        value={guestContact}
        onChange={setGuestContact}
        phoneVerified={guestPhoneVerified}
        otpSent={guestOtpSent}
        otpCode={guestOtpCode}
        onPhoneChange={handleGuestPhoneChange}
        onOtpCodeChange={setGuestOtpCode}
        onSendCode={sendGuestPhoneCode}
        onVerifyCode={verifyGuestPhoneCode}
        otpBusy={isPhoneOtpBusy}
        onClose={() => setShowGuestContact(false)}
        onSubmit={handleGuestContactSubmit}
        isSaving={isSaving}
        error={error}
      />}
      {doubleBookingMessage && showDuplicateBookingConfirm && <div className="fixed inset-0 z-[120] grid place-items-center bg-[#1F2A44]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowDuplicateBookingConfirm(false); setDoubleBookingMessage(""); } }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="double-booking-title" aria-describedby="double-booking-description" className="w-full max-w-md rounded-[1.5rem] border border-[#F0E3EA] bg-white p-6 text-center shadow-2xl sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF4E5] text-[#B54708]"><HiOutlineClock className="h-7 w-7" /></div>
          <h2 id="double-booking-title" className="mt-4 text-xl font-extrabold text-[#202534]">Are you sure?</h2>
          <p id="double-booking-description" className="mt-2 text-sm leading-6 text-[#667085]">You already have a booking for the same services and time. Do you want to book it again?</p>
          <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => { setShowDuplicateBookingConfirm(false); setDoubleBookingMessage(""); }} className="min-h-11 rounded-xl border border-[#E4D4DE] bg-white px-6 py-2.5 text-sm font-extrabold text-[#667085] hover:bg-[#FFF8FB]">No, cancel</button>
            <button type="button" autoFocus disabled={isSaving} onClick={() => { setShowDuplicateBookingConfirm(false); submitBooking(null, true); }} className="min-h-11 rounded-xl bg-[#B94B86] px-6 py-2.5 text-sm font-extrabold text-white hover:bg-[#A83F78] disabled:opacity-50">{isSaving ? "Booking..." : "Yes, book again"}</button>
          </div>
        </section>
      </div>}
      {showBookingConfirm && <div className="fixed inset-0 z-[130] grid place-items-center bg-[#1F2A44]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setShowBookingConfirm(false); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-booking-title" aria-describedby="confirm-booking-description" className="w-full max-w-lg rounded-[1.5rem] border border-[#F0E3EA] bg-white p-6 shadow-2xl sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FCE7F3] text-[#B94B86]"><HiOutlineCheckCircle className="h-7 w-7" /></div>
          <h2 id="confirm-booking-title" className="mt-4 text-center text-xl font-extrabold text-[#202534]">Confirm your booking</h2>
          <p id="confirm-booking-description" className="mt-2 text-center text-sm leading-6 text-[#667085]">Please review your appointment details before we send the booking request.</p>
          <div className="mt-5 space-y-2 rounded-2xl border border-[#F0E3EA] bg-[#FFFBFD] p-4 text-sm">
            <p><span className="font-bold text-[#344054]">Branch:</span> <span className="text-[#667085]">{selectedBranch?.name || "Not selected"}</span></p>
            <p><span className="font-bold text-[#344054]">Services:</span> <span className="text-[#667085]">{selectedServices.map((service) => service.name).join(", ") || "Not selected"}</span></p>
            <p><span className="font-bold text-[#344054]">Date and time:</span> <span className="text-[#667085]">{form.appointment_date || "Not selected"} · {APPOINTMENT_SLOTS.find((slot) => slot.value === form.appointment_time)?.label || "Not selected"}</span></p>
            <p><span className="font-bold text-[#344054]">Estimated total:</span> <span className="text-[#667085]">PHP {combinedPrice.toLocaleString()}</span></p>
          </div>
          {doubleBookingMessage && <p className="mt-3 rounded-xl bg-[#FFF4E5] px-3 py-2 text-xs leading-5 text-[#9A5B13]">{doubleBookingMessage} Your request will be checked again before it is submitted.</p>}
          <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <button type="button" disabled={isSaving} onClick={() => setShowBookingConfirm(false)} className="min-h-11 rounded-xl border border-[#E4D4DE] bg-white px-6 py-2.5 text-sm font-extrabold text-[#667085] hover:bg-[#FFF8FB] disabled:opacity-50">Back to booking</button>
            <button type="button" disabled={isSaving} onClick={() => { setShowBookingConfirm(false); submitBooking(null, Boolean(doubleBookingMessage)); }} className="min-h-11 rounded-xl bg-[#B94B86] px-6 py-2.5 text-sm font-extrabold text-white hover:bg-[#A83F78] disabled:opacity-50">{isSaving ? "Confirming..." : "Confirm booking"}</button>
          </div>
        </section>
      </div>}
    </CustomerShell>
  );
}

function GuestContactDialog({ value, onChange, onClose, onSubmit, isSaving, error, phoneVerified, otpSent, otpCode, onPhoneChange, onOtpCodeChange, onSendCode, onVerifyCode, otpBusy }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#1F2A44]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
    <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="guest-booking-title" className="w-full max-w-lg rounded-[1.5rem] border border-[#F0E3EA] bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#B94B86]">Guest booking</p><h2 id="guest-booking-title" className="mt-1 text-xl font-extrabold text-[#202534]">Your contact details</h2><p className="mt-2 text-sm leading-6 text-[#667085]">The branch staff will use these details to identify you and confirm your appointment.</p></div><button type="button" onClick={onClose} disabled={isSaving} aria-label="Close contact details" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#667085] hover:bg-[#FFF0F7] disabled:opacity-50"><HiOutlineXMark className="h-5 w-5" /></button></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-[#344054]">Full name<input required autoComplete="name" minLength={2} maxLength={100} value={value.guest_name} onChange={(event) => onChange((current) => ({ ...current, guest_name: event.target.value }))} placeholder="Your full name" className="form-input mt-2" /></label>
        <div><label className="block text-sm font-bold text-[#344054]">Mobile number<input required type="tel" autoComplete="tel" minLength={7} maxLength={20} pattern="[+0-9 ()-]{7,20}" value={value.guest_phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="09XX XXX XXXX" className="form-input mt-2" /></label><div className="mt-2 flex flex-wrap items-center gap-2">{phoneVerified ? <span className="rounded-full bg-[#DCFCE7] px-3 py-1.5 text-xs font-bold text-[#166534]">Mobile number verified</span> : <button type="button" onClick={onSendCode} disabled={otpBusy || isSaving} className="rounded-xl border border-[#B94B86]/30 px-3 py-2 text-xs font-bold text-[#A83F78] disabled:opacity-50">{otpBusy && !otpSent ? "Sending code..." : otpSent ? "Resend code" : "Text me a verification code"}</button>}</div>{otpSent && !phoneVerified && <div className="mt-3 flex gap-2"><input aria-label="SMS verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otpCode} onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="form-input" /><button type="button" onClick={onVerifyCode} disabled={otpBusy || otpCode.length !== 6} className="shrink-0 rounded-xl bg-[#1F2937] px-4 text-xs font-bold text-white disabled:opacity-50">{otpBusy ? "Checking..." : "Verify"}</button></div>}<p className="mt-2 text-xs leading-5 text-[#667085]">We'll text this number a receipt and booking policy. Verify it first so we know it's correct.</p></div>
        <label className="block text-sm font-bold text-[#344054]">Email address<input required type="email" autoComplete="email" maxLength={255} value={value.guest_email} onChange={(event) => onChange((current) => ({ ...current, guest_email: event.target.value }))} placeholder="you@example.com" className="form-input mt-2" /></label>
      </div>
      <button type="submit" disabled={isSaving || !phoneVerified} className="mt-6 min-h-12 w-full rounded-xl bg-[#B94B86] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#A83F78] disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Sending request..." : "Send appointment request"}</button>
      <p className="mt-3 text-center text-xs text-[#98A2B3]">No account or registration required.</p>
    </form>
  </div>;
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
  if (!date) {
    return <div className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-[#DDB8CB] bg-[#FFFAFC] px-5 py-6 text-center"><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#FCE7F3]"><HiOutlineCalendarDays className="h-5 w-5 text-[#B94B86]" /></span><p className="mt-2 text-sm font-bold text-[#475467]">Choose a date first</p><p className="mt-1 text-xs text-[#98A2B3]">Available appointment times will appear here.</p></div></div>;
  }

  if (loading) {
    return <div className="grid min-h-28 place-items-center rounded-2xl border border-[#F0E3EA] bg-[#FFFAFC] text-sm font-bold text-[#667085]">Checking live availability...</div>;
  }

  if (!slots.some((slot) => slot.available)) {
    return <div className="rounded-2xl border border-[#F0E3EA] bg-[#FFFAFC] px-5 py-6 text-center"><p className="text-sm font-bold text-[#475467]">No times available for this date</p><p className="mt-1 text-xs text-[#98A2B3]">Please choose another day.</p></div>;
  }

  return <div aria-label="Available appointment times" className="space-y-4 rounded-2xl border border-[#F0E3EA] bg-white p-4 sm:p-5">
    {TIME_PERIODS.map((period) => {
      const periodSlots = slots.filter((slot) => slot.period === period.value);
      if (!periodSlots.length) return null;
      return <section key={period.value}>
        <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-[#344054]">{period.label}</h3><span className="text-xs text-[#98A2B3]">{period.range}</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {periodSlots.map((slot) => {
            const selected = value === slot.value;
            return <button key={slot.value} type="button" disabled={!slot.available} aria-pressed={selected} onClick={() => onChange(slot.value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#B94B86]/15 ${selected ? "border-[#B94B86] bg-[#B94B86] text-white shadow-sm" : slot.available ? "border-[#E8C9D9] bg-[#FFFAFC] text-[#754463] hover:border-[#B94B86] hover:bg-[#FCE7F3]" : "cursor-not-allowed border-[#EEE7EB] bg-[#F7F5F6] text-[#B4ADB2] line-through"}`}>
              {slot.label}{!slot.available && <span className="ml-1 text-[10px] font-medium no-underline">{slot.is_full ? "Full" : "Unavailable"}</span>}
            </button>;
          })}
        </div>
      </section>;
    })}
    {value && <p className="rounded-xl bg-[#ECFDF3] px-3 py-2 text-center text-xs font-bold text-[#166534]">Selected time: {slots.find((slot) => slot.value === value)?.label || value}</p>}
  </div>;
}
function SummaryRow({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 py-3"><Icon className="h-5 w-5 shrink-0 text-[#B94B86]" /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="truncate text-sm font-bold text-[#344054]">{value}</p></div></div>;
}
