import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import authService from "../../services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const requestCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setNotification(null);
    try {
      await authService.requestPasswordReset(email.trim());
      setStep("reset");
      setNotification({ type: "success", message: "If an active account uses this email, a reset code has been sent." });
    } catch (error) {
      setNotification({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setNotification({ type: "error", message: "Enter the 6-digit reset code." });
      return;
    }
    if (password.length < 8) {
      setNotification({ type: "error", message: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setNotification({ type: "error", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    setNotification(null);
    try {
      const response = await authService.confirmPasswordReset(email.trim(), code, password);
      setStep("done");
      setNotification({ type: "success", message: response.message });
    } catch (error) {
      setNotification({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm text-[#2D2D2D] outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200";

  return (
    <AuthLayout>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="mb-6">
        <h2 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}>
          {step === "request" ? "Forgot Password?" : step === "reset" ? "Reset Password" : "Password Updated"}
        </h2>
        <p className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
          {step === "request"
            ? "Enter your account email and we’ll send you a reset code."
            : step === "reset"
              ? `Enter the code sent to ${email} and choose a new password.`
              : "Your password has been changed. You can sign in with your new password."}
        </p>
      </div>

      {step === "request" && (
        <motion.form onSubmit={requestCode} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1 block text-sm font-medium" style={{ color: "#2D2D2D" }}>Email Address</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          <Button type="submit" loading={loading} fullWidth>Send Reset Code</Button>
        </motion.form>
      )}

      {step === "reset" && (
        <motion.form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label htmlFor="reset-code" className="mb-1 block text-sm font-medium" style={{ color: "#2D2D2D" }}>6-Digit Reset Code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter code"
              className={`${inputClass} text-center tracking-[0.35em] font-semibold`}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium" style={{ color: "#2D2D2D" }}>New Password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium" style={{ color: "#2D2D2D" }}>Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              className={inputClass}
            />
          </div>
          <Button type="submit" loading={loading} fullWidth>Update Password</Button>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                await authService.requestPasswordReset(email.trim());
                setNotification({ type: "success", message: "If an active account uses this email, a reset code has been sent." });
              } catch (error) {
                setNotification({ type: "error", message: error.message });
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full text-sm font-semibold hover:underline disabled:opacity-60"
            style={{ color: "#C2185B" }}
          >Resend reset code</button>
        </motion.form>
      )}

      {step === "done" && <Button type="button" onClick={() => { window.location.href = "/login"; }} fullWidth>Back to Sign In</Button>}

      <p className="mt-6 text-center text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
        Remember your password? <Link to="/login" className="font-semibold hover:underline" style={{ color: "#C2185B" }}>Sign In</Link>
      </p>
    </AuthLayout>
  );
}
