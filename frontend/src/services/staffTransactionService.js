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
};

export default staffTransactionService;
