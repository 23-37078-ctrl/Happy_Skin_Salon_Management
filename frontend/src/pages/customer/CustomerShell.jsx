import { useLocation, useNavigate } from "react-router-dom";
import {
  HiChevronDown,
  HiOutlineArrowLeft,
  HiOutlineArrowRightOnRectangle,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineHome,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import SystemPopup from "../../components/common/SystemPopup";

const CUSTOMER_NAVIGATION = [
  { label: "Home", to: "/customer/dashboard", icon: HiOutlineHome },
  { label: "Book", to: "/customer/book", icon: HiOutlineCalendarDays },
  { label: "History", to: "/customer/history", icon: HiOutlineClock },
];

export function CustomerShell({ title, subtitle, stats, showHeading = true, backTo, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const displayName = currentUser?.first_name || currentUser?.full_name || currentUser?.name || currentUser?.email?.split("@")[0] || "Customer";
  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#FFF8FB]">
      <div className="w-full max-w-none px-4 py-4 sm:px-6 lg:px-8">
        <header className="relative z-40 mb-5 overflow-visible rounded-[1.5rem] border border-[#F0E3EA] bg-white px-4 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.05)] sm:px-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <button type="button" onClick={() => navigate("/customer/dashboard")} className="flex min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D65A9A]/15">
              <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#F8DCEB] sm:h-12 sm:w-12" />
              <div className="min-w-0"><p className="truncate font-extrabold leading-tight text-[#1F2A44]">Happy Skin</p><p className="text-[10px] font-medium text-[#667085]">Customer Portal</p></div>
            </button>

            <nav aria-label="Customer navigation" className="order-3 col-span-2 grid grid-cols-3 gap-1 border-t border-[#F3E8EF] pt-3 lg:order-none lg:col-span-1 lg:mx-auto lg:flex lg:w-fit lg:border-0 lg:bg-[#FFF8FB] lg:p-1">
              {CUSTOMER_NAVIGATION.map(({ label, to, icon: Icon }) => {
                const active = location.pathname === to;
                return <button key={to} type="button" onClick={() => navigate(to)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 sm:text-sm ${active ? "bg-[#C85B95] text-white shadow-sm" : "text-[#667085] hover:bg-[#FFF0F7] hover:text-[#A34777]"}`}><Icon className="h-5 w-5" />{label}</button>;
              })}
            </nav>

            <details className="group relative justify-self-end">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 [&::-webkit-details-marker]:hidden">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-sm font-extrabold text-white sm:h-10 sm:w-10">{displayName.slice(0, 1).toUpperCase()}</span>
                <span className="hidden min-w-0 text-left sm:block"><span className="block max-w-28 truncate text-xs font-extrabold text-[#1F2937]">{displayName}</span><span className="block max-w-28 truncate text-[10px] text-[#667085]">{currentUser?.email}</span></span>
                <HiChevronDown className="h-4 w-4 text-[#667085] transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-xl border border-[#F3E8EF] bg-white p-2 shadow-[0_18px_45px_rgba(31,41,55,0.16)]"><button type="button" onClick={handleLogout} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7] hover:text-[#C85B95]"><HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" /> Logout</button></div>
            </details>
          </div>

          {stats?.length ? <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#F3E8EF] pt-3 lg:mx-auto lg:max-w-xl">
            {stats.map((stat) => <div key={stat.label} className="rounded-xl bg-[#FFF8FB] px-3 py-2 text-center ring-1 ring-[#F3E8EF]"><p className="text-lg font-extrabold leading-tight text-[#1F2937]">{stat.value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#C85B95]">{stat.label}</p></div>)}
          </div> : null}

          {showHeading && <div className="mt-4 flex items-start gap-3 border-t border-[#F3E8EF] pt-4">{backTo && <button type="button" onClick={() => navigate(backTo)} aria-label="Go back" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15"><HiOutlineArrowLeft className="h-5 w-5" /></button>}<div><p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Customer portal</p><h1 className="mt-1 text-2xl font-extrabold text-[#1F2937]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>}</div></div>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Notice({ tone = "error", children }) {
  return <SystemPopup tone={tone}>{children}</SystemPopup>;
}
