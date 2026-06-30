import { useMemo } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeftOnRectangle,
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineCube,
  HiOutlineHome,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineUserCircle,
  HiOutlineUsers,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import { getFirstName, statusStyles } from "../staff/staffWorkspaceUtils";

const navItems = [
  { to: "/manager/dashboard", label: "Dashboard", icon: HiOutlineHome },
  { to: "/manager/bookings", label: "Bookings", icon: HiOutlineCalendarDays },
  { to: "/manager/transactions", label: "Sales", icon: HiOutlineBanknotes },
  { to: "/manager/inventory", label: "Inventory", icon: HiOutlineCube },
  { to: "/manager/reports", label: "Reports", icon: HiOutlineChartBar },
  { to: "/manager/staff", label: "Forecasting", icon: HiOutlineUsers },
  { to: "/manager/feedback", label: "Feedback", icon: HiOutlineStar },
  { to: "/manager/profile", label: "Profile", icon: HiOutlineUserCircle },
];

export function ManagerWorkspace({ children, title, eyebrow, actions }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const firstName = useMemo(() => getFirstName(currentUser?.full_name || currentUser?.email), [currentUser]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#FFF8FB] text-[#1F2937]" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:flex-shrink-0">
          <div className="flex h-full flex-col rounded-[1.5rem] border border-[#F3E8EF] bg-white/90 p-4 shadow-[0_18px_50px_rgba(31,41,55,0.07)] backdrop-blur">
            <Link to="/manager/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-white shadow-[0_12px_26px_rgba(214,90,154,0.28)]">
                <HiOutlineSparkles className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#1F2937]">Happy Skin</span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#D65A9A]">Manager Panel</span>
              </span>
            </Link>

            <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1" aria-label="Manager navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold transition-all ${
                      isActive
                        ? "bg-[#FFF0F7] text-[#C85B95] shadow-[inset_0_0_0_1px_rgba(214,90,154,0.12)]"
                        : "text-[#6B7280] hover:bg-[#FFF8FB] hover:text-[#1F2937]"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-5 rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-4 lg:mt-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#D65A9A]">Signed in as</p>
              <p className="mt-1 truncate text-sm font-bold text-[#1F2937]">{currentUser?.full_name || firstName || "Manager"}</p>
              <p className="mt-1 truncate text-xs text-[#6B7280]">{currentUser?.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
              >
                <HiOutlineArrowLeftOnRectangle className="h-5 w-5 text-[#D65A9A]" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 py-5 lg:py-0">
          <header className="mb-5 flex flex-col gap-4 rounded-[1.5rem] border border-[#F3E8EF] bg-white/86 px-5 py-5 shadow-[0_12px_34px_rgba(31,41,55,0.05)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              {eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">{eyebrow}</p>}
              <h1 className="mt-1 text-2xl font-bold text-[#1F2937] sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                {title}
              </h1>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}

export function StatusBadge({ status }) {
  const cleanStatus = status || "pending";
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[cleanStatus] || statusStyles.pending}`}>
      {cleanStatus}
    </span>
  );
}

export function StatCard({ icon: Icon = HiOutlineChartBar, label, value, tone = "pink", helper }) {
  const tones = {
    pink: "bg-[#FFF0F7] text-[#D65A9A]",
    blue: "bg-[#DBEAFE] text-[#2563EB]",
    green: "bg-[#DCFCE7] text-[#16A34A]",
    amber: "bg-[#FEF3C7] text-[#D97706]",
    red: "bg-[#FEE2E2] text-[#DC2626]",
  };

  return (
    <article className="min-h-32 rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.pink}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 truncate text-2xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      {helper && <p className="mt-2 text-xs text-[#9CA3AF]">{helper}</p>}
    </article>
  );
}

export function EmptyState({ icon: Icon = HiOutlineClipboardDocumentList, title, description }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-[#E8B7D0] bg-white/70 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#D65A9A]">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-[#1F2937]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  );
}

export function Notice({ message, tone = "error", onRetry }) {
  const color = tone === "success" ? "text-[#166534] border-[#22C55E]/20" : "text-[#B91C1C] border-[#EF4444]/20";
  return (
    <div className={`mb-5 flex flex-col gap-3 rounded-[1.25rem] border bg-white px-4 py-3 text-sm font-semibold shadow-sm sm:flex-row sm:items-center ${color}`}>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-bold text-[#D65A9A] underline underline-offset-4">
          Retry
        </button>
      )}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4">
          <div className="h-4 w-2/5 rounded-full bg-[#F8DCEB]" />
          <div className="mt-4 h-3 w-3/5 rounded-full bg-[#F8DCEB]" />
          <div className="mt-3 h-3 w-1/3 rounded-full bg-[#F8DCEB]" />
        </div>
      ))}
    </div>
  );
}
