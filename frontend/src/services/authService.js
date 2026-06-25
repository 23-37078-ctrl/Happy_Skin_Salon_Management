import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const REMEMBER_SESSION_KEY = "auth_remember";
const AUTH_USER_KEY = "auth_user";
const LEGACY_ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_ROLE_KEY = "role";

function getStoredToken() {
  const remembered = localStorage.getItem(REMEMBER_SESSION_KEY) === "true";
  if (!remembered) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_ROLE_KEY);
  }

  return (
    sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
    (remembered ? localStorage.getItem(ACCESS_TOKEN_KEY) : null)
  );
}

function setStoredToken(token, remember = false) {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, token);
  if (remember) {
    localStorage.setItem(REMEMBER_SESSION_KEY, "true");
  } else {
    localStorage.removeItem(REMEMBER_SESSION_KEY);
  }
}

function getSessionStorage(remember = false) {
  return remember ? localStorage : sessionStorage;
}

function setStoredRefreshToken(token, remember = false) {
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (!token) return;

  const storage = getSessionStorage(remember);
  storage.setItem(REFRESH_TOKEN_KEY, token);
}

function setStoredUser(user, remember = false) {
  sessionStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  getSessionStorage(remember).setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function getStoredUser() {
  const remembered = localStorage.getItem(REMEMBER_SESSION_KEY) === "true";
  const rawUser =
    sessionStorage.getItem(AUTH_USER_KEY) ||
    (remembered ? localStorage.getItem(AUTH_USER_KEY) : null);

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function getStoredRefreshToken() {
  const remembered = localStorage.getItem(REMEMBER_SESSION_KEY) === "true";
  return (
    sessionStorage.getItem(REFRESH_TOKEN_KEY) ||
    (remembered ? localStorage.getItem(REFRESH_TOKEN_KEY) : null)
  );
}

function clearStoredSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_SESSION_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
}

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthRequest = original?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && isAuthRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await authService.refreshToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        authService.logout();
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

const authService = {
  async register(full_name, email, password) {
    try {
      const { data } = await api.post("/auth/register", { full_name, email, password });
      // Returns { message, email } — no token yet (unverified)
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Registration failed.", {
        cause: err,
      });
    }
  },

  async verifyEmail(email, code) {
    try {
      const { data } = await api.post("/auth/verify-email", { email, code });
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Verification failed.", {
        cause: err,
      });
    }
  },

  async resendVerification(email) {
    try {
      const { data } = await api.post("/auth/resend-verification", { email });
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Failed to resend code.", {
        cause: err,
      });
    }
  },

  async login(email, password, remember = false) {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setStoredToken(data.access_token, remember);
      setStoredRefreshToken(data.refresh_token, remember);
      setStoredUser(data.user, remember);
      return data.user;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Login failed.", {
        cause: err,
      });
    }
  },

  async refreshToken() {
    const refresh_token = getStoredRefreshToken();
    if (!refresh_token) throw new Error("No refresh token.");
    const { data } = await api.post("/auth/refresh", { refresh_token });
    setStoredToken(data.access_token, localStorage.getItem(REMEMBER_SESSION_KEY) === "true");
    return data.access_token;
  },

  logout() {
    clearStoredSession();
  },

  getToken() {
    return getStoredToken();
  },

  getStoredUser() {
    return getStoredUser();
  },

  isAuthenticated() {
    return !!getStoredToken();
  },
};

export default authService;
export { api };
