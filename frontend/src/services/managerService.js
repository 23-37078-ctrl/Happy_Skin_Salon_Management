import api from "./api";

const managerService = {
  dashboard: async () => {
    const response = await api.get("/manager/dashboard");
    return response.data;
  },

  bookings: async ({ page = 1, page_size = 100, status_filter = null } = {}) => {
    const params = { page, page_size };
    if (status_filter) params.status_filter = status_filter;
    const response = await api.get("/manager/bookings", { params });
    return response.data;
  },

  updateBookingStatus: async (bookingId, status) => {
    const response = await api.patch(`/manager/bookings/${bookingId}/status`, { status });
    return response.data;
  },

  rescheduleBooking: async (bookingId, appointment_date) => {
    const response = await api.patch(`/manager/bookings/${bookingId}/reschedule`, { appointment_date });
    return response.data;
  },

  transactions: async ({ page = 1, page_size = 100 } = {}) => {
    const response = await api.get("/manager/transactions", { params: { page, page_size } });
    return response.data;
  },

  inventory: async () => {
    const response = await api.get("/manager/inventory");
    return response.data;
  },

  reports: async ({ period = "daily", start_date = null, end_date = null } = {}) => {
    const params = { period };
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    const response = await api.get("/manager/reports", { params });
    return response.data;
  },

  forecasting: async () => {
    const response = await api.get("/manager/forecasting");
    return response.data;
  },

  feedback: async () => {
    const response = await api.get("/manager/feedback");
    return response.data;
  },

  profile: async () => {
    const response = await api.get("/manager/profile");
    return response.data;
  },

  updateProfile: async ({ full_name, phone_number }) => {
    const response = await api.patch("/manager/profile", { full_name, phone_number });
    return response.data;
  },

  updatePassword: async ({ current_password, new_password }) => {
    const response = await api.patch("/manager/profile/password", { current_password, new_password });
    return response.data;
  },
};

export default managerService;
