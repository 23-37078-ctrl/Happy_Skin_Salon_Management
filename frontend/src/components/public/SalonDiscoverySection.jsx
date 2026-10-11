import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlinePlus,
  HiOutlinePhone,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import { SALON_SERVICES, SALON_SERVICE_CATEGORIES, formatServicePrice } from "../../constants/salonServices";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "/api/v1";

const BRANCH_BACKDROPS = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&q=80",
  "https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=900&q=80",
];

const fallbackServices = SALON_SERVICES.map((service) => ({
  ...service,
  duration_minutes: service.duration,
  image: service.img,
}));
const serviceCategories = new Map(SALON_SERVICES.map(({ name, category }) => [name, category]));

export default function SalonDiscoverySection() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All Services");
  const [carouselPosition, setCarouselPosition] = useState({ category: "All Services", branchId: null, index: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadDiscovery() {
      try {
        const response = await fetch(`${API_BASE}/public/discovery`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 350));
        setBranches(payload.branches || []);
        setServices((payload.services?.length ? payload.services : fallbackServices).map((service) => ({
          ...service,
          category: service.category || serviceCategories.get(service.name) || "Salon Service",
        })));
      } catch (error) {
        if (error.name === "AbortError") return;
        setServices(fallbackServices);
        setNotice("Live branch availability is temporarily unavailable. Showing our service catalog.");
      } finally {
        setLoading(false);
      }
    }
    loadDiscovery();
    return () => controller.abort();
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );

  const availableCategories = useMemo(() => {
    const present = new Set(services.map((service) => service.category || serviceCategories.get(service.name) || "Salon Service"));
    return [...SALON_SERVICE_CATEGORIES.filter((category) => present.has(category)), ...[...present].filter((category) => !SALON_SERVICE_CATEGORIES.includes(category))];
  }, [services]);
  const visibleServices = useMemo(() => {
    const source = selectedBranch?.services?.length ? selectedBranch.services : services;
    return activeCategory === "All Services" ? source : source.filter((service) => (service.category || serviceCategories.get(service.name) || "Salon Service") === activeCategory);
  }, [activeCategory, selectedBranch, services]);

  const activeServiceIndex = carouselPosition.category === activeCategory && String(carouselPosition.branchId) === String(selectedBranchId) ? carouselPosition.index : 0;
  const setActiveServiceIndex = (indexOrUpdate) => setCarouselPosition((current) => ({
    category: activeCategory,
    branchId: selectedBranchId,
    index: typeof indexOrUpdate === "function" ? indexOrUpdate(current.category === activeCategory && String(current.branchId) === String(selectedBranchId) ? current.index : 0) : indexOrUpdate,
  }));
  const currentServiceIndex = visibleServices.length ? activeServiceIndex % visibleServices.length : 0;
  const moveCarousel = (direction) => {
    if (!visibleServices.length) return;
    setActiveServiceIndex((current) => (current + direction + visibleServices.length) % visibleServices.length);
  };

  const goToBooking = (serviceId, branchId = selectedBranch?.id) => {
    const params = new URLSearchParams();
    if (serviceId) params.set("service", serviceId);
    if (branchId) params.set("branch", branchId);
    const bookingPath = `/customer/book?${params.toString()}`;
    if (isAuthenticated && currentUser?.role === "customer") {
      navigate(bookingPath);
      return;
    }
    navigate(`/login?redirect=${encodeURIComponent(bookingPath)}`);
  };

  return (
    <div className="landing-pink min-h-screen bg-[#FFF7FA] pb-16 pt-[72px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <section id="home" className="scroll-mt-20 overflow-hidden border-b border-[#F1E7EC] bg-gradient-to-br from-[#FFF7FA] via-[#FCE4EC] to-[#F8BBD0]">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-12 lg:py-20">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E8C9D9] bg-white/80 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C2185B] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#BD7772]" /> Happy Skin · Aesthetic & Beauty Lounge
            </span>
            <h1 className="mt-6 max-w-2xl font-serif text-4xl font-medium leading-[1.08] tracking-tight text-[#6B3F5D] sm:text-5xl lg:text-6xl">
              Care for your skin.<br /><span className="italic text-[#C2185B]">Confidence for you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#6B3F5D] sm:text-base">
              Explore our 2026 menu of facials, aesthetic treatments, spa, hair, nails, lash and brow services. Find a branch and book the care that feels right for you.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => goToBooking(null)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)", fontFamily: "'Poppins', sans-serif" }}>
                <HiOutlineCalendarDays className="h-4 w-4" /> Book appointment <HiArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => document.querySelector("#services")?.scrollIntoView({ behavior: "smooth" })} className="min-h-12 rounded-lg border border-[#E8C9D9] bg-white/70 px-5 text-sm font-bold text-[#C2185B] transition hover:bg-[#FCE4EC]">
                Explore services
              </button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#E7D8D4] pt-5 text-xs font-semibold text-[#625956]">
            <span><strong className="text-[#C2185B]">{SALON_SERVICES.length}+</strong> services</span>
              <span><strong className="text-[#C2185B]">{branches.length}</strong> branches</span>
              <span>Online appointment booking</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[610px]">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#EBD2CD]/70 blur-2xl" />
            <div className="relative h-[300px] overflow-hidden rounded-[2rem] shadow-[0_25px_70px_rgba(91,58,54,0.18)] sm:h-[390px] lg:h-[450px]">
              <img src="/images/services/signature-facial.jpg" alt="A relaxing facial treatment at Happy Skin" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#352522]/35 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#C2185B]">Care that fits you</p>
                <p className="mt-1 font-serif text-lg text-[#6B3F5D]">Skin · Hair · Beauty</p>
              </div>
            </div>
            <div className="absolute -right-2 top-6 hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur sm:block">
              <p className="text-xs font-bold text-[#6B3F5D]">Find your service</p>
              <p className="mt-1 text-[10px] text-[#77706D]">Browse the complete menu below</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <section id="branches" className="scroll-mt-24 py-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C2185B]">Visit us</p>
          <h2 className="mt-1 font-serif text-2xl text-[#6B3F5D] sm:text-3xl">Choose a branch</h2>

          {notice && <p className="mt-4 rounded-xl bg-[#FFF0F7] px-4 py-3 text-sm text-[#9D3C70]">{notice}</p>}

          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <BranchSkeleton key={index} />)
              : branches.map((branch, index) => {
                  const selected = String(branch.id) === String(selectedBranch?.id);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => setSelectedBranchId((current) => String(current) === String(branch.id) ? null : branch.id)}
                      className={`group flex min-h-20 overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                        selected ? "border-[#C85B95] ring-2 ring-[#C85B95]/10" : "border-[#EAE7E9]"
                      }`}
                    >
                      <div className="relative w-20 shrink-0 overflow-hidden sm:w-24">
                        <img src={BRANCH_BACKDROPS[index % BRANCH_BACKDROPS.length]} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1F2A44]/75 via-transparent to-transparent" />
                        {selected && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#C85B95] px-1.5 py-0.5 text-[8px] font-bold text-white">Selected</span>}
                      </div>
                      <div className="min-w-0 flex-1 p-2.5">
                        <h3 className="line-clamp-1 text-xs font-extrabold leading-4 text-[#1F2A44] sm:text-sm">{branch.name}</h3>
                        <p className="mt-1 flex items-start gap-1 text-[10px] leading-3.5 text-[#667085]"><HiOutlineMapPin className="h-3 w-3 shrink-0 text-[#C85B95]" />{branch.address}</p>
                      </div>
                    </button>
                  );
                })}
          </div>
        </section>

        {selectedBranch && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#F0DDE7] bg-[#FFF7FB] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#C85B95]">Services available at</p>
              <h3 className="mt-0.5 text-base font-extrabold text-[#1F2A44]">{selectedBranch.name}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedBranch.phone && <a href={`tel:${selectedBranch.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-[#E8C9D9] bg-white px-4 py-2.5 text-sm font-bold text-[#1F2A44]"><HiOutlinePhone className="h-4 w-4 text-[#C85B95]" /> Call branch</a>}
              <button onClick={() => goToBooking(null, selectedBranch.id)} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)", fontFamily: "'Poppins', sans-serif" }}><HiOutlineCalendarDays className="h-4 w-4" /> Book here</button>
            </div>
          </div>
        )}

        <section id="services" className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 scroll-mt-24 overflow-hidden bg-[radial-gradient(ellipse_at_top,_#FFFFFF_0%,_#FFF8FB_48%,_#FCE7F1_100%)] py-8 text-[#754463] sm:py-10">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C85B95]">Our treatments</p>
                <h2 className="mt-1 font-serif text-3xl text-[#6B3F5D] sm:text-4xl">{selectedBranch ? `Services at ${selectedBranch.name}` : "Our services"}</h2>
              </div>
              <span className="text-xs font-semibold text-[#7B6570]">{visibleServices.length} {visibleServices.length === 1 ? "service" : "services"}</span>
            </div>
            <div aria-label="Service categories" className="horizontal-service-scroll mb-1 flex snap-x snap-proximity flex-nowrap gap-3 pb-3 sm:gap-4">
              {availableCategories.map((category) => <button key={category} type="button" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={`min-h-11 shrink-0 snap-start rounded-full border px-5 text-sm font-semibold transition-all duration-200 ${activeCategory === category ? "border-[#D6539A] text-white shadow-md" : "border-[#E8C9D9] bg-white/80 text-[#754463] hover:border-[#D65A9A]/50 hover:bg-[#FFF0F7]"}`} style={activeCategory === category ? { background: "linear-gradient(135deg, #D6539A 0%, #C24486 100%)", fontFamily: "'Poppins', sans-serif" } : { fontFamily: "'Poppins', sans-serif" }}>{category}</button>)}
            </div>

            {visibleServices.length > 0 ? <>
              <div className="relative mx-auto h-[30rem] max-w-[90rem] sm:h-[34rem]" aria-roledescription="carousel" aria-label={`${activeCategory === "All Services" ? "All" : activeCategory} salon services`}>
                {visibleServices.map((service, index) => {
                  let offset = (index - currentServiceIndex + visibleServices.length) % visibleServices.length;
                  if (offset > Math.floor(visibleServices.length / 2)) offset -= visibleServices.length;
                  if (Math.abs(offset) > 1) return null;
                  const isActive = offset === 0;
                  return <div key={service.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${visibleServices.length}: ${service.name}`} aria-hidden={!isActive} className="absolute top-1/2 w-[min(76vw,25rem)] transition-[left,transform,opacity] duration-500 ease-out" style={{ left: offset === 0 ? "50%" : `calc(50% ${offset < 0 ? "-" : "+"} min(65vw, 28rem))`, transform: `translate(-50%, -50%) scale(${isActive ? 1 : 0.78})`, opacity: isActive ? 1 : 0.55, zIndex: isActive ? 20 : 10, pointerEvents: isActive ? "auto" : "none" }}>
                    <ServiceCard service={{ ...service, category: service.category || serviceCategories.get(service.name) || "Salon Service" }} onBook={() => goToBooking(service.id, selectedBranch?.id)} />
                  </div>;
                })}

                {visibleServices.length > 1 && <>
                  <button type="button" onClick={() => moveCarousel(-1)} aria-label="Previous service" className="absolute left-1 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#E8C9D9] bg-white/95 text-[#754463] shadow-md backdrop-blur transition hover:scale-105 hover:bg-[#FFF0F7] sm:left-5 sm:h-12 sm:w-12 lg:left-[7%]">
                    <HiOutlineChevronLeft className="h-6 w-6" />
                  </button>
                  <button type="button" onClick={() => moveCarousel(1)} aria-label="Next service" className="absolute right-1 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#E8C9D9] bg-white/95 text-[#754463] shadow-md backdrop-blur transition hover:scale-105 hover:bg-[#FFF0F7] sm:right-5 sm:h-12 sm:w-12 lg:right-[7%]">
                    <HiOutlineChevronRight className="h-6 w-6" />
                  </button>
                </>}
              </div>

              {visibleServices.length > 1 && <div className="mt-1 flex justify-center gap-2.5" aria-label="Choose a service slide">
                {[-1, 0, 1].map((delta) => {
                  const index = (currentServiceIndex + delta + visibleServices.length) % visibleServices.length;
                  return <button key={`${index}-${delta}`} type="button" onClick={() => setActiveServiceIndex(index)} aria-label={`Show ${visibleServices[index].name}`} aria-current={delta === 0 ? "true" : undefined} className={`h-2.5 rounded-full transition-all ${delta === 0 ? "w-7 bg-[#D6539A]" : "w-2.5 bg-[#D9B9CB] hover:bg-[#C85B95]"}`} />;
                })}
              </div>}
            </> : !loading && <div className="rounded-2xl border border-[#E8C9D9] bg-white/80 px-6 py-10 text-center text-sm text-[#7B6570]">No services are available in this category yet.</div>}
          </div>
        </section>

      </div>
      <section id="about" className="mx-4 mt-12 max-w-[1440px] scroll-mt-24 overflow-hidden rounded-[2rem] border border-[#F0E6EC] bg-white sm:mx-6 lg:mx-10">
        <div className="grid lg:grid-cols-2">
          <div className="grid min-h-[320px] grid-cols-2 gap-3 p-4 sm:p-6">
            <img src="/images/services/generated/carbon-laser-facial.jpg" alt="Personalized aesthetic care" className="h-full min-h-64 w-full rounded-2xl object-cover" />
            <div className="grid gap-3">
              <img src="/images/services/generated/hair-spa-treatment.jpg" alt="Hair spa treatment" className="h-40 w-full rounded-2xl object-cover" />
              <img src="/images/services/generated/gel-manicure.jpg" alt="Nail care service" className="h-40 w-full rounded-2xl object-cover" />
            </div>
          </div>
          <div className="flex flex-col justify-center px-6 pb-8 sm:px-10 lg:py-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C2185B]">About Happy Skin</p>
            <h2 className="mt-2 max-w-lg font-serif text-3xl leading-tight text-[#6B3F5D] sm:text-4xl">A little time for yourself can go a long way.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#6B3F5D]">Happy Skin brings together skin, aesthetic, spa, hair, nail, lash and brow services in one easy to browse menu. Choose from our participating branches, compare service prices, and request an appointment online.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Skin care", "Aesthetic treatments", "Spa & body", "Hair & nails"].map((item) => <span key={item} className="rounded-full border border-[#E8C9D9] bg-[#FCE4EC] px-3 py-1.5 text-[10px] font-bold text-[#6B3F5D]">{item}</span>)}
            </div>
            <button type="button" onClick={() => goToBooking(null)} className="mt-7 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)", fontFamily: "'Poppins', sans-serif" }}>Book your visit <HiArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ service, onBook }) {
  return (
    <article className="group flex h-[26rem] flex-col overflow-hidden rounded-[1.35rem] border border-[#F0E3EA] bg-white shadow-[0_10px_28px_rgba(117,68,99,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(117,68,99,0.16)]">
      <div className="relative h-48 shrink-0 overflow-hidden bg-[#FFF0F7] sm:h-52">
        <img src={service.image || "/images/services/generated/signature-facial.jpg"} alt={service.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/services/generated/signature-facial.jpg"; }} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-bold text-[#754463] shadow-sm"><HiOutlineClock className="h-4 w-4 text-[#C85B95]" /> {service.duration_minutes || service.duration || 0} min</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-7 pt-4 sm:px-5 sm:pb-8 sm:pt-5">
        <h3 className="line-clamp-2 min-h-11 text-base font-extrabold leading-snug text-[#754463]">{service.name}</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C85B95]">{service.category}</p>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#756A72]">{service.description || "Professional salon care by Happy Skin specialists."}</p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#F6EDF2] pt-4">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9A8791]">Price</p><span className="mt-0.5 block truncate text-base font-extrabold text-[#C2185B]">{formatServicePrice(service.price)}</span></div>
          <button type="button" onClick={onBook} aria-label={`Book ${service.name}`} title={`Book ${service.name}`} className="mb-1 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md transition hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/20" style={{ background: "linear-gradient(135deg, #D6539A 0%, #C24486 100%)" }}>
            <HiOutlinePlus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function BranchSkeleton() {
  return <div className="flex min-h-20 animate-pulse overflow-hidden rounded-xl border border-[#EAE7E9] bg-white"><div className="w-20 shrink-0 bg-[#F6EAF0] sm:w-24" /><div className="flex-1 space-y-2 p-3"><div className="h-3 w-2/3 rounded bg-[#F6EAF0]" /><div className="h-2.5 w-full rounded bg-[#F6EAF0]" /><div className="h-2.5 w-1/2 rounded bg-[#F6EAF0]" /></div></div>;
}
