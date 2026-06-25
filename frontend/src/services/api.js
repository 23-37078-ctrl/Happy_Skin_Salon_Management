import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const remembered = localStorage.getItem("auth_remember") === "true";
  const token =
    sessionStorage.getItem("access_token") ||
    (remembered ? localStorage.getItem("access_token") : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
