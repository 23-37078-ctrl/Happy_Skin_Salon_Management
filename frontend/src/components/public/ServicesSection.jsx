import { useEffect, useRef } from "react";
import { HiOutlineCheck } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { SALON_PACKAGES, formatServicePrice } from "../../constants/salonServices";
import { useAuth } from "../../hooks/useAuth";

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

export default function ServicesSection() {
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
    <section id="services" className="py-24 bg-[#FAF6F8]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-4">
              Packages
            </span>
            <h2 className="text-4xl font-extrabold text-[#1F2A44] mb-3">
              Save more with beauty packages.
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
              Choose bundled treatments for hair care, skin brightening, nails, facial care, and relaxation.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {SALON_PACKAGES.map((pkg, index) => (
            <FadeIn key={pkg.name} delay={index * 80}>
              <div className="group bg-white rounded-3xl overflow-hidden border border-[#E6E6E6] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={pkg.img}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[#C85B95] text-[10px] font-bold uppercase tracking-widest shadow-sm">
                    {pkg.tag}
                  </span>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#1F2A44]">{pkg.name}</h3>
                      <p className="text-sm text-[#6B7280]">{pkg.description}</p>
                    </div>
                    <span className="text-xl font-extrabold text-[#C85B95] whitespace-nowrap ml-4">
                      {formatServicePrice(pkg.price)}
                    </span>
                  </div>

                  <ul className="mb-5 flex-1 space-y-1.5">
                    {pkg.includes.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-[#6B7280]">
                        <span className="w-4 h-4 rounded-full bg-pink-100 text-[#C85B95] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          <HiOutlineCheck className="h-3 w-3" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleBook(pkg.id)}
                    className="w-full py-3 rounded-2xl bg-[#C85B95] text-white text-sm font-semibold hover:bg-[#b34d82] hover:shadow-lg transition-all duration-200"
                  >
                    Book Package
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
