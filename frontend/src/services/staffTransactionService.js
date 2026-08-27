import api from "./api";

export const staffTransactionService = {
  list: async ({ page = 1, page_size = 20 } = {}) => {
    const response = await api.get("/staff/transactions", {
      params: { page, page_size },
    });
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/staff/transactions", payload);
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
    const response = await api.post("/staff/transactions/pos/walk-in", payload);
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

  confirmOnlineBooking: async (bookingId, serviceProviderId, serviceProviderIds = {}) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/confirm`, { service_provider_id: Number(serviceProviderId), service_provider_ids: Object.fromEntries(Object.entries(serviceProviderIds).map(([key, value]) => [Number(key), Number(value)])) });
    return response.data;
  },

  markOnlineTreatmentDone: async (bookingId) => {
    const response = await api.patch(`/staff/transactions/online-bookings/${bookingId}/treatment-done`);
    return response.data;
  },

  dayEndSummary: async (reportDate) => {
    const response = await api.get("/staff/transactions/day-end/summary", { params: { report_date: reportDate } });
    return response.data;
  },

  closeDay: async (reportDate) => {
    const response = await api.post("/staff/transactions/day-end/close", null, { params: { report_date: reportDate } });
    return response.data;
  },
};

export default staffTransactionService;
