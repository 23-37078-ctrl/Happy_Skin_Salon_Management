import api from "./api";

export const staffTransactionService = {
  list: async ({ page = 1, page_size = 20 } = {}) => {
    const response = await api.get("/staff/transactions", {
      params: { page, page_size },
    });
    return response.data;
  },

  create: async ({ booking_id, amount = null, payment_method = "cash" }) => {
    const payload = { booking_id, payment_method };
    if (amount !== null) payload.amount = amount;

    const response = await api.post("/staff/transactions", payload);
    return response.data;
  },
};

export default staffTransactionService;