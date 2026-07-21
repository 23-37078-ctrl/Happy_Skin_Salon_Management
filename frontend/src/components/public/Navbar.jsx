import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineArrowRightOnRectangle, HiOutlineBars3, HiOutlineXMark } from "react-icons/hi2";

const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "Branches", href: "#branches" },
  { label: "Services", href: "#services" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [active, setActive] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      if (window.scrollY < 120) setActive("Home");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.slice(1).map(({ href, label }) => ({
      element: document.querySelector(href),
      label,
    }));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const section = sections.find((item) => item.element === entry.target);
          if (section) setActive(section.label);
        }
      });
    }, { rootMargin: "-24% 0px -68%", threshold: 0 });
    sections.forEach(({ element }) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => !rootRef.current?.contains(event.target) && setMenuOpen(false);
    const closeWithKeyboard = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [menuOpen]);

  const scrollTo = (href, label) => {
    setActive(label);
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header ref={rootRef} className={`fixed inset-x-0 top-0 z-50 h-[72px] border-b bg-white/95 backdrop-blur-md transition duration-300 ${scrolled ? "border-[#EADDE4] shadow-[0_10px_30px_rgba(31,41,55,0.08)]" : "border-[#F0E7EC]"}`}>
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => scrollTo("#home", "Home")} className="flex min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C85B95]/15">
          <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#F8DCEB] sm:h-12 sm:w-12" />
          <div className="min-w-0"><p className="truncate font-extrabold leading-tight text-[#1F2A44]">Happy Skin</p><p className="text-[10px] font-medium text-[#667085]">Beauty Lounge</p></div>
        </button>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 rounded-xl border border-[#F0E3EA] bg-[#FFF8FB] p-1 lg:flex">
          {NAV_ITEMS.map(({ label, href }) => {
            const selected = active === label;
            return <button key={label} type="button" onClick={() => scrollTo(href, label)} aria-current={selected ? "page" : undefined} className={`min-h-9 rounded-lg px-4 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#C85B95]/15 ${selected ? "bg-white text-[#A34777] shadow-sm ring-1 ring-[#E9D8E1]" : "text-[#667085] hover:bg-white hover:text-[#A34777]"}`}>{label}</button>;
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/login")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(200,91,149,0.2)] transition hover:bg-[#B94B86] focus:outline-none focus:ring-4 focus:ring-[#C85B95]/20 sm:px-5">
            <HiOutlineArrowRightOnRectangle className="hidden h-5 w-5 sm:block" /> Login
          </button>
          <button type="button" onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" className="grid h-10 w-10 place-items-center rounded-xl text-[#1F2A44] transition hover:bg-[#FFF0F7] focus:outline-none focus:ring-4 focus:ring-[#C85B95]/15 lg:hidden">
            {menuOpen ? <HiOutlineXMark className="h-6 w-6" /> : <HiOutlineBars3 className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="absolute left-4 right-4 top-[calc(100%+0.5rem)] rounded-2xl border border-[#EADDE4] bg-white p-2 shadow-[0_18px_45px_rgba(31,41,55,0.16)] lg:hidden">
        {NAV_ITEMS.map(({ label, href }) => {
          const selected = active === label;
          return <button key={label} type="button" onClick={() => scrollTo(href, label)} aria-current={selected ? "page" : undefined} className={`flex min-h-11 w-full items-center rounded-xl px-4 text-left text-sm font-bold transition ${selected ? "bg-[#FFF0F7] text-[#A34777]" : "text-[#475467] hover:bg-[#FFF8FB]"}`}>{label}</button>;
        })}
      </nav>}
    </header>
  );
}
