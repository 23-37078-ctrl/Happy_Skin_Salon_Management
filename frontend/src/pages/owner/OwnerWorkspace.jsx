import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeftOnRectangle,
  HiOutlineBanknotes,
  HiOutlineBuildingStorefront,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineHome,
  HiOutlinePresentationChartLine,
  HiOutlineShieldCheck,
  HiOutlineUsers,
  HiOutlineBars3,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import { getFirstName, statusStyles } from "../staff/staffWorkspaceUtils";
import SystemPopup from "../../components/common/SystemPopup";

const navItems = [
  { to: "/owner/dashboard", label: "Dashboard", icon: HiOutlineHome },
  { to: "/owner/branches", label: "Branches", icon: HiOutlineBuildingStorefront },
  { to: "/owner/users", label: "Users", icon: HiOutlineUsers },
  { to: "/owner/bookings", label: "Bookings", icon: HiOutlineCalendarDays },
  { to: "/owner/transactions", label: "Transactions", icon: HiOutlineBanknotes },
  { to: "/owner/reports", label: "Reports", icon: HiOutlineChartBar },
  { to: "/owner/forecasting", label: "Forecasting", icon: HiOutlinePresentationChartLine },
  { to: "/owner/workforce", label: "Workforce", icon: HiOutlineShieldCheck },
  { to: "/owner/audit-logs", label: "Audit Logs", icon: HiOutlineClipboardDocumentList },
];

export function OwnerWorkspace({ children, title, eyebrow, actions, brandOnly = false }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const firstName = useMemo(() => getFirstName(currentUser?.full_name || currentUser?.email), [currentUser]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#FFF8FB] text-[#1F2937]" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {sidebarOpen && <button type="button" aria-label="Close owner menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-[#1F2937]/45 backdrop-blur-sm lg:hidden" />}
      <div className="mx-auto flex min-h-screen w-full max-w-[110rem] px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-5 lg:gap-5 lg:px-6 xl:gap-7 xl:px-8">
        <aside aria-label="Owner menu" className={`fixed inset-y-0 left-0 z-50 w-[min(19rem,88vw)] transform p-3 transition-transform duration-300 ease-out lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-64 lg:flex-none lg:translate-x-0 lg:p-0 xl:w-72 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col overflow-hidden rounded-r-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_18px_50px_rgba(31,41,55,0.09)] sm:rounded-[1.5rem] lg:bg-white/92 lg:shadow-[0_18px_50px_rgba(31,41,55,0.07)] lg:backdrop-blur">
            <div className="flex items-center gap-1"><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close owner menu" className="grid h-11 w-11 place-items-center rounded-xl text-[#D65A9A] hover:bg-[#FFF0F7] lg:hidden"><HiOutlineXMark className="h-6 w-6" /></button>
            <Link to="/owner/dashboard" onClick={() => setSidebarOpen(false)} className="flex flex-1 items-center gap-3 rounded-2xl px-2 py-2">
              <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-[#F8DCEB]" />
              <span>
                <span className="block text-sm font-bold text-[#1F2937]">Happy Skin</span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#D65A9A]">Admin Portal</span>
              </span>
            </Link>
            </div>

            <nav className="mt-5 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1" aria-label="Owner navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                      isActive ? "bg-[#FFF0F7] text-[#C85B95] shadow-[inset_0_0_0_1px_rgba(214,90,154,0.12)]" : "text-[#6B7280] hover:bg-[#FFF8FB] hover:text-[#1F2937]"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-4 rounded-2xl border border-[#F3E8EF] bg-[#FFF8FB] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#D65A9A]">Signed in as</p>
              <p className="mt-1 truncate text-sm font-bold text-[#1F2937]">{currentUser?.full_name || firstName || "Owner"}</p>
              <p className="mt-1 truncate text-xs text-[#6B7280]">{currentUser?.email}</p>
              <button type="button" onClick={handleLogout} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7]">
                <HiOutlineArrowLeftOnRectangle className="h-5 w-5 text-[#D65A9A]" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <section className="w-full min-w-0 flex-1 lg:py-5">
          <header className="sticky top-2 z-30 mb-4 flex w-full flex-col gap-3 rounded-[1.25rem] border border-[#F3E8EF] bg-white/95 px-3 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.07)] backdrop-blur-xl sm:mb-5 sm:px-5 sm:py-4 lg:static lg:flex-row lg:items-center lg:justify-between lg:rounded-[1.5rem]">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open owner menu" aria-expanded={sidebarOpen} className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30 lg:hidden"><HiOutlineBars3 className="h-7 w-7" /></button>
              {brandOnly ? <Link to="/owner/dashboard" className="flex min-w-0 items-center gap-3"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-11 w-11 flex-none rounded-full ring-2 ring-[#F8DCEB] sm:h-12 sm:w-12" /><span className="min-w-0"><span className="block truncate text-sm font-bold">Happy Skin</span><span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[#D65A9A]">Admin Portal</span></span></Link> : <div className="min-w-0">{eyebrow && <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#D65A9A] sm:text-xs">{eyebrow}</p>}<h1 className="mt-0.5 truncate text-xl font-bold text-[#1F2937] sm:mt-1 sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h1></div>}
            </div>
            {actions && <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 sm:flex sm:flex-wrap sm:[&>*]:flex-none lg:w-auto [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
          </header>
          {children}
        </section>
      </div>
    </main>
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
    <article className="min-w-0 rounded-[1.1rem] border border-[#F3E8EF] bg-white p-3.5 shadow-[0_12px_34px_rgba(31,41,55,0.055)] sm:min-h-32 sm:rounded-[1.25rem] sm:p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${tones[tone] || tones.pink}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-3 truncate text-xl font-bold text-[#1F2937] sm:mt-5 sm:text-2xl" title={String(value)}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      {helper && <p className="mt-2 text-xs text-[#9CA3AF]">{helper}</p>}
    </article>
  );
}

export function StatusBadge({ status }) {
  const cleanStatus = status || "pending";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[cleanStatus] || statusStyles.pending}`}>{cleanStatus}</span>;
}

export function EmptyState({ icon: Icon = HiOutlineClipboardDocumentList, title, description }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-[#E8B7D0] bg-white/70 px-4 py-7 text-center sm:p-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#D65A9A]"><Icon className="h-6 w-6" /></span>
      <h2 className="mt-4 text-base font-bold text-[#1F2937]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  );
}

export function Notice({ message, tone = "error", onRetry }) {
  return <SystemPopup message={message} tone={tone} onRetry={onRetry} />;
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
