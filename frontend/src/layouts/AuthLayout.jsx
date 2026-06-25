import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthLayout({ children }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* LEFT BRANDING SECTION */}
      <div
        className="relative lg:w-[60%] min-h-[340px] lg:min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #f7e4ec 0%, #efbfd2 40%, #ea8fb7 75%, #df5d9f 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
          style={{ background: "#C85B95" }}
        />
        <div
          className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-20"
          style={{ background: "#6B3F5D" }}
        />

        {/* Back to Home */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/50 transition-all duration-300 hover:-translate-x-1 z-10"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <span>←</span> Back to Home
        </button>

        {/* Branding */}
        <div
          className={`flex flex-col items-center text-center px-8 transition-all duration-1000 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Logo Circle */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            style={{
              background: "rgba(255,255,255,0.25)",
              border: "2px solid rgba(255,255,255,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              HS
            </span>
          </div>

          {/* Brand Name */}
          <h1
            className="text-5xl font-bold text-white mb-1 tracking-wide drop-shadow-md"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Happy Skin
          </h1>

          {/* Subtitle */}
          <p
            className="text-white/80 text-base tracking-[0.25em] uppercase mb-5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Nails Spa &amp; Aesthetics
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-px bg-white/50" />
            <span className="text-white/70 text-sm">×</span>
            <div className="w-12 h-px bg-white/50" />
          </div>

          {/* Tagline */}
          <p
            className="text-white text-3xl drop-shadow"
            style={{ fontFamily: "'Great Vibes', cursive" }}
          >
            He &amp; She Salon
          </p>
        </div>
      </div>

      {/* RIGHT AUTH CARD SECTION */}
      <div
        className="lg:w-[40%] flex items-center justify-center p-6 lg:p-10"
        style={{ background: "#F8E5EE" }}
      >
        <div
          className={`w-full max-w-[450px] bg-white rounded-3xl p-10 shadow-2xl transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
