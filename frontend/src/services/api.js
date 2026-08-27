import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const REMEMBER_SESSION_KEY = "auth_remember";
const LEGACY_ACCESS_TOKEN_KEY = "accessToken";

let refreshRequest = null;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

function isRememberedSession() {
  return localStorage.getItem(REMEMBER_SESSION_KEY) === "true";
}

function getStoredToken(key) {
  const sessionToken = sessionStorage.getItem(key);
  const localToken = isRememberedSession() ? localStorage.getItem(key) : null;
  if (sessionToken || localToken || key !== ACCESS_TOKEN_KEY) return sessionToken || localToken;

  return sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
}

function tokenExpiresSoon(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return !decoded.exp || decoded.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

function clearStoredSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

async function refreshAccessToken() {
  const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error("Your session has expired.");

  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        const storage = isRememberedSession() ? localStorage : sessionStorage;
        storage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        return data.access_token;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

api.interceptors.request.use(async (config) => {
  let token = getStoredToken(ACCESS_TOKEN_KEY);
  if (token && tokenExpiresSoon(token)) {
    token = await refreshAccessToken();
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRequest = originalRequest?.url?.startsWith("/auth/");

    if (error.response?.status !== 401 || isAuthRequest || originalRequest?._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredSession();
      if (window.location.pathname !== "/") window.location.assign("/");
      return Promise.reject(refreshError);
    }
  }
);

export default api;
