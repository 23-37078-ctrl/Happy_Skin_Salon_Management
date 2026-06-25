import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import authService from "../../services/authService"; // adjust if your import differs

const RESEND_COOLDOWN = 60;
const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const email = state?.email || "";

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  // Redirect away if no email in state
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email, navigate]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  const handleDigitChange = (index, value) => {
    // Allow only digits
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    // Auto-advance
    if (cleaned && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setNotification({ type: "error", message: "Please enter the complete 6-digit code." });
      return;
    }
    setLoading(true);
    setNotification(null);
    try {
      await authService.verifyEmail(email, code);
      setNotification({ type: "success", message: "Email verified! Redirecting to login…" });
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Invalid or expired code. Please try again." });
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setNotification(null);
    try {
      await authService.resendVerification(email);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN);
      setNotification({ type: "success", message: "A new code has been sent to your email." });
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Could not resend code. Please try again." });
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(b.length, 3)) + c)
    : "";

  return (
    <AuthLayout>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Icon */}
      <div className="flex justify-center mb-5">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #FADADD 0%, #F5A7C7 100%)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#C85B95" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Heading */}
      <div className="mb-6 text-center">
        <h2
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}
        >
          Check Your Email
        </h2>
        <p className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
          We sent a 6-digit verification code to
        </p>
        <p
          className="text-sm font-semibold mt-0.5"
          style={{ fontFamily: "'Poppins', sans-serif", color: "#C85B95" }}
        >
          {maskedEmail}
        </p>
      </div>

      {/* OTP Inputs */}
      <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 focus:ring-2"
            style={{
              fontFamily: "'Poppins', sans-serif",
              color: "#2D2D2D",
              height: "3.25rem",
              borderColor: d ? "#C85B95" : "#F5A7C7",
              boxShadow: d ? "0 0 0 3px #FADADD" : "none",
              background: d ? "#FFF5F8" : "#fff",
            }}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {/* Verify Button */}
      <Button
        type="button"
        onClick={handleVerify}
        loading={loading}
        fullWidth
        disabled={digits.join("").length < CODE_LENGTH || loading}
      >
        Verify Email
      </Button>

      {/* Resend */}
      <div
        className="mt-5 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Didn't receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="font-semibold transition-colors"
          style={{
            color: cooldown > 0 ? "#D4A0BF" : "#C85B95",
            cursor: cooldown > 0 ? "not-allowed" : "pointer",
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
        </button>
      </div>

      {/* Back to register */}
      <div
        className="mt-3 text-center text-sm"
        style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}
      >
        Wrong email?{" "}
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="font-semibold hover:underline"
          style={{ color: "#C85B95" }}
        >
          Go back
        </button>
      </div>
    </AuthLayout>
  );
}