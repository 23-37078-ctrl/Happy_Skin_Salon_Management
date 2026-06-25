import api from "./api";

export const staffBookingService = {
  list: async ({ page = 1, page_size = 20, status_filter = null } = {}) => {
    const params = { page, page_size };
    if (status_filter) params.status_filter = status_filter;

    const response = await api.get("/staff/bookings", { params });
    return response.data;
  },

  getById: async (bookingId) => {
    const response = await api.get(`/staff/bookings/${bookingId}`);
    return response.data;
  },

  updateStatus: async (bookingId, status) => {
    const response = await api.patch(`/staff/bookings/${bookingId}/status`, {
      status,
    });
    return response.data;
  },
};

export default staffBookingService;