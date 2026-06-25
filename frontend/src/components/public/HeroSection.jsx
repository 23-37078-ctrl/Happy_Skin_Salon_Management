import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function HeroSection() {
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.classList.add("opacity-100", "translate-y-0");
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="home" className="min-h-[85vh] pt-[72px] flex items-center bg-[#FAF6F8]">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
        <div ref={ref} className="opacity-0 translate-y-8 transition-all duration-700 ease-out">
          <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-6">
            Centralized Salon Platform
          </span>

          <h1
            className="text-5xl lg:text-[62px] font-extrabold text-[#1F2A44] leading-tight mb-6"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Book salon services and manage branch operations in one place.
          </h1>

          <p className="text-[#6B7280] text-base leading-relaxed mb-8 max-w-lg">
            Customers can request appointments online while staff handle booking
            confirmation, payments, and daily branch records from a centralized workspace.
          </p>

          <div className="flex flex-wrap gap-4 mb-12">
            <button
              onClick={() => navigate("/register")}
              className="px-7 py-3.5 rounded-full bg-[#C85B95] text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              Book Appointment
            </button>
            <button
              onClick={() => document.querySelector("#services")?.scrollIntoView({ behavior: "smooth" })}
              className="px-7 py-3.5 rounded-full border-2 border-[#C85B95] text-[#C85B95] font-semibold text-sm hover:bg-pink-50 hover:scale-105 transition-all duration-200"
            >
              Browse Services
            </button>
          </div>

          <div className="flex gap-8">
            {[
              { value: "20+", label: "Services" },
              { value: "4", label: "User Roles" },
              { value: "24/7", label: "Online Access" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-extrabold text-[#1F2A44]">{value}</p>
                <p className="text-xs text-[#6B7280] font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center">
          <div className="relative w-full max-w-md">
            <div className="w-full h-[420px] rounded-3xl overflow-hidden shadow-2xl bg-pink-100 group">
              <img
                src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80"
                alt="Salon staff preparing a customer service"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 max-w-[220px] border border-[#E6E6E6]">
              <p className="text-[10px] font-semibold text-[#C85B95] uppercase tracking-widest mb-1">
                Featured Package
              </p>
              <p className="text-sm font-bold text-[#1F2A44] mb-0.5">Glow Up Package</p>
              <p className="text-xs text-[#6B7280]">Pico Whitening Laser + Gluta Drip</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[#C85B95] font-bold text-sm">PHP 2,299</span>
                <span className="text-[10px] bg-pink-100 text-[#C85B95] px-2 py-0.5 rounded-full font-medium">
                  Best Value
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
