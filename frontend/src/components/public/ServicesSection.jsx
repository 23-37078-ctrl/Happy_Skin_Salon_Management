import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineClock, HiOutlineSparkles } from "react-icons/hi2";
import { SALON_SERVICES, formatServicePrice } from "../../constants/salonServices";
import { useAuth } from "../../hooks/useAuth";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api/v1";

// ── Fade-in animation wrapper ───────────────────────────────
function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("opacity-100", "translate-y-0"), delay);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
      {children}
    </div>
  );
}

// ── Skeleton loader card ────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-[#F0E6EC] animate-pulse">
      <div className="h-48 bg-pink-50" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-pink-50 rounded w-2/3" />
        <div className="h-3 bg-pink-50 rounded w-full" />
        <div className="h-3 bg-pink-50 rounded w-4/5" />
        <div className="flex justify-between mt-4">
          <div className="h-4 bg-pink-50 rounded w-1/3" />
          <div className="h-4 bg-pink-50 rounded w-1/4" />
        </div>
        <div className="h-10 bg-pink-50 rounded-2xl mt-2" />
      </div>
    </div>
  );
}

// ── Single service card ─────────────────────────────────────
function ServiceCard({ service, index, onBook }) {
  const [imgError, setImgError] = useState(false);

  return (
    <FadeIn delay={index * 60}>
      <div className="group bg-white rounded-3xl overflow-hidden border border-[#F0E6EC] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
        
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-pink-50">
          {!imgError ? (
            <img
              src={service.image}
              alt={service.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HiOutlineSparkles className="h-12 w-12 text-pink-200" />
            </div>
          )}

          {/* Duration badge */}
          <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[#C85B95] text-[11px] font-semibold shadow-sm">
            <HiOutlineClock className="h-3.5 w-3.5" />
            {service.duration_minutes} min
          </span>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-base font-bold text-[#1F2A44] leading-snug">
            {service.name}
          </h3>
          <p className="mt-1.5 text-sm text-[#6B7280] leading-relaxed flex-1">
            {service.description}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-extrabold text-[#C85B95]">
              {formatServicePrice(service.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onBook(service.id)}
            className="mt-3 w-full py-2.5 rounded-2xl bg-[#C85B95] text-white text-sm font-semibold hover:bg-[#b34d82] hover:shadow-lg active:scale-95 transition-all duration-200"
          >
            Book Now
          </button>
        </div>
      </div>
    </FadeIn>
  );
}

// ── Main section ────────────────────────────────────────────
export default function ServicesSection() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();

  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchServices() {
      setIsLoading(true);
      setError(false);
      try {
        const res = await fetch(`${API_BASE}/public/services`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // If API returns data use it, otherwise fall back to constants
        setServices(data.length > 0 ? data : SALON_SERVICES.map(s => ({
          ...s,
          duration_minutes: s.duration,
          image: s.img,
        })));
      } catch (err) {
        if (err.name === "AbortError") return;
        // Silent fallback to static constant data
        setServices(
          SALON_SERVICES.map((s) => ({
            ...s,
            duration_minutes: s.duration,
            image: s.img,
          }))
        );
        setError(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchServices();
    return () => controller.abort();
  }, []);

  const handleBook = (serviceId) => {
    const bookingPath = `/customer/book?service=${serviceId}`;
    if (isAuthenticated && currentUser?.role === "customer") {
      navigate(bookingPath);
      return;
    }
    navigate(`/login?redirect=${encodeURIComponent(bookingPath)}`);
  };

  return (
    <section id="services" className="py-24 bg-[#FAF6F8]">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <FadeIn>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-4">
              Our Services
            </span>
            <h2 className="text-4xl font-extrabold text-[#1F2A44] mb-3">
              Beauty treatments for every you.
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
              From relaxing facials to precision nail care — book any service
              online in seconds.
            </p>
            {/* Subtle fallback notice — only shown if API failed */}
            {error && (
              <p className="mt-3 text-xs text-[#C85B95] opacity-60">
                Showing sample services — live data unavailable.
              </p>
            )}
          </div>
        </FadeIn>

        {/* Grid */}
        {isLoading ? (
          // Skeleton while loading
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <ServiceCard
                key={service.id}
                service={service}
                index={index}
                onBook={handleBook}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <FadeIn delay={200}>
          <div className="mt-14 text-center">
            <button
              type="button"
              onClick={() =>
                isAuthenticated && currentUser?.role === "customer"
                  ? navigate("/customer/book")
                  : navigate("/login")
              }
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#C85B95] text-white font-semibold text-sm hover:bg-[#b34d82] hover:shadow-xl active:scale-95 transition-all duration-200"
            >
              <HiOutlineSparkles className="h-5 w-5" />
              Book an Appointment
            </button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}