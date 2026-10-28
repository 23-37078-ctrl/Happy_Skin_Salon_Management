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
import { FaFacebookF, FaInstagram } from "react-icons/fa";
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
const HERO_SLIDES = [
  { image: "/images/services/generated/signature-facial.jpg", title: "Care that fits you", subtitle: "Skin · Hair · Beauty" },
  { image: "/images/services/generated/hair-spa-treatment.jpg", title: "A moment for you", subtitle: "Restore and unwind" },
  { image: "/images/services/generated/gel-manicure.jpg", title: "Little details", subtitle: "Nails · Care · Confidence" },
  { image: "/images/services/generated/diamond-peel.jpg", title: "Feel refreshed", subtitle: "Expert skin treatments" },
  { image: "/images/services/generated/foot-spa-massage.jpg", title: "Take a breather", subtitle: "Relax · Recharge · Repeat" },
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
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All Services");
  const [carouselPosition, setCarouselPosition] = useState({ category: "All Services", branchId: null, index: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setActiveHeroIndex((index) => (index + 1) % HERO_SLIDES.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

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
    navigate(bookingPath);
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
                <HiOutlineCalendarDays className="h-4 w-4" /> Book an appointment <HiArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => document.querySelector("#services")?.scrollIntoView({ behavior: "smooth" })} className="min-h-12 rounded-lg border border-[#E8C9D9] bg-white/70 px-5 text-sm font-bold text-[#C2185B] transition hover:bg-[#FCE4EC]">
                Explore our services
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-base font-bold text-[#754463] sm:text-lg">
              <a href="tel:09123456789" className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[#E8C9D9] bg-white/80 px-4 transition hover:border-[#D65A9A] hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D65A9A]/20"><HiOutlinePhone className="h-5 w-5 text-[#C85B95] sm:h-6 sm:w-6" />0912 345 6789</a>
              <a href="https://www.facebook.com/profile.php?id=100095537436310" target="_blank" rel="noreferrer" aria-label="Happy Skin on Facebook" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E8C9D9] bg-white text-[#C85B95] transition hover:border-[#D65A9A] hover:bg-[#FFF0F7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D65A9A]/20 sm:h-12 sm:w-12"><FaFacebookF className="h-5 w-5 sm:h-6 sm:w-6" /></a>
              <a href="https://www.instagram.com/happyskinnails/" target="_blank" rel="noreferrer" aria-label="Happy Skin on Instagram" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E8C9D9] bg-white text-[#C85B95] transition hover:border-[#D65A9A] hover:bg-[#FFF0F7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D65A9A]/20 sm:h-12 sm:w-12"><FaInstagram className="h-5 w-5 sm:h-6 sm:w-6" /></a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#E7D8D4] pt-5 text-xs font-semibold text-[#625956]">
            <span><strong className="text-[#C2185B]">{SALON_SERVICES.length}+</strong> services</span>
              <span><strong className="text-[#C2185B]">{branches.length}</strong> branches</span>
              <span>Online appointment booking</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[760px]">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#EBD2CD]/70 blur-2xl" />
            <div className="relative h-[350px] overflow-hidden sm:h-[430px] lg:h-[500px]" aria-label="Happy Skin services image carousel" aria-roledescription="carousel">
              {HERO_SLIDES.map((slide, index) => {
                let offset = (index - activeHeroIndex + HERO_SLIDES.length) % HERO_SLIDES.length;
                if (offset > Math.floor(HERO_SLIDES.length / 2)) offset -= HERO_SLIDES.length;
                const distance = Math.abs(offset);
                const scale = distance === 0 ? 1 : distance === 1 ? 0.76 : 0.54;
                const horizontalShift = distance === 0 ? "0px" : `min(${distance === 1 ? "24vw" : "34vw"}, ${distance === 1 ? "18rem" : "25rem"})`;
                const horizontalPosition = distance === 0 ? "-50%" : `calc(-50% ${offset < 0 ? "-" : "+"} ${horizontalShift})`;
                return <div key={slide.image} aria-hidden={distance !== 0} className="absolute left-1/2 top-1/2 h-[80%] w-[min(72vw,25rem)] overflow-hidden rounded-[1.8rem] border border-white/70 shadow-[0_25px_70px_rgba(91,58,54,0.2)] transition-[transform,opacity] duration-700 ease-out" style={{ transform: `translate(${horizontalPosition}, -50%) scale(${scale})`, opacity: distance === 0 ? 1 : distance === 1 ? 0.8 : 0.48, zIndex: 10 - distance, pointerEvents: distance === 0 ? "auto" : "none" }}>
                  <img src={slide.image} alt={slide.subtitle} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#352522]/40 via-transparent to-transparent" />
                  {distance === 0 && <div className="absolute bottom-4 left-4 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur sm:bottom-5 sm:left-5">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#C2185B]">{slide.title}</p>
                    <p className="mt-1 font-serif text-base text-[#6B3F5D] sm:text-lg">{slide.subtitle}</p>
                  </div>}
                </div>;
              })}
              <div className="absolute bottom-5 right-4 z-20 flex items-center gap-2 sm:right-6">
                {HERO_SLIDES.map((slide, index) => <button key={slide.image} type="button" onClick={() => setActiveHeroIndex(index)} aria-label={`Show image ${index + 1}`} aria-current={activeHeroIndex === index ? "true" : undefined} className={`h-2.5 rounded-full border border-white/80 transition-all ${activeHeroIndex === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <section id="branches" className="scroll-mt-24 py-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C2185B]">Visit us</p>
          {notice && <p className="mt-4 rounded-xl bg-[#FFF0F7] px-4 py-3 text-sm text-[#9D3C70]">{notice}</p>}

          <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <BranchSkeleton key={index} />)
              : branches.map((branch, index) => {
                  const selected = String(branch.id) === String(selectedBranch?.id);
                  return (
                    <LandingBranchCard
                      key={branch.id}
                      branch={branch}
                      image={BRANCH_BACKDROPS[index % BRANCH_BACKDROPS.length]}
                      selected={selected}
                      onSelect={() => setSelectedBranchId(branch.id)}
                      onBook={() => goToBooking(null, branch.id)}
                    />
                  );
                })}
          </div>
        </section>

        <section id="services" className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 scroll-mt-24 overflow-hidden bg-[radial-gradient(ellipse_at_top,_#FFFFFF_0%,_#FFF8FB_48%,_#FCE7F1_100%)] py-6 text-[#754463] sm:py-8">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-3xl text-[#6B3F5D] sm:text-4xl">Our services</h2>
              </div>
              <span className="text-xs font-semibold text-[#7B6570]">{visibleServices.length} {visibleServices.length === 1 ? "service" : "services"}</span>
            </div>
            <div aria-label="Service categories" className="horizontal-service-scroll mb-1 flex snap-x snap-proximity flex-nowrap gap-3 pb-3 sm:gap-4">
              {availableCategories.map((category) => <button key={category} type="button" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={`min-h-11 shrink-0 snap-start rounded-full border px-5 text-sm font-semibold transition-all duration-200 ${activeCategory === category ? "border-[#D6539A] text-white shadow-md" : "border-[#E8C9D9] bg-white/80 text-[#754463] hover:border-[#D65A9A]/50 hover:bg-[#FFF0F7]"}`} style={activeCategory === category ? { background: "linear-gradient(135deg, #D6539A 0%, #C24486 100%)", fontFamily: "'Poppins', sans-serif" } : { fontFamily: "'Poppins', sans-serif" }}>{category}</button>)}
            </div>

            {visibleServices.length > 0 ? <>
              <div className="relative mx-auto h-[36rem] max-w-[110rem] sm:h-[38rem] lg:h-[39rem]" aria-roledescription="carousel" aria-label={`${activeCategory === "All Services" ? "All" : activeCategory} salon services`}>
                {visibleServices.map((service, index) => {
                  let offset = (index - currentServiceIndex + visibleServices.length) % visibleServices.length;
                  if (offset > Math.floor(visibleServices.length / 2)) offset -= visibleServices.length;
                  const distance = Math.abs(offset);
                  if (distance > 2) return null;
                  const isActive = offset === 0;
                  const offsetVw = distance * 30;
                  const offsetRem = distance * 22;
                  const scale = distance === 0 ? 1.14 : distance === 1 ? 0.84 : 0.6;
                  const opacity = distance === 0 ? 1 : distance === 1 ? 0.78 : 0.5;
                  return <div key={service.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${visibleServices.length}: ${service.name}`} aria-hidden={!isActive} className="absolute top-1/2 w-[min(88vw,34rem)] transition-[left,transform,opacity] duration-500 ease-out" style={{ left: offset === 0 ? "50%" : `calc(50% ${offset < 0 ? "-" : "+"} min(${offsetVw}vw, ${offsetRem}rem))`, transform: `translate(-50%, -50%) scale(${scale})`, opacity, zIndex: distance === 0 ? 20 : distance === 1 ? 10 : 5, pointerEvents: isActive ? "auto" : "none" }}>
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
                {Array.from({ length: Math.min(5, visibleServices.length) }, (_, dotIndex) => dotIndex - Math.floor(Math.min(5, visibleServices.length) / 2)).map((delta) => {
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
    <article className="group flex h-[33rem] flex-col overflow-hidden rounded-[1.6rem] border border-[#F0E3EA] bg-white shadow-[0_10px_28px_rgba(117,68,99,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(117,68,99,0.16)]">
      <div className="relative h-64 shrink-0 overflow-hidden bg-[#FFF0F7] sm:h-72">
        <img src={service.image || "/images/services/generated/signature-facial.jpg"} alt={service.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/services/generated/signature-facial.jpg"; }} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-bold text-[#754463] shadow-sm"><HiOutlineClock className="h-4 w-4 text-[#C85B95]" /> {service.duration_minutes || service.duration || 0} min</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-7 pt-4 sm:px-5 sm:pb-8 sm:pt-5">
        <h3 className="line-clamp-2 min-h-11 text-base font-extrabold leading-snug text-[#754463]">{service.name}</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C85B95]">{service.category}</p>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#756A72]">{service.description || "Professional salon care by Happy Skin specialists."}</p>
        <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-t border-[#F6EDF2] pt-4">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9A8791]">Price</p><span className="mt-0.5 block truncate text-base font-extrabold text-[#C2185B]">{formatServicePrice(service.price)}</span></div>
          <button type="button" onClick={onBook} aria-label={`Book ${service.name}`} title={`Book ${service.name}`} className="mb-1 grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md transition hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/20" style={{ background: "linear-gradient(135deg, #D6539A 0%, #C24486 100%)" }}>
            <HiOutlinePlus className="h-5 w-5" />
          </button>
          <span aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function LandingBranchCard({ branch, image, selected, onSelect, onBook }) {
  const [flipped, setFlipped] = useState(false);
  // The Lipa map is explicitly anchored to JET Hotel as requested. Other
  // branches use their saved names and addresses; no coordinates are guessed.
  const location = typeof branch.address === "string" ? branch.address.trim() : "";
  const isLipaBranch = branch.name?.toLowerCase().includes("lipa");
  const isCaviteBranch = branch.name?.toLowerCase().includes("cavite");
  const isMainBranch = branch.name?.toLowerCase().includes("main");
  const mapQuery = isLipaBranch
    ? "JET Hotel Lipa City, W5R2+VP8, Lipa City, Batangas, Philippines"
    : isCaviteBranch
      ? "Alfonso, Cavite, Philippines"
      : isMainBranch
        ? "22 Malingap Street, Teachers Village, Quezon City, Philippines"
    : location ? `${branch.name}, ${location}` : "";
  const embedUrl = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;

  return (
    <div className="[perspective:1200px]" onMouseLeave={() => setFlipped(false)}>
      <div className="relative h-[390px] w-full transition-transform duration-700 [transform-style:preserve-3d] sm:h-[430px]" style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <article className={`absolute inset-0 flex flex-col overflow-hidden rounded-[1.5rem] border bg-white shadow-[0_16px_40px_rgba(31,41,55,0.08)] transition-shadow hover:shadow-[0_22px_55px_rgba(214,90,154,0.14)] ${selected ? "border-[#D65A9A] ring-4 ring-[#D65A9A]/10" : "border-[#F3E8EF]"}`} style={{ backfaceVisibility: "hidden" }}>
          <button type="button" onClick={() => { onSelect(); setFlipped(true); }} aria-label={`Show map for ${branch.name}`} aria-pressed={selected} className="group block shrink-0 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#D65A9A]/40">
            <div className="relative h-[225px] overflow-hidden bg-[#FFF0F7] sm:h-[255px]">
              <img src={image} alt={`${branch.name} salon`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1F2A44]/50 via-transparent to-transparent" />
            </div>
          </button>
          <div className="flex min-h-0 flex-1 flex-col items-start px-4 py-3 sm:px-5">
            <h3 className="text-lg font-extrabold leading-snug text-[#1F2A44]">{branch.name}</h3>
            <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-[#667085]"><HiOutlineMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C85B95]" />{branch.address}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1E5EB] px-4 py-3.5 sm:px-5">
            {branch.phone ? <a href={`tel:${branch.phone}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-2 text-sm font-bold text-[#754463]"><HiOutlinePhone className="h-4 w-4 text-[#C85B95]" />{branch.phone}</a> : <span />}
            <button type="button" onClick={onBook} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#A83F78]"><HiOutlineCalendarDays className="h-4 w-4" />Book here</button>
          </div>
        </article>

        <article className="absolute inset-0 flex flex-col overflow-hidden rounded-[1.5rem] border border-[#F3E8EF] bg-white shadow-[0_16px_40px_rgba(31,41,55,0.08)]" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
          <div className="relative min-h-0 flex-1 bg-[#F7F4F5]">
            {embedUrl ? <iframe title={`Map showing ${branch.name}`} src={embedUrl} className="pointer-events-none absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-medium text-[#667085]">Map unavailable until this branch has an address.</p>}
          </div>
        </article>
      </div>
    </div>
  );
}

function BranchSkeleton() {
  return <div className="h-[390px] animate-pulse overflow-hidden rounded-[1.5rem] border border-[#EAE7E9] bg-white sm:h-[430px]"><div className="h-[205px] bg-[#F6EAF0] sm:h-[235px]" /><div className="space-y-3 p-5"><div className="h-5 w-2/3 rounded bg-[#F6EAF0]" /><div className="h-3 w-full rounded bg-[#F6EAF0]" /><div className="mt-7 h-10 w-1/2 rounded bg-[#F6EAF0]" /></div></div>;
}
