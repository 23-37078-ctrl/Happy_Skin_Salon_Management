import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FloatingBubbles from "../components/auth/FloatingBubbles";
import AuthIllustration from "../components/auth/AuthIllustration";

export default function AuthLayout({ children }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden flex flex-col lg:flex-row"
      style={{
        background:
          "linear-gradient(135deg, #FFF7FA 0%, #FCE4EC 45%, #F8BBD0 100%)",
      }}
    >
      <FloatingBubbles />

      {/* Back to Home */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/40 backdrop-blur-md text-[#6B3F5D] text-xs sm:text-sm font-medium hover:bg-white/60 transition-all duration-300 hover:-translate-x-1 shadow-sm"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <span aria-hidden="true">←</span> Back to Home
      </button>

      {/* LEFT: Branding + illustration — desktop only, mobile shows the form alone */}
      <div className="hidden lg:flex relative z-10 lg:w-1/2 h-full flex-col items-center justify-center px-6 lg:pt-6 lg:pb-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center text-center"
        >
          <img
            src="/images/happy-skin-logo.svg"
            alt="Happy Skin Nails Spa & Aesthetic"
            className="h-20 w-20 sm:h-24 sm:w-24 lg:h-20 lg:w-20 rounded-full object-cover shadow-xl ring-4 ring-white/70 mb-3"
          />
          <h1
            className="text-2xl sm:text-3xl lg:text-3xl font-bold mb-1 tracking-wide"
            style={{ fontFamily: "'Playfair Display', serif", color: "#6B3F5D" }}
          >
            Happy Skin
          </h1>
          <p
            className="text-[#C2185B]/80 text-xs sm:text-sm tracking-[0.25em] uppercase mb-3"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Nails Spa &amp; Aesthetics
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-px bg-[#C2185B]/30" />
            <span className="text-[#C2185B]/60 text-sm">×</span>
            <div className="w-10 h-px bg-[#C2185B]/30" />
          </div>
          <p
            className="text-2xl sm:text-3xl text-[#C2185B]"
            style={{ fontFamily: "'Great Vibes', cursive" }}
          >
            He &amp; She Salon
          </p>
        </motion.div>

        {/* Illustration — hidden on very small screens to save vertical space, shown from sm up */}
        <div className="hidden sm:block w-full max-w-[280px] lg:max-w-[260px] mt-4 lg:mt-3">
          <AuthIllustration />
        </div>
      </div>

      {/* RIGHT / MOBILE: Glassmorphism auth card */}
      <div className="relative z-10 w-full lg:w-1/2 h-full min-h-0 flex-1 flex items-center justify-center px-4 sm:px-6 pt-16 pb-6 lg:pt-6 lg:pb-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="w-full max-w-[440px] max-h-full overflow-y-auto rounded-3xl p-6 sm:p-8 lg:p-8"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            boxShadow: "0 20px 60px -15px rgba(194, 24, 91, 0.25)",
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}