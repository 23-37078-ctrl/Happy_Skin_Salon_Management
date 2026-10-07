import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlinePhone,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import { SALON_SERVICES, formatServicePrice } from "../../constants/salonServices";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api/v1";

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
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Services");
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

  const normalizedQuery = query.trim().toLowerCase();
  const availableCategories = useMemo(() => ["All Services", ...new Set(services.map((service) => service.category || serviceCategories.get(service.name) || "Salon Service"))], [services]);
  const visibleServices = useMemo(() => {
    const source = selectedBranch?.services?.length ? selectedBranch.services : services;
    const categoryFiltered = activeCategory === "All Services" ? source : source.filter((service) => (service.category || serviceCategories.get(service.name) || "Salon Service") === activeCategory);
    if (!normalizedQuery) return categoryFiltered;
    return categoryFiltered.filter((service) =>
      [service.name, service.description].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [activeCategory, normalizedQuery, selectedBranch, services]);

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

        <section id="services" className="scroll-mt-24 pb-5 pt-2">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C2185B]">Our treatments</p>
              <h2 className="mt-1 font-serif text-3xl text-[#6B3F5D] sm:text-4xl">{selectedBranch ? `Services at ${selectedBranch.name}` : normalizedQuery ? "Search results" : "Our services"}</h2>
            </div>
            <span className="text-xs font-semibold text-[#667085]">{visibleServices.length} {visibleServices.length === 1 ? "service" : "services"}</span>
          </div>
          <div className="mb-5 flex flex-nowrap gap-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <label className="flex min-h-12 w-[min(390px,85vw)] shrink-0 items-center gap-2.5 rounded-xl border border-[#E8D7E1] bg-white px-4 transition focus-within:border-[#C2185B] focus-within:ring-2 focus-within:ring-[#C2185B]/10">
            <HiOutlineMagnifyingGlass className="h-5 w-5 shrink-0 text-[#C2185B]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search treatments and services" className="w-full bg-transparent text-sm text-[#302927] outline-none placeholder:text-[#9A918E]" />
          </label>
          {availableCategories.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`min-h-12 shrink-0 rounded-xl px-5 text-sm font-semibold transition-all duration-200 ${activeCategory === category ? "text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg" : "text-[#6B3F5D] hover:bg-[#FCE4EC]"}`} style={activeCategory === category ? { background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)", fontFamily: "'Poppins', sans-serif" } : { fontFamily: "'Poppins', sans-serif" }}>{category}</button>)}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleServices.map((service) => (
              <ServiceCard key={service.id} service={{ ...service, category: service.category || serviceCategories.get(service.name) || "Salon Service" }} onBook={() => goToBooking(service.id, selectedBranch?.id)} />
            ))}
          </div>
          {!loading && visibleServices.length === 0 && <EmptyResults label="services" />}
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
    <article className="group overflow-hidden rounded-2xl border border-[#EAE7E9] bg-white transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-44 overflow-hidden bg-[#FFF0F7]">
        <img src={service.image} alt={service.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#302927] shadow"><HiOutlineClock className="h-4 w-4 text-[#B96F6D]" /> {service.duration_minutes || 0} min</span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-extrabold text-[#6B3F5D]">{service.name}</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#6B3F5D]">{service.category}</p>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#667085]">{service.description || "Professional salon care by Happy Skin specialists."}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-extrabold text-[#C2185B]">{formatServicePrice(service.price)}</span>
              <button onClick={onBook} className="inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "linear-gradient(135deg, #C85B95 0%, #df5d9f 100%)", fontFamily: "'Poppins', sans-serif" }}>Book now <HiArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}

function BranchSkeleton() {
  return <div className="flex min-h-20 animate-pulse overflow-hidden rounded-xl border border-[#EAE7E9] bg-white"><div className="w-20 shrink-0 bg-[#F6EAF0] sm:w-24" /><div className="flex-1 space-y-2 p-3"><div className="h-3 w-2/3 rounded bg-[#F6EAF0]" /><div className="h-2.5 w-full rounded bg-[#F6EAF0]" /><div className="h-2.5 w-1/2 rounded bg-[#F6EAF0]" /></div></div>;
}

function EmptyResults({ label }) {
  return <div className="mt-6 rounded-2xl border border-dashed border-[#DCCFD6] bg-white px-6 py-10 text-center text-sm text-[#667085]">No matching {label}. Try another search.</div>;
}
