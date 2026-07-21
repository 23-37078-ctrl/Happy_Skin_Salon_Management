import { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowLeftOnRectangle,
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineHome,
  HiOutlineBars3,
  HiOutlineXMark,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import { getFirstName, statusStyles } from "./staffWorkspaceUtils";
import SystemPopup from "../../components/common/SystemPopup";

const navItems = [
  { to: "/staff/dashboard", label: "Dashboard", icon: HiOutlineHome },
  { to: "/staff/bookings", label: "Bookings", icon: HiOutlineCalendarDays },
  { to: "/staff/transactions", label: "Transactions", icon: HiOutlineBanknotes },
];

export function StaffWorkspace({ children, title, eyebrow, actions, brandOnly = false, headerStats, identity }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const firstName = useMemo(() => getFirstName(currentUser?.full_name || currentUser?.email), [currentUser]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#FFF8FB] text-[#1F2937]" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {sidebarOpen && <button type="button" aria-label="Close staff menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-[#1F2937]/40 backdrop-blur-sm" />}
      <div className="flex min-h-screen w-full max-w-none flex-col px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className={`fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] transform p-3 transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col rounded-[1.5rem] border border-[#F3E8EF] bg-white/90 p-4 shadow-[0_18px_50px_rgba(31,41,55,0.07)] backdrop-blur">
            <div className="flex items-center gap-1"><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close staff menu" className="grid h-10 w-10 place-items-center rounded-xl text-[#D65A9A] hover:bg-[#FFF0F7]"><HiOutlineXMark className="h-6 w-6" /></button>
            <Link to="/staff/dashboard" onClick={() => setSidebarOpen(false)} className="flex flex-1 items-center gap-3 rounded-2xl px-2 py-2">
              <img
                src="/images/happy-skin-logo.svg"
                alt="Happy Skin Aesthetic and Nails Beauty Lounge"
                className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-[#F8DCEB]"
              />
              <span>
                <span className="block text-sm font-bold text-[#1F2937]">Happy Skin</span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#D65A9A]">Staff Desk</span>
              </span>
            </Link>
            </div>

            <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1" aria-label="Staff navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
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
              <p className="mt-1 truncate text-sm font-bold text-[#1F2937]">{currentUser?.full_name || firstName || "Staff"}</p>
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

        <section className="w-full min-w-0 flex-1 py-5 lg:py-0">
          <header className="mb-5 flex min-h-28 w-full flex-col gap-4 rounded-[1.5rem] border border-[#F3E8EF] bg-white/86 px-4 py-4 shadow-[0_12px_34px_rgba(31,41,55,0.05)] backdrop-blur sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label="Toggle staff sidebar" className="grid h-12 w-12 place-items-center rounded-xl text-[#D65A9A] hover:bg-[#FFF0F7]"><HiOutlineBars3 className="h-7 w-7" /></button>
              {brandOnly ? <Link to="/staff/dashboard" className="flex shrink-0 items-center gap-3"><img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-14 w-14 rounded-full ring-2 ring-[#F8DCEB]" /><span><span className="block text-base font-bold text-[#1F2937]">Happy Skin</span><span className="block text-xs text-[#6B7280]">Staff Portal</span></span></Link> : <div>{eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-[#D65A9A]">{eyebrow}</p>}<h1 className="mt-1 text-2xl font-bold text-[#1F2937] sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h1></div>}
            </div>
            {headerStats?.length > 0 && (
              <div className="grid w-full flex-1 grid-cols-2 gap-3 md:grid-cols-4 xl:mx-5">
                {headerStats.map(({ icon: Icon, label, value, tone = "pink" }) => {
                  const colors = { pink: "bg-[#FFF0F7] text-[#D65A9A]", green: "bg-[#DCFCE7] text-[#16A34A]", blue: "bg-[#DBEAFE] text-[#2563EB]", amber: "bg-[#FEF3C7] text-[#D97706]" };
                  return <div key={label} className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-[#FFF8FB] px-3 py-2.5 ring-1 ring-[#F3E8EF]"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colors[tone] || colors.pink}`}><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate text-base font-extrabold leading-tight text-[#1F2937]">{value}</span><span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">{label}</span></span></div>;
                })}
              </div>
            )}
            {brandOnly && identity && (
              <div className="flex min-w-0 items-center gap-3 border-t border-[#F3E8EF] pt-3 xl:max-w-56 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#D65A9A] text-sm font-extrabold text-white">{(identity.staff_name || "S").charAt(0).toUpperCase()}</span>
                <span className="min-w-0 text-left"><span className="block truncate text-sm font-bold text-[#1F2937]">{identity.staff_name}</span><span className="block truncate text-[10px] font-semibold text-[#C85B95]">{identity.job_title}</span><span className="block truncate text-[10px] text-[#6B7280]">{identity.branch_name}</span></span>
              </div>
            )}
            {actions && <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none xl:w-auto">{actions}</div>}
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

export function StatusBadge({ status }) {
  const cleanStatus = status || "pending";
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[cleanStatus] || statusStyles.pending}`}>
      {cleanStatus}
    </span>
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

export function ErrorNotice({ message, onRetry }) {
  return <SystemPopup message={message} tone="error" onRetry={onRetry} />;
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
