import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithProvider } = useAuth();

  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.password) e.password = "Password is required.";
    return e;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const redirectByRole = (user) => {
    const roleRoutes = {
      owner: "/owner/dashboard",
      manager: "/manager/dashboard",
      staff: "/staff/dashboard",
      customer: "/customer/dashboard",
    };
    const requestedRedirect = new URLSearchParams(location.search).get("redirect");
    const safeCustomerRedirect =
      user.role === "customer" && requestedRedirect?.startsWith("/customer/")
        ? requestedRedirect
        : null;
    const redirectTo = safeCustomerRedirect || roleRoutes[user.role];
    if (!redirectTo) {
      throw new Error("Your account role is not allowed to sign in here.");
    }
    navigate(redirectTo, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      const user = await login(form.email, form.password, form.remember);
      redirectByRole(user);
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Invalid email or password." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setSocialLoading(true);
    try {
      const user = await loginWithProvider("google", credentialResponse.credential);
      redirectByRole(user);
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Google sign-in failed." });
    } finally {
      setSocialLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB || !window.fbSdkReady) {
      setNotification({ type: "error", message: "Facebook SDK not loaded yet. Try again." });
      return;
    }
    setSocialLoading(true);
    window.FB.login(
      (response) => {
        if (response.authResponse) {
          loginWithProvider("facebook", response.authResponse.accessToken)
            .then(redirectByRole)
            .catch((err) =>
              setNotification({ type: "error", message: err.message || "Facebook sign-in failed." })
            )
            .finally(() => setSocialLoading(false));
        } else {
          setSocialLoading(false);
        }
      },
      { scope: "email,public_profile" }
    );
  };

  return (
    <AuthLayout>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h2
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}
        >
          Welcome Back
        </h2>
        <p className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
          Sign in to continue to your customer account.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-label="Email Address"
            aria-describedby={errors.email ? "email-error" : undefined}
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 ${
              errors.email
                ? "border-red-400 focus:ring-red-200"
                : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
            }`}
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-500" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-label="Password"
              aria-describedby={errors.password ? "password-error" : undefined}
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 ${
                errors.password
                  ? "border-red-400 focus:ring-red-200"
                  : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
              }`}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="mt-1 text-xs text-red-500" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
              className="w-4 h-4 rounded accent-pink-500"
              aria-label="Remember me"
            />
            <span className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
              Remember Me
            </span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium hover:underline transition-colors"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#C85B95" }}
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit */}
        <Button type="submit" loading={loading} fullWidth>
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-pink-100" />
        <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "'Poppins', sans-serif" }}>
          or continue with
        </span>
        <div className="flex-1 h-px bg-pink-100" />
      </div>

      {/* Social logins */}
      <div className="space-y-3">
        <div className="flex justify-center">
          <div style={{ opacity: socialLoading ? 0.6 : 1, pointerEvents: socialLoading ? "none" : "auto" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() =>
                setNotification({ type: "error", message: "Google sign-in failed." })
              }
              width="320"
              shape="pill"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleFacebookLogin}
          disabled={socialLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-pink-200 text-sm font-semibold hover:bg-pink-50 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.128 22 16.991 22 12z"/>
          </svg>
          Continue with Facebook
        </button>
      </div>

      {/* Footer */}
      <p
        className="mt-6 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Don't have an account?{" "}
        <Link
          to="/register"
          className="font-semibold hover:underline"
          style={{ color: "#C85B95" }}
        >
          Create Account
        </Link>
      </p>
    </AuthLayout>
  );
}