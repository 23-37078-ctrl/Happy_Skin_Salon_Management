import { useEffect, useRef } from "react";

const FLOW = [
  "Customer books online",
  "Staff confirms booking",
  "Service is completed",
  "Transaction is recorded",
  "Dashboard and reports are updated",
];

function FadeIn({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting)
        setTimeout(() => el.classList.add("opacity-100", "translate-y-0"), delay);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`opacity-0 translate-y-6 transition-all duration-700 ease-out ${className}`}>
      {children}
    </div>
  );
}

export default function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <FadeIn>
          <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-5">
            About Us
          </span>
          <h2 className="text-4xl font-extrabold text-[#1F2A44] leading-tight mb-6">
            A better way to organize salon operations.
          </h2>

          {/* Image collage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="h-48 rounded-2xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=70" alt="Salon" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="h-48 rounded-2xl overflow-hidden mt-6">
              <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=70" alt="Hair" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          </div>
        </FadeIn>

        {/* Right */}
        <FadeIn delay={150}>
          <p className="text-[#6B7280] text-base leading-relaxed mb-8">
            This system is designed to replace manual booking, physical logbooks,
            and spreadsheet-based reports with a centralized web-based platform.
          </p>
          <p className="text-[#6B7280] text-base leading-relaxed mb-8">
            Customers can view services and packages, while staff, managers, and
            the owner can handle bookings, transactions, inventory, reports, and
            branch monitoring.
          </p>

          {/* System Flow Card */}
          <div className="bg-[#1F2A44] rounded-2xl p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-pink-300 mb-5">
              System Flow
            </p>
            <div className="space-y-3">
              {FLOW.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#C85B95] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-gray-200">{step}</p>
                  {i < FLOW.length - 1 && (
                    <span className="ml-auto text-pink-400 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}