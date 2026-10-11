import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import PasswordStrength from "../../components/auth/PasswordStrength";
import authService from "../../services/authService";

// ── Eye toggle icon ───────────────────────────────────────────
function EyeIcon({ show, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 transition-colors"
      aria-label={label}
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

// ── Main Register Page ─────────────────────────────────────────
export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone_number: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors]           = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [notification, setNotification] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [signupVerificationToken, setSignupVerificationToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  // ── Validation ──────────────────────────────────────────────
  const validate = () => {
    const e = {};

    if (!form.fullName.trim())
      e.fullName = "Full name is required.";

    if (!form.email.trim())
      e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";

    if (!form.phone_number.trim()) {
      e.phone_number = "Phone number is required for SMS verification.";
    } else {
      const cleaned = form.phone_number.replace(/\s|-/g, "");
      const validPH =
        (cleaned.startsWith("09") && cleaned.length === 11) ||
        (cleaned.startsWith("+639") && cleaned.length === 13) ||
        (cleaned.startsWith("639") && cleaned.length === 12);
      if (!validPH)
        e.phone_number = "Enter a valid PH mobile number (e.g. 09171234567).";
    }

    return e;
  };

  const validatePassword = () => {
    const e = {};
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSendCode = async () => {
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setOtpLoading(true);
    setNotification(null);
    try {
      await authService.startSignup(form.fullName, form.email, form.phone_number);

      setOtpSent(true);
      setOtpCode("");
      setResendCooldown(60);
      setNotification({ type: "success", message: `A verification code was sent to ${form.phone_number}.` });
    } catch (err) {
      setNotification({
        type: "error",
        message: err.message || "Registration failed. Please try again.",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phoneVerified || !signupVerificationToken) {
      setNotification({ type: "error", message: "Verify your phone number before signing up." });
      return;
    }
    const errs = validatePassword();
    if (Object.keys(errs).length) {
      setErrors((current) => ({ ...current, ...errs }));
      return;
    }
    setOtpLoading(true);
    setNotification(null);
    try {
      await authService.completeSignup(signupVerificationToken, form.password);
      setNotification({ type: "success", message: "Your account was created. You can now sign in." });
      setTimeout(() => { window.location.assign("/login"); }, 1200);
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Could not finish creating your account." });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      setNotification({ type: "error", message: "Enter the 6-digit verification code." });
      return;
    }
    setOtpLoading(true);
    setNotification(null);
    try {
      const response = await authService.verifySignupPhone(form.email, otpCode);
      setSignupVerificationToken(response.verification_token);
      setPhoneVerified(true);
      setNotification({ type: "success", message: "Phone number verified. Now create your password." });
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Invalid or expired verification code." });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || otpLoading) return;
    setOtpLoading(true);
    setNotification(null);
    try {
      await authService.resendVerification(form.email);
      setOtpCode("");
      setResendCooldown(60);
      setNotification({ type: "success", message: `A new code was sent to ${form.phone_number}.` });
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Could not resend the code." });
    } finally {
      setOtpLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 focus:shadow-[0_0_0_4px_rgba(232,84,152,0.12)] ${
      errors[field]
        ? "border-red-400 focus:ring-red-200"
        : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
    }`;

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
      <div className="mb-6">
        <h2
          className="text-2xl sm:text-3xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}
        >
          Create Account
        </h2>
        <p
          className="text-sm"
          style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
        >
          Book appointments online in seconds.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
        animate={shakeIfError ? { x: [0, -6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
      >

        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={form.fullName}
            onChange={handleChange}
            disabled={otpSent}
            placeholder="Jane Dela Cruz"
            className={`${inputClass("fullName")} disabled:bg-pink-50 disabled:text-gray-500`}
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-500" role="alert">{errors.fullName}</p>
          )}
        </div>

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
            value={form.email}
            onChange={handleChange}
            disabled={otpSent}
            placeholder="you@example.com"
            className={`${inputClass("email")} disabled:bg-pink-50 disabled:text-gray-500`}
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500" role="alert">{errors.email}</p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <label
            htmlFor="phone_number"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Phone Number
          </label>
          <div className="relative">
            <input
              id="phone_number"
              name="phone_number"
              type="tel"
              autoComplete="tel"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="09171234567"
              disabled={otpSent}
              className={`${inputClass("phone_number")} pr-28 disabled:bg-pink-50 disabled:text-gray-500`}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
            {!otpSent && (
              <button
                type="button"
                onClick={handleSendCode}
                disabled={otpLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)" }}
              >
                {otpLoading ? "Sending…" : "Send code"}
              </button>
            )}
          </div>
          {errors.phone_number && (
            <p className="mt-1 text-xs text-red-500" role="alert">{errors.phone_number}</p>
          )}
          {otpSent && !phoneVerified && (
            <div className="mt-3 space-y-2">
              <label htmlFor="signup-otp" className="block text-sm font-medium" style={{ color: "#2D2D2D" }}>
                Verification code
              </label>
              <input
                id="signup-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                className={`${inputClass("otpCode")} text-center tracking-[0.35em] font-semibold`}
                aria-label="SMS verification code"
                required
              />
              <button
                type="button"
                onClick={handleResendCode}
                disabled={otpLoading || resendCooldown > 0}
                className="text-sm font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: "#C2185B" }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
              <Button type="button" onClick={handleVerifyOtp} loading={otpLoading} fullWidth>
                Verify Phone Number
              </Button>
            </div>
          )}
          {phoneVerified && (
            <p className="mt-3 text-sm font-semibold text-green-700" role="status">
              Phone number verified
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
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              disabled={!phoneVerified}
              placeholder="Min. 8 characters"
              className={`${inputClass("password")} pr-12 disabled:bg-pink-50 disabled:text-gray-500`}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
            <EyeIcon
              show={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              label={showPassword ? "Hide password" : "Show password"}
            />
          </div>
          <PasswordStrength password={form.password} />
          {errors.password && (
            <p className="mt-1 text-xs text-red-500" role="alert">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-1"
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={!phoneVerified}
              placeholder="Re-enter password"
              className={`${inputClass("confirmPassword")} pr-12 disabled:bg-pink-50 disabled:text-gray-500`}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
            <EyeIcon
              show={showConfirm}
              onClick={() => setShowConfirm((v) => !v)}
              label={showConfirm ? "Hide" : "Show"}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500" role="alert">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {!phoneVerified && (
          <p className="text-xs" style={{ color: "#8B7282" }}>
            Verify your phone number to enable password entry and sign up.
          </p>
        )}
        <motion.div whileHover={{ scale: otpLoading || !phoneVerified ? 1 : 1.01 }} whileTap={{ scale: otpLoading || !phoneVerified ? 1 : 0.98 }}>
          <Button type="submit" loading={otpLoading} disabled={!phoneVerified} fullWidth>Sign Up</Button>
        </motion.div>
      </motion.form>

      <p
        className="mt-6 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold hover:underline"
          style={{ color: "#C2185B" }}
        >
          Sign In
        </Link>
      </p>
    </AuthLayout>
  );
}
