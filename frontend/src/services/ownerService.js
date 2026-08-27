import api from "./api";

const ownerService = {
  dashboard: async () => {
    const response = await api.get("/owner/dashboard");
    return response.data;
  },

  dashboardPerformance: async (period = "weekly") => {
    const response = await api.get("/owner/dashboard/performance", { params: { period } });
    return response.data;
  },

  branches: async () => {
    const response = await api.get("/owner/branches");
    return response.data;
  },

  createBranch: async (payload) => {
    const response = await api.post("/owner/branches", payload);
    return response.data;
  },

  updateBranch: async (branchId, payload) => {
    const response = await api.patch(`/owner/branches/${branchId}`, payload);
    return response.data;
  },

  users: async (params = {}) => {
    const response = await api.get("/owner/users", { params });
    return response.data;
  },

  createUser: async (payload) => {
    const response = await api.post("/owner/users", payload);
    return response.data;
  },

  updateUser: async (userId, payload) => {
    const response = await api.patch(`/owner/users/${userId}`, payload);
    return response.data;
  },

  bookings: async ({ page = 1, page_size = 100, branch_id = null, status_filter = null } = {}) => {
    const params = { page, page_size };
    if (branch_id) params.branch_id = branch_id;
    if (status_filter) params.status_filter = status_filter;
    const response = await api.get("/owner/bookings", { params });
    return response.data;
  },

  transactions: async ({ page = 1, page_size = 100, branch_id = null } = {}) => {
    const params = { page, page_size };
    if (branch_id) params.branch_id = branch_id;
    const response = await api.get("/owner/transactions", { params });
    return response.data;
  },

  reports: async ({ period = "weekly", start_date = null, end_date = null, branch_id = null } = {}) => {
    const params = { period };
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (branch_id) params.branch_id = branch_id;
    const response = await api.get("/owner/reports", { params });
    return response.data;
  },

  forecasting: async () => {
    const response = await api.get("/owner/forecasting");
    return response.data;
  },

  workforce: async () => {
    const response = await api.get("/owner/workforce");
    return response.data;
  },

  auditLogs: async () => {
    const response = await api.get("/owner/audit-logs");
    return response.data;
  },
};

export default ownerService;
