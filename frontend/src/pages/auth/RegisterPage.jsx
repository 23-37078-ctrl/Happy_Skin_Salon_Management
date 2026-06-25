import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout";
import Button from "../../components/common/Button";
import Notification from "../../components/common/Notification";
import { useAuth } from "../../hooks/useAuth";

function EyeIcon({ show, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 transition-colors" aria-label={label}>
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      )}
    </button>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    try {
      await register(form.fullName, form.email, form.password);
      // Navigate to verify-email, passing email via state
      navigate("/verify-email", { state: { email: form.email } });
    } catch (err) {
      setNotification({ type: "error", message: err.message || "Registration failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2 ${
      errors[field] ? "border-red-400 focus:ring-red-200" : "border-pink-200 focus:ring-pink-200 focus:border-pink-400"
    }`;

  return (
    <AuthLayout>
      {notification && <Notification type={notification.type} message={notification.message} onClose={() => setNotification(null)} />}

      <div className="mb-7">
        <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#2D2D2D" }}>Create Account</h2>
        <p className="text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>Create your customer account to book appointments online.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}>Full Name</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" value={form.fullName} onChange={handleChange} placeholder="Jane Doe" className={inputClass("fullName")} style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }} />
          {errors.fullName && <p className="mt-1 text-xs text-red-500" role="alert">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}>Email Address</label>
          <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className={inputClass("email")} style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }} />
          {errors.email && <p className="mt-1 text-xs text-red-500" role="alert">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}>Password</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={handleChange} placeholder="Min. 8 characters" className={inputClass("password") + " pr-12"} style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }} />
            <EyeIcon show={showPassword} onClick={() => setShowPassword(v => !v)} label={showPassword ? "Hide password" : "Show password"} />
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500" role="alert">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1" style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }}>Confirm Password</label>
          <div className="relative">
            <input id="confirmPassword" name="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" className={inputClass("confirmPassword") + " pr-12"} style={{ fontFamily: "'Poppins', sans-serif", color: "#2D2D2D" }} />
            <EyeIcon show={showConfirm} onClick={() => setShowConfirm(v => !v)} label={showConfirm ? "Hide" : "Show"} />
          </div>
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500" role="alert">{errors.confirmPassword}</p>}
        </div>

        <Button type="submit" loading={loading} fullWidth>Create Account</Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ fontFamily: "'Poppins', sans-serif", color: "#6B3F5D" }}>
        Already have an account?{" "}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: "#C85B95" }}>Sign In</Link>
      </p>
    </AuthLayout>
  );
}
