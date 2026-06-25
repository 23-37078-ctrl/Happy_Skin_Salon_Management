import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineGift,
  HiOutlineHeart,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineTicket,
  HiOutlineUserGroup,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

import BranchCard from "../../components/customer/BranchCard";
import EmptyState from "../../components/customer/EmptyState";
import HeroBanner from "../../components/customer/HeroBanner";
import NotificationCard from "../../components/customer/NotificationCard";
import PromotionCard from "../../components/customer/PromotionCard";
import QuickActionCard from "../../components/customer/QuickActionCard";
import RecentActivityCard from "../../components/customer/RecentActivityCard";
import RecommendedServiceCard from "../../components/customer/RecommendedServiceCard";
import UpcomingAppointmentCard from "../../components/customer/UpcomingAppointmentCard";

import {
  AppointmentCardSkeleton,
  CardRailSkeleton,
  HeroSkeleton,
  ListSkeleton,
  QuickActionsSkeleton,
} from "../../components/customer/Skeletons";

import {
  cancelAppointment,
  getCustomerDashboard,
} from "../../services/customerService";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback((signal) => {
    setIsLoading(true);
    setError(null);
    getCustomerDashboard(signal)
      .then((payload) => setData(payload))
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

  const handleCancelAppointment = async (appointmentId) => {
    try {
      await cancelAppointment(appointmentId);
      setData((prev) => ({ ...prev, upcoming_booking: null }));
    } catch {
      setError("Couldn't cancel that appointment. Please try again.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const quickActions = [
    {
      icon: HiOutlineCalendar,
      title: "Book Appointment",
      description: "Reserve your next visit.",
      onClick: () => navigate("/customer/book"),
    },
    {
      icon: HiOutlineSparkles,
      title: "Browse Services",
      description: "Explore treatments.",
      onClick: () => navigate("/customer/book"),
    },
    {
      icon: HiOutlineClock,
      title: "Booking History",
      description: "Review past visits.",
      onClick: () => navigate("/customer/history"),
    },
    {
      icon: HiOutlineStar,
      title: "Submit Feedback",
      description: "Share your rating.",
      onClick: () => navigate("/customer/feedback"),
    },
  ];

  const summaryCards = useMemo(() => {
    const totalVisits =
      data?.total_visits ??
      data?.stats?.total_visits ??
      data?.recent_activity?.filter((activity) => activity.type === "completed")
        ?.length ??
      0;
    const loyaltyPoints =
      data?.loyalty_points ?? data?.loyalty?.points ?? data?.user?.loyalty_points ?? 0;
    const upcomingBookings =
      data?.upcoming_bookings_count ??
      data?.stats?.upcoming_bookings ??
      (data?.upcoming_booking ? 1 : 0);
    const favoriteBranch =
      data?.favorite_branch?.name ?? data?.favorite_branch_name ?? "Not set";

    return [
      {
        icon: HiOutlineUserGroup,
        value: totalVisits,
        label: "Total Visits",
      },
      {
        icon: HiOutlineTicket,
        value: loyaltyPoints,
        label: "Loyalty Points",
      },
      {
        icon: HiOutlineCalendar,
        value: upcomingBookings,
        label: "Upcoming Bookings",
      },
      {
        icon: HiOutlineMapPin,
        value: favoriteBranch,
        label: "Favorite Branch",
      },
    ];
  }, [data]);

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
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <CustomerHeader
          name={customerFirstName}
          email={data?.user?.email || currentUser?.email}
          onLogout={handleLogout}
        />

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-[1.25rem] border border-[#EF4444]/20 bg-white px-4 py-3 text-sm text-[#B91C1C] shadow-sm">
            <HiOutlineExclamationTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => fetchDashboard()}
              className="font-bold text-[#D65A9A] underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <HeroSkeleton />
        ) : (
          <HeroBanner
            firstName={customerFirstName}
            upcoming={data?.upcoming_booking}
            onBook={() => navigate("/customer/book")}
            onBrowseServices={() => navigate("/customer/book")}
          />
        )}

        <Section className="mt-6">
          {isLoading ? (
            <SummarySkeleton />
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            >
              {summaryCards.map((card) => (
                <SummaryCard key={card.label} {...card} />
              ))}
            </motion.div>
          )}
        </Section>

        <Section className="mt-6" title="Quick Actions">
          {isLoading ? (
            <QuickActionsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action) => (
                <QuickActionCard key={action.title} {...action} />
              ))}
            </div>
          )}
        </Section>

        <Section className="mt-8">
          {isLoading ? (
            <AppointmentCardSkeleton />
          ) : (
            <UpcomingAppointmentCard
              appointment={data?.upcoming_booking}
              onBook={() => navigate("/customer/book")}
              onViewDetails={() =>
                navigate(`/bookings/${data?.upcoming_booking?.id}`)
              }
              onReschedule={() =>
                navigate(`/bookings/${data?.upcoming_booking?.id}/reschedule`)
              }
              onCancel={() =>
                handleCancelAppointment(data?.upcoming_booking?.id)
              }
            />
          )}
        </Section>

        <Section className="mt-10" title="Recommended Services">
          {isLoading ? (
            <CardRailSkeleton />
          ) : data?.recommended_services?.length ? (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
              {data.recommended_services.map((service) => (
                <div key={service.id} className="snap-start">
                  <RecommendedServiceCard
                    name={service.name}
                    image={service.image}
                    reason={service.reason}
                    onBook={() => navigate(`/customer/book?service=${service.id}`)}
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

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Section className="lg:col-span-2" title="Recent Activity">
            {isLoading ? (
              <ListSkeleton />
            ) : data?.recent_activity?.length ? (
              <div className="rounded-[2rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_16px_45px_rgba(31,41,55,0.06)] sm:p-6">
                {data.recent_activity.map((activity, idx) => (
                  <RecentActivityCard
                    key={activity.id}
                    type={activity.type}
                    description={activity.description}
                    timestamp={activity.timestamp}
                    isLast={idx === data.recent_activity.length - 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No activity yet"
                description="Bookings, payments, and feedback updates will collect here."
                icon={<HiOutlineClock className="h-9 w-9" />}
              />
            )}
          </Section>

          <Section
            title="Notifications"
            action={
              !isLoading &&
              data?.notifications?.length > 0 && (
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-xs font-bold text-[#D65A9A] hover:underline focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
                >
                  View all
                </button>
              )
            }
          >
            {isLoading ? (
              <ListSkeleton rows={3} />
            ) : data?.notifications?.length ? (
              <div className="space-y-1 rounded-[2rem] border border-[#F3E8EF] bg-white p-3 shadow-[0_16px_45px_rgba(31,41,55,0.06)]">
                {data.notifications.slice(0, 5).map((n) => (
                  <NotificationCard
                    key={n.id}
                    type={n.type}
                    message={n.message}
                    timestamp={n.timestamp}
                    isRead={n.is_read}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="You're all caught up"
                description="Booking reminders and salon offers will show up here."
                icon={<HiOutlineGift className="h-9 w-9" />}
              />
            )}
          </Section>
        </div>

        <Section className="mt-10" title="Favorite Branch">
          {isLoading ? (
            <CardRailSkeleton count={1} />
          ) : data?.favorite_branch ? (
            <BranchCard
              name={data.favorite_branch.name}
              image={data.favorite_branch.image}
              address={data.favorite_branch.address}
              hoursToday={data.favorite_branch.hours_today}
              isOpenNow={data.favorite_branch.is_open_now}
              rating={data.favorite_branch.rating}
              distance={data.favorite_branch.distance}
              onView={() => navigate(`/branches/${data.favorite_branch.id}`)}
              onBookHere={() =>
                navigate(`/customer/book?branch=${data.favorite_branch.id}`)
              }
            />
          ) : (
            <EmptyState
              title="No favorite branch set"
              description="After you book at a branch you love, it will be saved for faster visits."
              icon={<HiOutlineHeart className="h-9 w-9" />}
            />
          )}
        </Section>

        <Section className="mt-10" title="Promotions">
          {isLoading ? (
            <CardRailSkeleton count={2} />
          ) : data?.promotions?.length ? (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
              {data.promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="w-[19rem] min-w-[19rem] snap-start sm:w-[31rem] sm:min-w-[31rem]"
                >
                  <PromotionCard
                    title={promo.title}
                    subtitle={promo.subtitle || "Limited Offer"}
                    image={promo.image}
                  onBook={() => navigate("/customer/book")}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No promotions right now"
              description="Seasonal offers and limited packages will appear here when available."
              icon={<HiOutlineGift className="h-9 w-9" />}
            />
          )}
        </Section>
      </div>

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

function CustomerHeader({ name, email, onLogout }) {
  return (
    <header className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-[#F3E8EF] bg-white/86 px-4 py-4 shadow-[0_12px_34px_rgba(31,41,55,0.05)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-sm font-bold uppercase text-white shadow-[0_10px_24px_rgba(214,90,154,0.22)]">
          {(name || "C").slice(0, 1)}
        </div>
        <div>
          <p className="text-sm font-bold text-[#1F2937]">
            {name ? `${name}'s customer portal` : "Customer portal"}
          </p>
          {email && <p className="text-xs text-[#6B7280]">{email}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937] transition-all duration-300 hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
      >
        <HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" />
        Logout
      </button>
    </header>
  );
}

function getFirstName(value) {
  if (!value) return "";
  const cleanValue = String(value).trim();
  if (!cleanValue) return "";
  if (cleanValue.includes("@")) return cleanValue.split("@")[0];
  return cleanValue.split(/\s+/)[0];
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

function SummaryCard({ icon: Icon, value, label }) {
  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-32 flex-col justify-between rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)] transition-shadow duration-300 hover:shadow-[0_18px_44px_rgba(214,90,154,0.13)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F7] text-[#D65A9A]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="truncate text-xl font-bold text-[#1F2937]">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {label}
        </p>
      </div>
    </motion.article>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="min-h-32 animate-pulse rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4"
        >
          <div className="h-10 w-10 rounded-full bg-[#F8DCEB]/70" />
          <div className="mt-7 h-6 w-16 rounded-full bg-[#F8DCEB]/70" />
          <div className="mt-2 h-3 w-24 rounded-full bg-[#F8DCEB]/70" />
        </div>
      ))}
    </div>
  );
}
