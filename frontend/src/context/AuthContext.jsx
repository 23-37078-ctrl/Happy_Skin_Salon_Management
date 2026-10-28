import { createContext, useCallback, useEffect, useState } from "react";
import authService from "../services/authService";
import { getCustomerProfile } from "../services/customerService";

const AuthContext = createContext(null);
const VALID_ROLES = new Set(["owner", "manager", "staff", "customer"]);

function decodeTokenPayload(token) {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("Invalid token.");

  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(normalizedPayload));
}

function getValidSessionUser(token) {
  const payload = decodeTokenPayload(token);
  const role = payload.role || payload.user?.role;
  const isExpired = payload.exp ? payload.exp * 1000 <= Date.now() : false;

  if (isExpired || !VALID_ROLES.has(role)) {
    throw new Error("Invalid session.");
  }

  return { ...payload, role };
}

function restoreSessionUser(token) {
  const tokenUser = getValidSessionUser(token);
  const storedUser = authService.getStoredUser();

  return {
    ...tokenUser,
    ...storedUser,
    role: tokenUser.role,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = authService.getToken();
    if (token) {
      try {
        return restoreSessionUser(token);
      } catch {
        authService.logout();
      }
    }
    return null;
  });
  const loading = false;

  const syncCurrentUser = useCallback(async (profile = null) => {
    const latestProfile = profile || await getCustomerProfile();
    setCurrentUser((current) => {
      if (!current) return current;
      const updatedUser = { ...current, ...latestProfile, role: current.role };
      authService.updateStoredUser(updatedUser);
      return updatedUser;
    });
  }, []);

  useEffect(() => {
    if (currentUser?.role !== "customer") return;
    const refreshProfile = () => {
      if (document.visibilityState === "visible") syncCurrentUser().catch(() => {});
    };
    refreshProfile();
    window.addEventListener("focus", refreshProfile);
    document.addEventListener("visibilitychange", refreshProfile);
    return () => {
      window.removeEventListener("focus", refreshProfile);
      document.removeEventListener("visibilitychange", refreshProfile);
    };
  }, [currentUser?.id, currentUser?.role, syncCurrentUser]);

  const login = async (email, password, remember = false) => {
    const user = await authService.login(email, password, remember);
    if (!VALID_ROLES.has(user?.role)) {
      authService.logout();
      throw new Error("Your account role is not allowed to sign in here.");
    }
    setCurrentUser(user);
    return user;
  };

  const loginWithProvider = async (provider, token, remember = false) => {
    const user = await authService.loginWithProvider(provider, token, remember);
    if (user?.requires_phone) return user;
    if (!VALID_ROLES.has(user?.role)) {
      authService.logout();
      throw new Error("Your account role is not allowed to sign in here.");
    }
    setCurrentUser(user);
    return user;
  };

  const requestSocialPhoneOtp = (provider, token, phoneNumber) =>
    authService.requestSocialPhoneOtp(provider, token, phoneNumber);

  const verifySocialPhone = async (provider, token, phoneNumber, code, remember = false) => {
    const user = await authService.verifySocialPhone(provider, token, phoneNumber, code, remember);
    if (!VALID_ROLES.has(user?.role)) {
      authService.logout();
      throw new Error("Your account role is not allowed to sign in here.");
    }
    setCurrentUser(user);
    return user;
  };

  const register = async (
    fullName,
    email,
    password,
    phone_number = null,
    otp_method = "email"
  ) => {
    // Returns { message, email, otp_method } — no session yet
    return await authService.register(
      fullName,
      email,
      password,
      phone_number,
      otp_method
    );
  };

  const verifyEmail = async (email, code) => {
    return await authService.verifyEmail(email, code);
  };

  const resendVerification = async (email) => {
    return await authService.resendVerification(email);
  };

  const logout = () => {
    authService.logout();
    // Clear the in-memory session immediately. Delaying this allows protected
    // pages to render again after navigation while their requests are already
    // unauthorized, which produces a misleading dashboard error popup.
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        syncCurrentUser,
        loading,
        isAuthenticated: !!currentUser,
        login,
        loginWithProvider,
        requestSocialPhoneOtp,
        verifySocialPhone,
        register,
        verifyEmail,
        resendVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
