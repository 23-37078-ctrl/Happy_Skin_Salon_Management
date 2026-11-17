import api from "./api";

const managerService = {
  dashboard: async () => {
    const response = await api.get("/manager/dashboard");
    return response.data;
  },

  dashboardPerformance: async (period = "daily", report_date = null) => {
    const response = await api.get("/manager/dashboard/performance", { params: { period, report_date } });
    return response.data;
  },

  bookings: async ({ page = 1, page_size = 100, status_filter = null } = {}) => {
    const params = { page, page_size };
    if (status_filter) params.status_filter = status_filter;
    const response = await api.get("/manager/bookings", { params });
    return response.data;
  },
  bookingProviders: async () => (await api.get("/manager/booking-providers")).data,

  updateBookingStatus: async (bookingId, status) => {
    const response = await api.patch(`/manager/bookings/${bookingId}/status`, { status });
    return response.data;
  },
  updateGroupServiceStatus: async (bookingId, serviceItemId, status) => {
    const { data } = await api.patch(`/manager/bookings/${bookingId}/service-items/${serviceItemId}/status`, { status });
    return data;
  },
  updateGroupServiceProvider: async (bookingId, serviceItemId, serviceProviderId) => {
    const { data } = await api.patch(`/manager/bookings/${bookingId}/service-items/${serviceItemId}/provider`, { service_provider_id: Number(serviceProviderId) });
    return data;
  },

  rescheduleBooking: async (bookingId, appointment_date) => {
    const response = await api.patch(`/manager/bookings/${bookingId}/reschedule`, { appointment_date });
    return response.data;
  },

  transactions: async ({ page = 1, page_size = 100 } = {}) => {
    const response = await api.get("/manager/transactions", { params: { page, page_size } });
    return response.data;
  },

  reports: async ({ period = "daily", start_date = null, end_date = null, staff_id = null, service_id = null, booking_type = null, appointment_status = null, payment_method = null, transaction_status = null } = {}) => {
    const params = { period };
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (staff_id) params.staff_id = staff_id;
    if (service_id) params.service_id = service_id;
    if (booking_type) params.booking_type = booking_type;
    if (appointment_status) params.appointment_status = appointment_status;
    if (payment_method) params.payment_method = payment_method;
    if (transaction_status) params.transaction_status = transaction_status;
    const response = await api.get("/manager/reports", { params });
    return response.data;
  },

  reportDates: async () => (await api.get("/manager/reports/dates")).data,
  reportFilters: async () => (await api.get("/manager/reports/filters")).data,

  dayReport: async (reportDate) => (await api.get("/manager/reports/day-summary", { params: { report_date: reportDate }, timeout: 10000 })).data,

  forecasting: async () => {
    const response = await api.get("/manager/forecasting");
    return response.data;
  },

  promotions: async () => (await api.get("/manager/promotions")).data,
  createPromotion: async (payload) => (await api.post("/manager/promotions", payload)).data,
  updatePromotion: async (promotionId, payload) => (await api.patch(`/manager/promotions/${promotionId}`, payload)).data,
  deletePromotion: async (promotionId) => api.delete(`/manager/promotions/${promotionId}`),

  feedback: async () => {
    const response = await api.get("/manager/feedback");
    return response.data;
  },

  profile: async () => {
    const response = await api.get("/manager/profile");
    return response.data;
  },
  auditLogs: async () => (await api.get("/manager/audit-logs")).data,
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
