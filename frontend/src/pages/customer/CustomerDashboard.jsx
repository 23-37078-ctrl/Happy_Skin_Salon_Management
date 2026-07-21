import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  HiArrowRight,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineBell,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineSparkles,
  HiOutlineHome,
  HiOutlineArrowRightOnRectangle,
  HiChevronDown,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

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
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          setError(
            "We couldn't load your dashboard right now. Please try again."
          );
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => fetchDashboard(controller.signal));
    return () => controller.abort();
  }, [fetchDashboard]);

  const handleLogout = () => {
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
  const openServiceBooking = (service) => {
    const parameters = new URLSearchParams();
    const branchId = Number(service?.branch_id);
    const serviceId = Number(service?.id);
    if (Number.isInteger(branchId) && branchId > 0) parameters.set("branch", String(branchId));
    if (Number.isInteger(serviceId) && serviceId > 0) parameters.set("service", String(serviceId));
    navigate(`/customer/book${parameters.size ? `?${parameters.toString()}` : ""}`);
  };

  const quickActions = [
    {
      icon: HiOutlineCalendar,
      title: "Book",
      description: "Request an appointment.",
      onClick: () => navigate("/customer/book"),
    },
    {
      icon: HiOutlineClock,
      title: "History",
      description: "Review past visits.",
      onClick: () => navigate("/customer/history"),
    },
  ];

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
          actions={quickActions}
          onLogout={handleLogout}
          recentActivity={data?.recent_activity || []}
          notifications={data?.notifications || []}
          isLoading={isLoading}
          onShowPromotions={() => setShowPromotions(true)}
          promotionCount={data?.promotions?.length || 0}
        />

        {error && <SystemPopup message={error} tone="error" onRetry={fetchDashboard} />}

        <Section
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

        <Section className="mt-10" title={selectedBranch ? `Recommended at ${selectedBranch.name}` : "Recommended for you"} description="A curated starting point with transparent pricing and appointment duration.">
          {isLoading ? (
            <CardRailSkeleton />
          ) : selectedServices.length ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-4 scroll-smooth">
              {selectedServices.slice(0, 4).map((service) => (
                <div key={service.id} className="w-[82vw] min-w-[17.5rem] max-w-[22rem] snap-start sm:w-[22rem]">
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

        <Section className="mt-10" title={selectedBranch ? `Explore services at ${selectedBranch.name}` : "Explore all services"} description="Compare services at your own pace. Availability is confirmed after you send a request.">
          {isLoading ? (
            <AllServicesSkeleton />
          ) : selectedServices.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedServices.map((service) => (
                <AllServiceCard
                  key={service.id}
                  service={service}
                  onBook={() => openServiceBooking(service)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No services available"
              description="Active salon services will appear here once they are added."
              icon={<HiOutlineSparkles className="h-9 w-9" />}
            />
          )}
        </Section>

      </div>

      <Footer />

      {showPromotions && (
        <PromotionModal promotions={data?.promotions || []} onClose={() => setShowPromotions(false)} onBook={() => navigate("/customer/book")} />
      )}

      <motion.button
        onClick={() => navigate("/customer/book")}
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Book appointment"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-white shadow-[0_18px_40px_rgba(214,90,154,0.42)] transition-all focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/35 focus:ring-offset-2 sm:bottom-7 sm:right-7 sm:h-16 sm:w-16"
      >
        <HiOutlineCalendar className="h-6 w-6" />
      </motion.button>
    </main>
  );
}

function CustomerHeader({ name, email, actions, onLogout, recentActivity, notifications, isLoading, onShowPromotions, promotionCount }) {
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

        <nav className="order-3 col-span-2 grid grid-cols-3 gap-1 border-t border-[#F3E8EF] pt-3 lg:order-none lg:col-span-1 lg:mx-auto lg:flex lg:w-fit lg:border-0 lg:bg-[#FFF8FB] lg:p-1" aria-label="Customer navigation">
          <button type="button" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-3 text-xs font-extrabold text-white shadow-sm focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 sm:text-sm"><HiOutlineHome className="h-5 w-5" />Home</button>
            {actions.map(({ icon: Icon, title, onClick }) => (
              <button key={title} type="button" onClick={onClick} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold text-[#667085] transition hover:bg-[#FFF0F7] hover:text-[#A34777] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 sm:text-sm">
                <Icon className="h-5 w-5 shrink-0" />{title}
              </button>
            ))}
        </nav>

        <div ref={activityRef} className="relative flex shrink-0 items-center justify-self-end gap-0.5">
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
          {activityOpen && <ActivityMenu recentActivity={recentActivity} notifications={notifications} unreadCount={unreadCount} isLoading={isLoading} onClose={() => setActivityOpen(false)} />}
        </div>
      </div>
    </header>
  );
}

function ActivityMenu({ recentActivity, notifications, unreadCount, isLoading, onClose }) {
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
                  <NotificationCard key={notification.id} type={notification.type} message={notification.message} timestamp={notification.timestamp} isRead={notification.is_read} />
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
            {promotions.map((promo) => <PromotionCard key={promo.id} title={promo.title} subtitle={promo.subtitle || "Limited Offer"} image={promo.image} onBook={onBook} />)}
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
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[#ECDDE5] bg-white shadow-[0_10px_28px_rgba(31,41,55,0.05)] transition hover:border-[#DCA9C4] hover:shadow-[0_16px_38px_rgba(214,90,154,0.11)]"
    >
      <div className="relative h-40 overflow-hidden bg-[#FFF0F7]">
        <img
          src={safeServiceImage(service.image)}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = SERVICE_FALLBACK_IMAGE; }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {validDuration && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#475467] shadow-sm backdrop-blur"><HiOutlineClock className="h-4 w-4 text-[#C85B95]" />{duration} min</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {service.branch_name && <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#A34777]"><HiOutlineMapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{service.branch_name}</span></p>}
        <h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-snug text-[#202534]">{service.name || "Salon service"}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#667085]">
          {service.description || "Professional salon care from Happy Skin."}
        </p>
        <div className="mt-auto pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#98A2B3]">Starting at</p>
          <p className="mt-0.5 text-lg font-black text-[#A83F78]">{formatServicePrice(service.price)}</p>
          <button type="button" onClick={onBook} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D9A4BF] bg-white px-3 py-2 text-xs font-extrabold text-[#A83F78] transition hover:border-[#B94B86] hover:bg-[#FFF3F8] focus:outline-none focus:ring-4 focus:ring-[#B94B86]/15">
            Check availability <HiArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function CustomerBranchCard({ branch, selected, onSelect }) {
  const services = branch.services || [];
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

      <div className="mt-5 border-t border-[#F3E8EF] pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Services offered</p>
          <span className="text-[11px] font-semibold text-[#6B7280]">{services.length} available</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {services.slice(0, 4).map((service) => (
            <span key={service.id} className="rounded-full bg-[#FFF0F7] px-2.5 py-1 text-[10px] font-semibold text-[#9D3C70]">
              {service.name}
            </span>
          ))}
          {services.length > 4 && (
            <span className="rounded-full bg-[#F4F4F5] px-2.5 py-1 text-[10px] font-semibold text-[#6B7280]">
              +{services.length - 4} more
            </span>
          )}
        </div>
      </div>
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

function Section({ title, description, action, className = "", children }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{ duration: 0.45, ease: "easeOut" }}
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

