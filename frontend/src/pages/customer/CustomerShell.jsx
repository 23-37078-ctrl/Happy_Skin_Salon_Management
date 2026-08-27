import { useNavigate } from "react-router-dom";
import {
  HiChevronDown,
  HiOutlineArrowLeft,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import SystemPopup from "../../components/common/SystemPopup";

export function CustomerShell({ title, subtitle, stats, showHeading = true, backTo, backBesideLogo = false, children }) {
  const navigate = useNavigate();
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
            <div className="flex min-w-0 items-center gap-2">{backBesideLogo && backTo && <button type="button" onClick={() => navigate(backTo)} aria-label="Back to customer dashboard" title="Back to dashboard" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E8B7D0] bg-[#FFF0F7] text-[#C9558F] shadow-sm transition hover:border-[#D65A9A] hover:bg-[#FCE5F1] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15"><HiOutlineArrowLeft className="h-5 w-5" strokeWidth={2.25} /></button>}<div className="flex min-w-0 items-center gap-3 text-left">
              <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#F8DCEB] sm:h-12 sm:w-12" />
              <div className="min-w-0"><p className="truncate font-extrabold leading-tight text-[#1F2A44]">Happy Skin</p><p className="text-[10px] font-medium text-[#667085]">Customer Portal</p></div>
            </div></div>

            {stats?.length ? <div className="hidden min-w-0 grid-cols-3 gap-2 lg:grid lg:w-full lg:max-w-xl lg:justify-self-center">{stats.map((stat) => <div key={stat.label} className="rounded-xl bg-[#FFF8FB] px-3 py-2 text-center ring-1 ring-[#F3E8EF]"><p className="text-lg font-extrabold leading-tight text-[#1F2937]">{stat.value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#C85B95]">{stat.label}</p></div>)}</div> : <div className="hidden lg:block" />}

            <div className="flex items-center justify-self-end gap-1"><details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#D65A9A]/15 [&::-webkit-details-marker]:hidden">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#D65A9A] to-[#C85B95] text-sm font-extrabold text-white sm:h-10 sm:w-10">{displayName.slice(0, 1).toUpperCase()}</span>
                <span className="hidden min-w-0 text-left sm:block"><span className="block max-w-28 truncate text-xs font-extrabold text-[#1F2937]">{displayName}</span><span className="block max-w-28 truncate text-[10px] text-[#667085]">{currentUser?.email}</span></span>
                <HiChevronDown className="h-4 w-4 text-[#667085] transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-xl border border-[#F3E8EF] bg-white p-2 shadow-[0_18px_45px_rgba(31,41,55,0.16)]"><button type="button" onClick={handleLogout} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7] hover:text-[#C85B95]"><HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" /> Logout</button></div>
            </details></div>
          </div>

          {stats?.length ? <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#F3E8EF] pt-3 lg:hidden">
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
