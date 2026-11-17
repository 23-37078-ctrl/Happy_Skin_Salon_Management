import api from "./api";

const forecastService = {
  branchForecast: async (branchId, horizon = 7) => {
    const response = await api.get(`/forecast/branches/${branchId}`, { params: { horizon } });
    return response.data;
  },

  recommendations: async (branchId) => {
    const response = await api.get(`/forecast/branches/${branchId}/recommendations`);
    return response.data;
  },

  trafficAnalysis: async (branchId, horizonDays = 84) => {
    const response = await api.get(`/forecast/branches/${branchId}/traffic-analysis`, { params: { horizon_days: horizonDays } });
    return response.data;
  },

  accuracy: async () => {
    const response = await api.get("/forecast/accuracy");
    return response.data;
  },

  train: async () => {
    const response = await api.post("/forecast/train");
    return response.data;
  },

  businessHistory: async (days = 1095, branchId = null) => {
    const params = { days };
    if (branchId) params.branch_id = branchId;
    const response = await api.get("/forecast/business-history", { params });
    return response.data;
  },
};

export default forecastService;
