export const SALON_TIME_ZONE = "Asia/Manila";

function parseAppointmentDate(value) {
  const appointmentDate = new Date(value);
  return Number.isNaN(appointmentDate.getTime()) ? null : appointmentDate;
}

export function getAppointmentDateKey(value) {
  const appointmentDate = parseAppointmentDate(value);
  if (!appointmentDate) return "";

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(appointmentDate);
  const partsByType = Object.fromEntries(
    dateParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${partsByType.year}-${partsByType.month}-${partsByType.day}`;
}

export function formatAppointmentDate(value) {
  const appointmentDate = parseAppointmentDate(value);
  if (!appointmentDate) return "Not scheduled";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: SALON_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(appointmentDate);
}

export function formatAppointmentTime(value) {
  const appointmentDate = parseAppointmentDate(value);
  if (!appointmentDate) return "Not scheduled";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: SALON_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(appointmentDate);
}

export function formatAppointmentDateTime(value) {
  const appointmentDate = parseAppointmentDate(value);
  if (!appointmentDate) return "Not scheduled";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: SALON_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(appointmentDate);
}
