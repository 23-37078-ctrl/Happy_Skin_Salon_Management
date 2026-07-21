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

  accuracy: async () => {
    const response = await api.get("/forecast/accuracy");
    return response.data;
  },

  train: async () => {
    const response = await api.post("/forecast/train");
    return response.data;
  },
};

export default forecastService;
