import api from "./api";

export const staffTransactionService = {
  list: async ({ page = 1, page_size = 20 } = {}) => {
    const response = await api.get("/staff/transactions", {
      params: { page, page_size },
    });
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/staff/transactions", {
      ...payload,
      idempotency_key: payload.idempotency_key || `booking-payment-${payload.booking_id}`,
    });
    return response.data;
  },

  posServices: async () => {
    const response = await api.get("/staff/transactions/pos/services");
    return response.data;
  },

  posContext: async () => {
    const response = await api.get("/staff/transactions/pos/context");
    return response.data;
  },

  posStaff: async () => {
    const response = await api.get("/staff/transactions/pos/staff");
    return response.data;
  },

  checkoutWalkIn: async (payload) => {
    const idempotencyKey = payload.idempotency_key || crypto.randomUUID();
    const response = await api.post("/staff/transactions/pos/walk-in", {
      ...payload,
      idempotency_key: idempotencyKey,
    });
    return response.data;
  },

  walkInBookings: async () => {
    const response = await api.get("/staff/transactions/pos/walk-in/bookings");
    return response.data;
  },

  createWalkInBooking: async (payload) => {
    const response = await api.post("/staff/transactions/pos/walk-in/bookings", payload);
    return response.data;
  },

  markTreatmentDone: async (bookingId) => {
    const response = await api.patch(`/staff/transactions/pos/walk-in/bookings/${bookingId}/treatment-done`);
    return response.data;
  },

  onlineBookings: async () => {
    const response = await api.get("/staff/transactions/online-bookings");
    return response.data;
  },
  cancelledBookings: async () => {
    const response = await api.get("/staff/transactions/cancelled-bookings");
    return response.data;
  },

  confirmOnlineBooking: async (bookingId, serviceProviderId, serviceProviderIds = {}) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/confirm`, { service_provider_id: Number(serviceProviderId), service_provider_ids: Object.fromEntries(Object.entries(serviceProviderIds).map(([key, value]) => [Number(key), Number(value)])) });
    return response.data;
  },

  markOnlineTreatmentDone: async (bookingId) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/treatment-done`);
    return response.data;
  },
  updateGroupServiceStatus: async (bookingId, serviceItemId, status) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/service-items/${serviceItemId}/status`, { status });
    return response.data;
  },
  updateGroupServiceProvider: async (bookingId, serviceItemId, serviceProviderId) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/service-items/${serviceItemId}/provider`, { service_provider_id: Number(serviceProviderId) });
    return response.data;
  },
  checkInOnlineBooking: async (bookingId) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/check-in`);
    return response.data;
  },
  rescheduleOnlineBooking: async (bookingId, appointmentDate) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/reschedule`, { appointment_date: appointmentDate });
    return response.data;
  },
  cancelOnlineBooking: async (bookingId, payload) => {
    const request = typeof payload === "string" ? { reason: payload } : payload;
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/cancel`, request);
    return response.data;
  },

  dayEndSummary: async (reportDate) => {
    const response = await api.get("/staff/transactions/day-end/summary", { params: { report_date: reportDate }, timeout: 10000 });
    return response.data;
  },

  dayEndDates: async () => {
    const response = await api.get("/staff/transactions/day-end/dates");
    return response.data;
  },

  periodReport: async ({ period = "daily", report_date, start_date, end_date, staff_id, service_id, booking_type, appointment_status, payment_method } = {}) => {
    const response = await api.get("/staff/transactions/reports/summary", { params: { period, report_date, start_date, end_date, staff_id, service_id, booking_type, appointment_status, payment_method } });
    return response.data;
  },
  reportFilters: async () => (await api.get("/staff/transactions/reports/filters")).data,

  closeDay: async (reportDate) => {
    const response = await api.post("/staff/transactions/day-end/close", null, { params: { report_date: reportDate } });
    return response.data;
  },
};

export default staffTransactionService;
