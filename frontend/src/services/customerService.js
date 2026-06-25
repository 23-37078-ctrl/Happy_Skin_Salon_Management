import axios from "axios";

/**
 * Axios instance scoped to the customer-facing API.
 * Attaches the JWT from localStorage to every request and
 * centralizes the base URL so it only needs to change in one place.
 */
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000/api/v1",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const remembered = localStorage.getItem("auth_remember") === "true";
  const token =
    sessionStorage.getItem("access_token") ||
    (remembered ? localStorage.getItem("access_token") : null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized 401 handling: if the session has expired, clear it and
// send the customer back to login rather than letting requests fail silently.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("auth_remember");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

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

export async function getCustomerServices(signal) {
  const { data } = await api.get("/customer/services", { signal });
  return data;
}

export async function createAppointment(payload) {
  const { data } = await api.post("/customer/appointments", payload);
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
