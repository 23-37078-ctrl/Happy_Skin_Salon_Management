import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineBell,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineSparkles,
  HiOutlineArrowRightOnRectangle,
  HiOutlineMagnifyingGlass,
  HiChevronDown,
  HiChevronRight,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getSalonServiceCategory, SALON_SERVICE_CATEGORIES } from "../../constants/salonServices";

import EmptyState from "../../components/customer/EmptyState";
import NotificationCard from "../../components/customer/NotificationCard";
import PromotionCard from "../../components/customer/PromotionCard";
import RecentActivityCard from "../../components/customer/RecentActivityCard";
import RecommendedServiceCard from "../../components/customer/RecommendedServiceCard";
import Footer from "../../components/public/Footer";
import SystemPopup from "../../components/common/SystemPopup";

import {
  CardRailSkeleton,
  ListSkeleton,
} from "../../components/customer/Skeletons";

import {
  getCustomerDashboard,
  getCustomerBranches,
} from "../../services/customerService";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const SERVICE_FALLBACK_IMAGE = "/images/services/signature-facial.jpg";

function safeServiceImage(value) {
  if (!value) return SERVICE_FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : SERVICE_FALLBACK_IMAGE;
  } catch {
    return SERVICE_FALLBACK_IMAGE;
  }
}

function formatServicePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0
    ? price.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
    : "Price on request";
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [data, setData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPromotions, setShowPromotions] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeServiceCategory, setActiveServiceCategory] = useState("All Services");
  const dashboardRequestRef = useRef(null);
  const loggingOutRef = useRef(false);

  const fetchDashboard = useCallback((signal) => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      getCustomerDashboard(signal),
      getCustomerBranches(signal),
    ])
      .then(([dashboardPayload, branchesPayload]) => {
        setData(dashboardPayload);
        setBranches(branchesPayload || []);
        if (dashboardPayload?.promotions?.length) setShowPromotions(true);
      })
      .catch((err) => {
        if (!loggingOutRef.current && err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setError(
            "We couldn't load your dashboard right now. Please try again."
          );
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    Promise.resolve().then(() => fetchDashboard(controller.signal));
    return () => {
      controller.abort();
      if (dashboardRequestRef.current === controller) dashboardRequestRef.current = null;
    };
  }, [fetchDashboard]);

  const handleLogout = () => {
    loggingOutRef.current = true;
    // Cancel in-flight dashboard calls before the auth token is cleared.
    // This prevents the expected cancellation from being shown as an error popup.
    dashboardRequestRef.current?.abort();
    logout();
    navigate("/", { replace: true });
  };

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(selectedBranchId)) || null,
    [branches, selectedBranchId]
  );
  const allBranchServices = useMemo(() => {
    const uniqueServices = new Map();
    branches.forEach((branch) => {
      (branch.services || []).forEach((service) => {
        uniqueServices.set(service.id, { ...service, branch_id: branch.id, branch_name: branch.name });
      });
    });
    return Array.from(uniqueServices.values());
  }, [branches]);
  const selectedServices = selectedBranch
    ? (selectedBranch.services || []).map((service) => ({ ...service, branch_id: selectedBranch.id, branch_name: selectedBranch.name }))
    : allBranchServices;
  const recommendedServices = useMemo(() => {
    const activity = data?.recent_activity || [];
    const counts = activity.reduce((map, item) => {
      const name = item.service_name || item.service?.name || item.service;
      if (name) map.set(String(name).toLowerCase(), (map.get(String(name).toLowerCase()) || 0) + 1);
      return map;
    }, new Map());
    return [...selectedServices].sort((a, b) => (counts.get(String(b.name).toLowerCase()) || 0) - (counts.get(String(a.name).toLowerCase()) || 0));
  }, [data?.recent_activity, selectedServices]);
  const serviceGroups = useMemo(() => {
    const grouped = new Map();
    selectedServices.forEach((service) => {
      const category = service.category || getSalonServiceCategory(service.name);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(service);
    });
    return [...grouped.entries()].sort(([first], [second]) => {
      const firstOrder = SALON_SERVICE_CATEGORIES.indexOf(first);
      const secondOrder = SALON_SERVICE_CATEGORIES.indexOf(second);
      return (firstOrder < 0 ? Number.MAX_SAFE_INTEGER : firstOrder) - (secondOrder < 0 ? Number.MAX_SAFE_INTEGER : secondOrder);
    });
  }, [selectedServices]);
  const availableServiceCategories = useMemo(
    () => ["All Services", ...serviceGroups.map(([category]) => category)],
    [serviceGroups]
  );
  const visibleServiceGroups = useMemo(() => {
    const searchTerm = serviceSearch.trim().toLowerCase();
    return serviceGroups
      .filter(([category]) => activeServiceCategory === "All Services" || category === activeServiceCategory)
      .map(([category, categoryServices]) => [
        category,
        categoryServices.filter((service) => !searchTerm || [service.name, service.description, service.branch_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchTerm))),
      ])
      .filter(([, categoryServices]) => categoryServices.length);
  }, [activeServiceCategory, serviceGroups, serviceSearch]);
  const openServiceBooking = (service) => {
    const parameters = new URLSearchParams();
    const branchId = Number(service?.branch_id);
    const serviceId = Number(service?.id);
    if (Number.isInteger(branchId) && branchId > 0) parameters.set("branch", String(branchId));
    if (Number.isInteger(serviceId) && serviceId > 0) parameters.set("service", String(serviceId));
    navigate(`/customer/book${parameters.size ? `?${parameters.toString()}` : ""}`);
  };
  const customerFirstName = getFirstName(
    data?.user?.first_name ||
      data?.user?.full_name ||
      data?.user?.name ||
      currentUser?.first_name ||
      currentUser?.full_name ||
      currentUser?.name ||
      currentUser?.email
  );

  return (
    <main className="min-h-screen bg-[#FFF8FB]">
      <div className="w-full max-w-none px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <CustomerHeader
          name={customerFirstName}
          email={data?.user?.email || currentUser?.email}
          onHistory={() => navigate("/customer/history")}
          onLogout={handleLogout}
          recentActivity={data?.recent_activity || []}
          notifications={data?.notifications || []}
          isLoading={isLoading}
          onShowPromotions={() => setShowPromotions(true)}
          promotionCount={data?.promotions?.length || 0}
        />

        {error && <SystemPopup message={error} tone="error" onRetry={fetchDashboard} />}

        <Section className="mb-7" title={selectedBranch ? `Recommendations at ${selectedBranch.name}` : "Recommendations for you"}>
          {isLoading ? (
            <CardRailSkeleton />
          ) : selectedServices.length ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-4 scroll-smooth">
              {recommendedServices.slice(0, 4).map((service) => (
                <div key={service.id} className="w-[76vw] min-w-[16rem] max-w-[20rem] snap-start sm:w-[20rem]">
                  <RecommendedServiceCard
                    name={service.name}
                    image={service.image}
                    reason={service.reason}
                    description={service.description}
                    branchName={service.branch_name}
                    price={service.price}
                    duration={service.duration_minutes}
                    onBook={() => openServiceBooking(service)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing to recommend yet"
              description="Book your first treatment and personalized suggestions will appear here."
              icon={<HiOutlineSparkles className="h-9 w-9" />}
            />
          )}
        </Section>

        <Section
          id="customer-branches"
          title="Choose a Branch"
          action={selectedBranch && (
            <button
              type="button"
              onClick={() => setSelectedBranchId(null)}
              className="rounded-full border border-[#D65A9A]/25 bg-white px-4 py-2 text-xs font-bold text-[#C85B95] transition hover:bg-[#FFF0F7]"
            >
              Show all services
            </button>
          )}
        >
          {isLoading ? (
            <BranchListSkeleton />
          ) : branches.length ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id} className="w-[86vw] min-w-[18rem] max-w-[24rem] snap-start md:w-auto md:min-w-0 md:max-w-none">
                  <CustomerBranchCard
                    branch={branch}
                    selected={String(branch.id) === String(selectedBranch?.id)}
                    onSelect={() => setSelectedBranchId((current) => String(current) === String(branch.id) ? null : branch.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No branches available"
              description="Active Happy Skin locations will appear here."
              icon={<HiOutlineMapPin className="h-9 w-9" />}
            />
          )}
        </Section>

        <Section id="customer-services" className="mt-8">
          <div className="mb-8 border-b border-[#ECDDE5] pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <label className="relative block w-full shrink-0 lg:w-[19.5rem]">
                <span className="sr-only">Search services</span>
                <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667085]" />
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Search services"
                  className="h-12 w-full rounded-xl border border-[#D9D9DE] bg-white pl-12 pr-4 text-sm font-medium text-[#202534] outline-none transition placeholder:text-[#7B8190] focus:border-[#B94B86] focus:ring-4 focus:ring-[#B94B86]/10"
                />
              </label>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {availableServiceCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveServiceCategory(category)}
                      className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-extrabold transition focus:outline-none focus:ring-4 focus:ring-[#B94B86]/15 ${activeServiceCategory === category ? "bg-[#B94B86] text-white shadow-sm" : "text-[#667085] hover:bg-[#FFF0F7] hover:text-[#A83F78]"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <HiChevronRight className="h-5 w-5 shrink-0 text-[#667085]" aria-hidden="true" />
              </div>
            </div>
          </div>
          {isLoading ? (
            <AllServicesSkeleton />
          ) : visibleServiceGroups.length ? (
            <div className="space-y-10">
              {visibleServiceGroups.map(([category, categoryServices]) => (
                <section key={category} aria-labelledby={`customer-services-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <h3 id={`customer-services-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="mb-5 text-xl font-extrabold text-[#161B2B] sm:text-2xl">{category}</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {categoryServices.map((service) => (
                      <AllServiceCard key={service.id} service={service} onBook={() => openServiceBooking(service)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No services available"
              description={serviceSearch ? `No services match “${serviceSearch}”. Try another search.` : "Active salon services will appear here once they are added."}
              icon={<HiOutlineSparkles className="h-9 w-9" />}
            />
          )}
        </Section>

      </div>

      <Footer />

      {showPromotions && (
        <PromotionModal promotions={data?.promotions || []} onClose={() => setShowPromotions(false)} onBook={(promo) => navigate(`/customer/book?branch=${encodeURIComponent(promo.branch_id)}`)} />
      )}


    </main>
  );
}

function CustomerHeader({ name, email, onLogout, onHistory, recentActivity, notifications, isLoading, onShowPromotions, promotionCount }) {
  const [activityOpen, setActivityOpen] = useState(false);
  const activityRef = useRef(null);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  useEffect(() => {
    if (!activityOpen) return undefined;
    const closeOutside = (event) => !activityRef.current?.contains(event.target) && setActivityOpen(false);
    const closeWithKeyboard = (event) => event.key === "Escape" && setActivityOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [activityOpen]);

  return (
    <header className="relative z-[60] mb-6 rounded-[1.5rem] border border-[#F0E3EA] bg-white/95 px-4 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.05)] backdrop-blur sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button type="button" className="flex min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D65A9A]/15" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img
            src="/images/happy-skin-logo.svg"
            alt="Happy Skin"
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#F8DCEB] sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <p className="truncate font-extrabold leading-tight text-[#1F2A44]">Happy Skin</p>
            <p className="text-[10px] font-medium text-[#667085]">Customer Portal</p>
          </div>
        </button>

        <div className="hidden lg:block" />

        <div ref={activityRef} className="relative flex shrink-0 items-center justify-self-end gap-0.5">
          <button type="button" onClick={onHistory} aria-label="Booking history" title="Booking history" className="grid h-11 w-11 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/20"><HiOutlineClock className="h-6 w-6" /></button>
          <div>
            <button type="button" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Activity and notifications"} aria-expanded={activityOpen} aria-controls="customer-activity-menu" onClick={() => setActivityOpen((current) => !current)} className={`relative grid h-11 w-11 place-items-center rounded-xl text-[#D65A9A] transition focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/20 ${activityOpen ? "bg-[#FFF0F7] ring-1 ring-[#E8B7D0]" : "hover:bg-[#FFF0F7]"}`}>
              <HiOutlineBell className="h-6 w-6" />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E5484D] px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
          <button type="button" onClick={() => { setActivityOpen(false); onShowPromotions(); }} aria-label="Promotions" className="relative grid h-11 w-11 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30">
            <HiOutlineGift className="h-6 w-6" />
            {promotionCount > 0 && <span className="absolute right-1.5 top-1 rounded-full bg-[#D65A9A] px-1.5 text-[9px] font-bold text-white">{promotionCount}</span>}
          </button>
          <details className="group relative">
            <summary onClick={() => setActivityOpen(false)} className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 [&::-webkit-details-marker]:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-sm font-extrabold uppercase text-white sm:h-10 sm:w-10">
                {(name || "C").slice(0, 1)}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="max-w-28 truncate text-xs font-extrabold text-[#1F2937]">{name || "Customer"}</p>
                {email && <p className="max-w-28 truncate text-[10px] text-[#667085]">{email}</p>}
              </div>
              <HiChevronDown className="h-4 w-4 shrink-0 text-[#6B7280] transition group-open:rotate-180" />
            </summary>

            <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-48 rounded-xl border border-[#F3E8EF] bg-white p-2 shadow-[0_18px_45px_rgba(31,41,55,0.16)]">
              <button
                type="button"
                onClick={onLogout}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7] hover:text-[#C85B95] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
              >
                <HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" />
                Logout
              </button>
            </div>
          </details>
          {activityOpen && <ActivityMenu recentActivity={recentActivity} notifications={notifications} unreadCount={unreadCount} isLoading={isLoading} onClose={() => setActivityOpen(false)} onOpenHistory={onHistory} />}
        </div>
      </div>
    </header>
  );
}

function ActivityMenu({ recentActivity, notifications, unreadCount, isLoading, onClose, onOpenHistory }) {
  return (
    <div id="customer-activity-menu" role="dialog" aria-label="Activity and notifications" className="fixed inset-x-4 top-24 z-[80] flex max-h-[min(28rem,calc(100vh-7rem))] flex-col overflow-hidden rounded-2xl border border-[#E9D9E2] bg-white shadow-[0_24px_65px_rgba(31,41,55,0.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-[22rem]">
      <div className="flex items-center justify-between border-b border-[#F3E8EF] px-4 py-3">
        <div className="flex items-center gap-2"><p className="text-sm font-extrabold text-[#1F2937]">Notifications</p>{unreadCount > 0 && <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-extrabold text-[#B42318]">{unreadCount} new</span>}</div>
        <button type="button" onClick={onClose} aria-label="Close updates" className="grid h-8 w-8 place-items-center rounded-lg text-[#667085] transition hover:bg-[#FFF0F7] hover:text-[#C85B95]"><HiOutlineXMark className="h-5 w-5" /></button>
      </div>
      <div className="overflow-y-auto p-3">
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-3">
          {recentActivity.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C85B95]">Recent activity</p>
              <div className="rounded-xl bg-[#FFF8FB] px-3">
                {recentActivity.slice(0, 2).map((activity, index) => (
                  <RecentActivityCard key={activity.id} {...activity} isLast={index === Math.min(recentActivity.length, 2) - 1} />
                ))}
              </div>
            </div>
          )}
          {notifications.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C85B95]">Notifications</p>
              <div className="space-y-1 rounded-xl bg-[#FFF8FB] p-1">
                {notifications.slice(0, 3).map((notification) => (
                  <NotificationCard key={notification.id} type={notification.type} message={notification.message} timestamp={notification.timestamp} isRead={notification.is_read} onClick={notification.type === "receipt" ? () => { onClose(); onOpenHistory(); } : undefined} />
                ))}
              </div>
            </div>
          )}
          {!recentActivity.length && !notifications.length && (
            <p className="rounded-xl bg-[#FFF8FB] px-4 py-8 text-center text-sm text-[#6B7280]">No activity or notifications yet.</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function PromotionModal({ promotions, onClose, onBook }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#1F2937]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Promotions">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-[#FFF8FB] p-5 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} aria-label="Close promotions" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-[#1F2937] shadow-md transition hover:text-[#D65A9A]">
          <HiOutlineXMark className="h-6 w-6" />
        </button>
        <div className="mb-5 pr-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C85B95]">Special offers</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[#1F2937]">Happy Skin Promotions</h2>
        </div>
        {promotions.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {promotions.map((promo) => <PromotionCard key={promo.id} title={promo.title} subtitle={promo.subtitle || "Limited Offer"} image={promo.image} onBook={() => onBook(promo)} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E8C9D9] bg-white px-6 py-12 text-center">
            <HiOutlineGift className="mx-auto h-10 w-10 text-[#D65A9A]" />
            <p className="mt-3 font-bold text-[#1F2937]">No promotions right now</p>
            <p className="mt-1 text-sm text-[#6B7280]">Seasonal offers will appear here when available.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function getFirstName(value) {
  if (!value) return "";
  const cleanValue = String(value).trim();
  if (!cleanValue) return "";
  if (cleanValue.includes("@")) return cleanValue.split("@")[0];
  return cleanValue.split(/\s+/)[0];
}

function AllServiceCard({ service, onBook }) {
  const duration = Number(service.duration_minutes);
  const validDuration = Number.isFinite(duration) && duration > 0 && duration <= 1440;

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group flex min-h-36 overflow-hidden rounded-xl border border-[#E5E5E8] bg-white transition hover:border-[#DCA9C4] hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
    >
      <div className="relative w-[8.25rem] shrink-0 overflow-hidden bg-[#FFF0F7] sm:w-[9rem]">
        <img
          src={safeServiceImage(service.image)}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = SERVICE_FALLBACK_IMAGE; }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-4">
        <h4 className="line-clamp-2 text-base font-extrabold leading-snug text-[#151A2A] sm:text-lg">{service.name || "Salon service"}</h4>
        {service.branch_name && <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#7B8190]"><HiOutlineMapPin className="h-3.5 w-3.5 shrink-0 text-[#B94B86]" /><span className="truncate">{service.branch_name}</span></p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#98A2B3]">Starting at</p>
            <p className="text-base font-black text-[#A83F78]">{formatServicePrice(service.price)}</p>
          </div>
          {validDuration && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#667085]"><HiOutlineClock className="h-3.5 w-3.5 text-[#C85B95]" />{duration} min</span>}
        </div>
        <button type="button" onClick={onBook} className="mt-3 self-start text-xs font-extrabold text-[#A83F78] transition hover:text-[#7F285B] focus:outline-none focus-visible:underline">
          Book service <span aria-hidden="true">→</span>
        </button>
      </div>
    </motion.article>
  );
}

function CustomerBranchCard({ branch, selected, onSelect }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`flex h-full w-full flex-col rounded-[1.5rem] border bg-white p-5 text-left shadow-[0_12px_34px_rgba(31,41,55,0.055)] transition hover:shadow-[0_18px_44px_rgba(214,90,154,0.13)] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 ${selected ? "border-[#D65A9A] ring-4 ring-[#D65A9A]/10" : "border-[#F3E8EF]"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0F7] text-[#D65A9A]">
          <HiOutlineMapPin className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#1F2937]">{branch.name}</h3>
            {selected && <span className="rounded-full bg-[#C85B95] px-2.5 py-1 text-[10px] font-bold text-white">Selected</span>}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#6B7280]">{branch.address}</p>
        </div>
      </div>

      {branch.phone && (
        <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
          <HiOutlinePhone className="h-4 w-4 text-[#D65A9A]" /> {branch.phone}
        </span>
      )}

    </motion.button>
  );
}

function AllServicesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white">
          <div className="h-32 bg-[#F8DCEB]/60" />
          <div className="space-y-3 p-3.5">
            <div className="h-5 w-2/3 rounded bg-[#F8DCEB]/60" />
            <div className="h-3 w-full rounded bg-[#F8DCEB]/60" />
            <div className="h-3 w-4/5 rounded bg-[#F8DCEB]/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BranchListSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5">
          <div className="flex gap-3"><div className="h-11 w-11 rounded-xl bg-[#F8DCEB]/60" /><div className="flex-1 space-y-2"><div className="h-5 w-2/3 rounded bg-[#F8DCEB]/60" /><div className="h-3 w-full rounded bg-[#F8DCEB]/60" /></div></div>
          <div className="mt-6 h-20 rounded-xl bg-[#F8DCEB]/45" />
          <div className="mt-4 h-11 rounded-xl bg-[#F8DCEB]/60" />
        </div>
      ))}
    </div>
  );
}

function Section({ id, title, description, action, className = "", children }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{ duration: 0.45, ease: "easeOut" }}
      id={id}
      className={className}
    >
      {title && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><h2 className="text-lg font-bold text-[#1F2937] sm:text-xl">{title}</h2>{description && <p className="mt-1 max-w-2xl text-xs leading-5 text-[#667085] sm:text-sm">{description}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

