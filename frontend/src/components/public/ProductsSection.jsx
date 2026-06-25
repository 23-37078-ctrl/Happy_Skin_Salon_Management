import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SALON_SERVICES, formatServicePrice } from "../../constants/salonServices";
import { useAuth } from "../../hooks/useAuth";

const CATEGORY_COLORS = {
  Aesthetic: "bg-purple-100 text-purple-700",
  Hair: "bg-amber-100 text-amber-700",
  Spa: "bg-teal-100 text-teal-700",
  Lashes: "bg-pink-100 text-pink-700",
  Nails: "bg-rose-100 text-rose-700",
  Facial: "bg-orange-100 text-orange-700",
  Brow: "bg-fuchsia-100 text-fuchsia-700",
};

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
    <div ref={ref} className="opacity-0 translate-y-6 transition-all duration-600 ease-out">
      {children}
    </div>
  );
}

export default function ProductsSection() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();

  const handleBook = (serviceId) => {
    const bookingPath = `/customer/book?service=${serviceId}`;
    if (isAuthenticated && currentUser?.role === "customer") {
      navigate(bookingPath);
      return;
    }
    navigate(`/login?redirect=${encodeURIComponent(bookingPath)}`);
  };

  return (
    <section id="products" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-4">
              Services
            </span>
            <h2 className="text-4xl font-extrabold text-[#1F2A44] mb-3">
              Explore bookable salon services.
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
              Browse aesthetic, hair, nails, facial, spa, brow, and lash services with clear pricing.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SALON_SERVICES.map((service, index) => (
            <FadeIn key={service.name} delay={index * 50}>
              <div className="group bg-white border border-[#E6E6E6] rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div className="h-44 overflow-hidden">
                  <img
                    src={service.img}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <span
                    className={`inline-block self-start px-2.5 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${
                      CATEGORY_COLORS[service.category] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {service.category}
                  </span>
                  <p className="text-sm font-semibold text-[#1F2A44] mb-1 flex-1">
                    {service.name}
                  </p>
                  <p className="text-xs text-[#6B7280] mb-3">{service.duration} minutes</p>
                  <p className="text-[#C85B95] font-bold text-base mb-3">
                    {formatServicePrice(service.price)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleBook(service.id)}
                    className="w-full py-2 rounded-xl bg-pink-50 text-[#C85B95] text-xs font-semibold hover:bg-[#C85B95] hover:text-white transition-all duration-200"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
