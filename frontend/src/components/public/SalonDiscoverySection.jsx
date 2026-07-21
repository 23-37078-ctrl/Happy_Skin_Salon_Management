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

export default function SalonDiscoverySection() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [query, setQuery] = useState("");
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
        setBranches(payload.branches || []);
        setServices(payload.services?.length ? payload.services : fallbackServices);
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
  const visibleServices = useMemo(() => {
    const source = selectedBranch?.services?.length ? selectedBranch.services : services;
    if (!normalizedQuery) return source;
    return source.filter((service) =>
      [service.name, service.description].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, selectedBranch, services]);

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
    <section id="home" className="min-h-screen bg-[#FCFAFB] pb-20 pt-[72px]">
      <div className="border-b border-[#F1E7EC] bg-white">
        <div className="w-full max-w-none px-4 py-3 sm:px-6 lg:px-8">
          <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#EAE7E9] bg-[#F7F7F8] px-4 transition focus-within:border-[#D65A9A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#D65A9A]/10">
            <HiOutlineMagnifyingGlass className="h-5 w-5 shrink-0 text-[#667085]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a salon service"
              className="w-full bg-transparent text-sm text-[#1F2A44] outline-none placeholder:text-[#8B8B92] sm:text-base"
            />
          </label>
        </div>
      </div>

      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8">
        <section id="branches" className="scroll-mt-24 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C85B95]">Filter by location</p>
              <h2 className="mt-0.5 text-base font-extrabold text-[#1F2A44] sm:text-lg">Choose a branch</h2>
            </div>
            <span className="hidden text-sm text-[#667085] sm:block">{branches.length} active locations</span>
          </div>

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
                      onClick={() => setSelectedBranchId((current) =>
                        String(current) === String(branch.id) ? null : branch.id
                      )}
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
                        <div className="mt-1.5 flex items-center gap-3 text-[9px] font-semibold text-[#C85B95]">
                          <span>{branch.services?.length || services.length} services</span>
                          <span>{selected ? "Showing services" : "Select branch"}</span>
                        </div>
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
              <button onClick={() => goToBooking(null, selectedBranch.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2.5 text-sm font-bold text-white"><HiOutlineCalendarDays className="h-4 w-4" /> Book here</button>
            </div>
          </div>
        )}

        <section id="services" className="scroll-mt-24 pb-5 pt-2">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleServices.map((service) => (
              <ServiceCard key={service.id} service={service} onBook={() => goToBooking(service.id, selectedBranch?.id)} />
            ))}
          </div>
          {!loading && visibleServices.length === 0 && <EmptyResults label="services" />}
        </section>

      </div>
    </section>
  );
}

function ServiceCard({ service, onBook }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#EAE7E9] bg-white transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-44 overflow-hidden bg-[#FFF0F7]">
        <img src={service.image} alt={service.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#1F2A44] shadow"><HiOutlineClock className="h-4 w-4 text-[#C85B95]" /> {service.duration_minutes || 0} min</span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-extrabold text-[#1F2A44]">{service.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#667085]">{service.description || "Professional salon care by Happy Skin specialists."}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-extrabold text-[#C85B95]">{formatServicePrice(service.price)}</span>
          <button onClick={onBook} className="inline-flex items-center gap-1 rounded-xl bg-[#C85B95] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#B94B86]">Book now <HiArrowRight className="h-4 w-4" /></button>
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
