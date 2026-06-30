import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import { useAuth } from "../../hooks/useAuth";

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

// ── OTP Method Toggle ─────────────────────────────────────────
function OTPMethodToggle({ value, onChange }) {
  return (
    <div>
      <p
        className="block text-sm font-medium mb-2"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
      >
        Verification Method
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Email option */}
        <button
          type="button"
          onClick={() => onChange("email")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
            value === "email"
              ? "border-[#C85B95] bg-pink-50 text-[#C85B95]"
              : "border-pink-100 bg-white text-[#6B7280] hover:border-pink-200"
          }`}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email OTP
          {value === "email" && (
            <span className="ml-1 w-4 h-4 rounded-full bg-[#C85B95] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </button>

        {/* SMS option */}
        <button
          type="button"
          onClick={() => onChange("sms")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
            value === "sms"
              ? "border-[#C85B95] bg-pink-50 text-[#C85B95]"
              : "border-pink-100 bg-white text-[#6B7280] hover:border-pink-200"
          }`}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          SMS OTP
          {value === "sms" && (
            <span className="ml-1 w-4 h-4 rounded-full bg-[#C85B95] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </button>
      </div>

      {/* Helper text under toggle */}
      <p
        className="mt-2 text-xs"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#9CA3AF" }}
      >
        {value === "email"
          ? "📧 A 6-digit code will be sent to your email address."
          : "📱 A 6-digit code will be sent via SMS to your phone number."}
      </p>
    </div>
  );
}

// ── Main Register Page ────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone_number: "",
    password: "",
    confirmPassword: "",
    otp_method: "email",   // default is email
  });
  const [errors, setErrors]           = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [notification, setNotification] = useState(null);

  // ── Validation ──────────────────────────────────────────────
  const validate = () => {
    const e = {};

    if (!form.fullName.trim())
      e.fullName = "Full name is required.";

    if (!form.email.trim())
      e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";

    // Phone is required ONLY when SMS is selected
    if (form.otp_method === "sms") {
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
    }

    if (!form.password)
      e.password = "Password is required.";
    else if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";

    if (!form.confirmPassword)
      e.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";

    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleMethodChange = (method) => {
    setForm((p) => ({ ...p, otp_method: method, phone_number: "" }));
    setErrors((p) => ({ ...p, phone_number: "" }));
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      const result = await register(
        form.fullName,
        form.email,
        form.password,
        form.otp_method === "sms" ? form.phone_number : null,
        form.otp_method,
      );

      // Pass all needed info to the verify page
      navigate("/verify-email", {
        state: {
          email: form.email,
          otp_method: result.otp_method || form.otp_method,
          phone_number: form.phone_number || null,
        },
      });
    } catch (err) {
      setNotification({
        type: "error",
        message: err.message || "Registration failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 ${
      errors[field]
        ? "border-red-400 focus:ring-red-200"
        : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
    }`;

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
          className="text-3xl font-bold mb-1"
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

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

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
            placeholder="Jane Dela Cruz"
            className={inputClass("fullName")}
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
            placeholder="you@example.com"
            className={inputClass("email")}
            style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500" role="alert">{errors.email}</p>
          )}
        </div>

        {/* OTP Method Toggle */}
        <OTPMethodToggle
          value={form.otp_method}
          onChange={handleMethodChange}
        />

        {/* Phone Number — only shown when SMS is selected */}
        {form.otp_method === "sms" && (
          <div
            className="rounded-xl border border-pink-100 bg-pink-50 p-4"
            style={{ animation: "fadeIn 0.2s ease" }}
          >
            <label
              htmlFor="phone_number"
              className="block text-sm font-medium mb-1"
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            >
              Phone Number
            </label>
            <div className="flex gap-2">
              {/* Country code badge */}
              <div
                className="flex items-center px-3 rounded-xl border border-pink-200 bg-white text-sm font-semibold select-none"
                style={{ color: "#6B3F5D", fontFamily: "'Poppins', sans-serif" }}
              >
                🇵🇭 +63
              </div>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                autoComplete="tel"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="09171234567"
                className={`flex-1 px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 ${
                  errors.phone_number
                    ? "border-red-400 focus:ring-red-200"
                    : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
                } bg-white`}
                style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
              />
            </div>
            {errors.phone_number && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {errors.phone_number}
              </p>
            )}
            <p
              className="mt-2 text-xs"
              style={{ color: "#9CA3AF", fontFamily: "'Poppins', sans-serif" }}
            >
              Enter your Philippine mobile number (e.g. 09171234567)
            </p>
          </div>
        )}

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
              placeholder="Min. 8 characters"
              className={inputClass("password") + " pr-12"}
              style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}
            />
            <EyeIcon
              show={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              label={showPassword ? "Hide password" : "Show password"}
            />
          </div>
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
              placeholder="Re-enter password"
              className={inputClass("confirmPassword") + " pr-12"}
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

        <Button type="submit" loading={loading} fullWidth>
          Create Account
        </Button>
      </form>

      <p
        className="mt-6 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold hover:underline"
          style={{ color: "#C85B95" }}
        >
          Sign In
        </Link>
      </p>

      {/* Subtle fade-in animation for the SMS section */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AuthLayout>
  );
}