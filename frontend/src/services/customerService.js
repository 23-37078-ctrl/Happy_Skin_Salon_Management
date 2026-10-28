import api from "./api";

/**
 * Fetches the full customer dashboard payload in a single call.
 * Backend contract:
 * {
 *   user, upcoming_booking, recommended_services,
 *   notifications, promotions, favorite_branch, recent_activity
 * }
 *
 * @param {AbortSignal} [signal] - optional AbortController signal so
 * in-flight requests can be cancelled on unmount (avoids stale-state bugs).
 */
export async function getCustomerDashboard(signal) {
  const { data } = await api.get("/customer/dashboard", { signal });
  return data;
}

/** Cancels an upcoming appointment by id. */
export async function cancelAppointment(appointmentId) {
  const { data } = await api.patch(
    `/customer/appointments/${appointmentId}/cancel`
  );
  return data;
}

/** Marks a single notification as read. */
export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(
    `/customer/notifications/${notificationId}/read`
  );
  return data;
}

/** Fetches featured / bookable services for the "Featured Services" rail. */
export async function getFeaturedServices(signal) {
  const { data } = await api.get("/customer/services/featured", { signal });
  return data;
}

export async function getCustomerBranches(signal) {
  const { data } = await api.get("/customer/branches", { signal });
  return data;
}

export async function getPublicDiscovery(signal) {
  const { data } = await api.get("/public/discovery", { signal });
  return data;
}

export async function getCustomerServices(signal) {
  const { data } = await api.get("/customer/services", { signal });
  return data;
}

export async function getBranchProviders(branchId, signal) {
  const { data } = await api.get(`/customer/branches/${branchId}/providers`, { signal });
  return data;
}

export async function getBookingAvailability(branchId, serviceId, bookingDate, signal, serviceIds = []) {
  const { data } = await api.get("/customer/availability", {
    params: { branch_id: branchId, service_id: serviceId, service_ids: serviceIds, booking_date: bookingDate },
    paramsSerializer: { indexes: null },
    signal,
  });
  return data;
}

export async function getGuestBookingAvailability(branchId, serviceId, bookingDate, signal, serviceIds = []) {
  const { data } = await api.get("/customer/guest/availability", {
    params: { branch_id: branchId, service_id: serviceId, service_ids: serviceIds, booking_date: bookingDate },
    paramsSerializer: { indexes: null },
    signal,
  });
  return data;
}

export async function createAppointment(payload) {
  const { data } = await api.post("/customer/appointments", payload);
  return data;
}

export async function createGuestAppointment(payload) {
  const { data } = await api.post("/customer/guest/appointments", payload);
  return data;
}

export async function sendGuestBookingPhoneOtp(payload) {
  const { data } = await api.post("/customer/guest/phone-verification/send", payload);
  return data;
}

export async function verifyGuestBookingPhoneOtp(payload) {
  const { data } = await api.post("/customer/guest/phone-verification/verify", payload);
  return data;
}

export async function getCustomerProfile(signal) {
  const { data } = await api.get("/customer/profile", { signal });
  return data;
}

export async function uploadCustomerProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post("/customer/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function sendCustomerProfilePhoneOtp(payload) {
  const { data } = await api.post("/customer/profile/phone/send-otp", payload);
  return data;
}

export async function verifyCustomerProfilePhoneOtp(payload) {
  const { data } = await api.post("/customer/profile/phone/verify", payload);
  return data;
}

export async function requestCustomerEmailChange(payload) {
  const { data } = await api.post("/customer/profile/change-requests", payload);
  return data;
}

export async function getCustomerProfileChangeRequests(signal) {
  const { data } = await api.get("/customer/profile/change-requests", { signal });
  return data;
}

export async function getCustomerSupportThreads(signal) {
  const { data } = await api.get("/customer/support/threads", { signal });
  return data;
}

export async function createCustomerSupportThread(payload) {
  const { data } = await api.post("/customer/support/threads", payload);
  return data;
}

export async function getCustomerSupportThread(threadId) {
  const { data } = await api.get(`/customer/support/threads/${threadId}`);
  return data;
}

export async function sendCustomerSupportMessage(threadId, body) {
  const { data } = await api.post(`/customer/support/threads/${threadId}/messages`, { body });
  return data;
}

export async function getCustomerAppointments(signal) {
  const { data } = await api.get("/customer/appointments", { signal });
  return data;
}

export async function submitFeedback(payload) {
  const { data } = await api.post("/customer/feedback", payload);
  return data;
}

export default api;
