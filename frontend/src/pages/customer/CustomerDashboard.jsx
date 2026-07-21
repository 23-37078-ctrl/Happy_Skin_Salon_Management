import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineBell,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineSparkles,
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

  const quickActions = [
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

        <Section className="mt-10" title={`Suggested for You${selectedBranch ? ` at ${selectedBranch.name}` : " from All Branches"}`}>
          {isLoading ? (
            <CardRailSkeleton />
          ) : selectedServices.length ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-4 scroll-smooth">
              {selectedServices.map((service) => (
                <div key={service.id} className="w-[18rem] min-w-[18rem] snap-start sm:w-[22rem] sm:min-w-[22rem]">
                  <RecommendedServiceCard
                    name={service.name}
                    image={service.image}
                    reason={service.reason}
                    branchName={service.branch_name}
                    onBook={() => navigate(`/customer/book?branch=${service.branch_id}&service=${service.id}`)}
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

        <Section className="mt-10" title={selectedBranch ? `Services at ${selectedBranch.name}` : "All Services from Every Branch"}>
          {isLoading ? (
            <AllServicesSkeleton />
          ) : selectedServices.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {selectedServices.map((service) => (
                <AllServiceCard
                  key={service.id}
                  service={service}
                  onBook={() => navigate(`/customer/book?branch=${service.branch_id}&service=${service.id}`)}
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
  return (
    <header className="mb-6 rounded-[1.5rem] border border-[#F3E8EF] bg-white/90 px-4 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.05)] backdrop-blur lg:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex shrink-0 items-center gap-2">
        <button type="button" className="flex items-center gap-3 text-left" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img
            src="/images/happy-skin-logo.svg"
            alt="Happy Skin"
            className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-[#F8DCEB]"
          />
          <div>
            <p className="font-bold leading-tight text-[#1F2A44]">Happy Skin</p>
            <p className="text-[10px] text-[#6B7280]">Customer Portal</p>
          </div>
        </button>
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-1 border-t border-[#F3E8EF] pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <nav className="flex items-center" aria-label="Customer actions">
            {actions.map(({ icon: Icon, title, onClick }) => (
              <button key={title} type="button" onClick={onClick} aria-label={title} title={title} className="group grid h-11 w-11 place-items-center rounded-xl text-[#1F2937] transition hover:bg-[#FFF0F7] hover:text-[#C85B95] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30">
                <Icon className="h-5 w-5 shrink-0 text-[#D65A9A]" />
                <span className="sr-only">{title}</span>
              </button>
            ))}
          </nav>
          <details className="group relative">
            <summary aria-label="Activity and notifications" className="relative grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30 [&::-webkit-details-marker]:hidden">
              <HiOutlineBell className="h-6 w-6" />
              {notifications.some((item) => !item.is_read) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D65A9A] ring-2 ring-white" />}
            </summary>
            <ActivityMenu recentActivity={recentActivity} notifications={notifications} isLoading={isLoading} />
          </details>
          <button type="button" onClick={onShowPromotions} aria-label="Promotions" className="relative grid h-11 w-11 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30">
            <HiOutlineGift className="h-6 w-6" />
            {promotionCount > 0 && <span className="absolute right-1.5 top-1 rounded-full bg-[#D65A9A] px-1.5 text-[9px] font-bold text-white">{promotionCount}</span>}
          </button>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30 [&::-webkit-details-marker]:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-sm font-bold uppercase text-white shadow-[0_8px_20px_rgba(214,90,154,0.2)]">
                {(name || "C").slice(0, 1)}
              </div>
              <div className="min-w-0 text-left">
                <p className="max-w-32 truncate text-xs font-bold text-[#1F2937]">{name || "Customer"}</p>
                {email && <p className="max-w-32 truncate text-[10px] text-[#6B7280]">{email}</p>}
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
        </div>
      </div>
    </header>
  );
}

function ActivityMenu({ recentActivity, notifications, isLoading }) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 max-h-[32rem] w-[min(90vw,25rem)] overflow-y-auto rounded-2xl border border-[#F3E8EF] bg-white p-3 shadow-[0_22px_55px_rgba(31,41,55,0.18)]">
      <p className="px-2 pb-2 text-sm font-extrabold text-[#1F2937]">Activity & Notifications</p>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-3">
          {recentActivity.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C85B95]">Recent activity</p>
              <div className="rounded-xl bg-[#FFF8FB] px-3">
                {recentActivity.slice(0, 4).map((activity, index) => (
                  <RecentActivityCard key={activity.id} {...activity} isLast={index === Math.min(recentActivity.length, 4) - 1} />
                ))}
              </div>
            </div>
          )}
          {notifications.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C85B95]">Notifications</p>
              <div className="space-y-1 rounded-xl bg-[#FFF8FB] p-1">
                {notifications.slice(0, 4).map((notification) => (
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
  return (
    <motion.button
      type="button"
      onClick={onBook}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="group overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white text-left shadow-[0_10px_28px_rgba(31,41,55,0.05)] transition-shadow hover:border-[#D65A9A]/30 hover:shadow-[0_16px_38px_rgba(214,90,154,0.12)] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15"
    >
      <div className="h-32 overflow-hidden bg-[#FFF0F7]">
        <img
          src={service.image || "/images/services/signature-facial.jpg"}
          alt={service.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex min-h-44 flex-col p-3.5">
        <h3 className="line-clamp-1 text-sm font-bold text-[#1F2937]">{service.name}</h3>
        {service.branch_name && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#C85B95]"><HiOutlineMapPin className="h-3 w-3" /> <span className="truncate">{service.branch_name}</span></p>}
        <p className="mt-2 line-clamp-2 text-[11px] leading-[1.1rem] text-[#6B7280]">
          {service.description || "Professional salon care from Happy Skin."}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#6B7280]">
            <HiOutlineClock className="h-3.5 w-3.5 text-[#D65A9A]" />
            {service.duration_minutes || 0} min
          </span>
          <span className="font-extrabold text-[#C85B95]">
            PHP {Number(service.price || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </motion.button>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
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

function Section({ title, action, className = "", children }) {
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
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#1F2937] sm:text-xl">
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

