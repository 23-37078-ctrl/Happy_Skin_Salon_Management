import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import Divider from "../../components/auth/Divider";
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

  // Google's login button renders inside a cross-origin iframe, so it can only be
  // sized with a fixed pixel `width` prop — never %. We measure the actual space
  // available in the card on every resize and feed that number in, so it never
  // overflows or gets squished on narrow phones, and always matches the width of
  // the Facebook button sitting right below it.
  const socialRef = useRef(null);
  const [socialWidth, setSocialWidth] = useState(320);

  useEffect(() => {
    const el = socialRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setSocialWidth(Math.floor(Math.min(Math.max(w, 220), 400)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      { scope: "email, public_profile" }
    );
  };

  const shakeIfError = Object.keys(errors).some((k) => errors[k]);

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
      <div className="mb-5 sm:mb-8">
        <h2
          className="text-2xl sm:text-3xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}
        >
          Welcome Back <span aria-hidden="true">✨</span>
        </h2>
        <p className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
          Ready for your next beauty session?
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-3.5 sm:space-y-5"
        animate={shakeIfError ? { x: [0, -6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Email Address
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
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
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 focus:shadow-[0_0_0_4px_rgba(232,84,152,0.12)] ${
                errors.email
                  ? "border-red-400 focus:ring-red-200 animate-[shake_0.4s]"
                  : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
              }`}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
          </div>
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
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" /></svg>
            </span>
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
              className={`w-full pl-11 pr-12 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 focus:shadow-[0_0_0_4px_rgba(232,84,152,0.12)] ${
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
            style={{ fontFamily: "'Poppins', sans-serif", color: "#C2185B" }}
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit */}
        <motion.div whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.98 }}>
          <Button type="submit" loading={loading} fullWidth>
            Sign In
          </Button>
        </motion.div>
      </motion.form>

      <Divider />

      {/* Social logins — width is measured live so both buttons match the real
          card width on every device, instead of a hardcoded 320px guess. */}
      <div ref={socialRef} className="space-y-2.5 sm:space-y-3 w-full">
        <div
          className="w-full flex justify-center overflow-hidden rounded-full"
          style={{
            height: 48,
            opacity: socialLoading ? 0.6 : 1,
            pointerEvents: socialLoading ? "none" : "auto",
          }}
        >
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() =>
              setNotification({ type: "error", message: "Google sign-in failed." })
            }
            width={String(socialWidth)}
            shape="pill"
            size="large"
          />
        </div>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleFacebookLogin}
          disabled={socialLoading}
          className="relative w-full h-12 flex items-center justify-center rounded-full bg-white transition-all disabled:opacity-60 hover:bg-gray-50"
          style={{
            border: "1px solid #DADCE0",
            boxShadow: "0 1px 2px 0 rgba(60,64,67,0.30)",
          }}
        >
          <span className="absolute left-4 inset-y-0 flex items-center">
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.128 22 16.991 22 12z"/>
            </svg>
          </span>
          <span
            className="text-[15px] font-normal tracking-normal"
            style={{ fontFamily: "Roboto, arial, sans-serif", color: "#3C4043" }}
          >
            Continue with Facebook
          </span>
        </motion.button>
      </div>

      {/* Footer */}
      <p
        className="mt-4 sm:mt-6 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Don't have an account?{" "}
        <Link
          to="/register"
          className="font-semibold hover:underline"
          style={{ color: "#C2185B" }}
        >
          Create Account
        </Link>
      </p>
    </AuthLayout>
  );
}