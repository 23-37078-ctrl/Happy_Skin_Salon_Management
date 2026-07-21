import { useNavigate } from "react-router-dom";
import { HiChevronDown, HiOutlineArrowLeft, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { useAuth } from "../../hooks/useAuth";
import SystemPopup from "../../components/common/SystemPopup";

export function CustomerShell({ title, subtitle, stats, showHeading = true, backTo, children }) {
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
        <header className="mb-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white px-4 py-3 shadow-[0_12px_34px_rgba(31,41,55,0.05)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              {backTo && <button type="button" onClick={() => navigate(backTo)} aria-label="Back to dashboard" title="Back to dashboard" className="grid h-10 w-10 place-items-center rounded-xl text-[#D65A9A] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"><HiOutlineArrowLeft className="h-6 w-6" /></button>}
              <button type="button" onClick={() => navigate("/customer/dashboard")} className="flex items-center gap-3 text-left">
                <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-12 w-12 rounded-full object-cover ring-2 ring-[#F8DCEB]" />
                <div><p className="font-bold leading-tight text-[#1F2A44]">Happy Skin</p><p className="text-[10px] text-[#6B7280]">Customer Portal</p></div>
              </button>
            </div>
            {stats?.length ? (
              <div className="grid flex-1 grid-cols-3 gap-2 lg:mx-5 lg:max-w-xl">
                {stats.map((stat) => <div key={stat.label} className="rounded-xl bg-[#FFF8FB] px-3 py-2 text-center ring-1 ring-[#F3E8EF]"><p className="text-lg font-extrabold leading-tight text-[#1F2937]">{stat.value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#C85B95]">{stat.label}</p></div>)}
              </div>
            ) : <div className="flex-1" />}
            <details className="group relative border-t border-[#F3E8EF] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[#FFF0F7] [&::-webkit-details-marker]:hidden">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D65A9A] font-bold text-white">{displayName.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 text-left"><span className="block max-w-32 truncate text-xs font-bold text-[#1F2937]">{displayName}</span><span className="block max-w-32 truncate text-[10px] text-[#6B7280]">{currentUser?.email}</span></span>
                <HiChevronDown className="h-4 w-4 text-[#6B7280] transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 rounded-xl border border-[#F3E8EF] bg-white p-2 shadow-xl"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#FFF0F7] hover:text-[#C85B95]"><HiOutlineArrowRightOnRectangle className="h-5 w-5 text-[#D65A9A]" /> Logout</button></div>
            </details>
          </div>
          {showHeading && <div className="mt-4 border-t border-[#F3E8EF] pt-4"><p className="text-xs font-bold uppercase tracking-wide text-[#C85B95]">Customer portal</p><h1 className="mt-1 text-2xl font-bold text-[#1F2937]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Notice({ tone = "error", children }) {
  return <SystemPopup tone={tone}>{children}</SystemPopup>;
}
