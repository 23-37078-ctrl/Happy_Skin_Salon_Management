import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Home",       href: "#home" },
  { label: "Products",   href: "#products" },
  { label: "Services",   href: "#services" },
  { label: "About Us",   href: "#about" },
  { label: "Contact",    href: "#contact" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [active, setActive]     = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map(({ href, label }) => ({
      el: document.querySelector(href),
      label,
    }));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const found = sections.find((s) => s.el === e.target);
            if (found) setActive(found.label);
          }
        });
      },
      { threshold: 0.4 }
    );
    sections.forEach(({ el }) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (href, label) => {
    setActive(label);
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-[72px] bg-white transition-shadow duration-300 ${
        scrolled ? "shadow-md" : "border-b border-[#E6E6E6]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo("#home", "Home")}>
          <div className="w-10 h-10 rounded-xl bg-[#C85B95] flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-md">
            HS
          </div>
          <div>
            <p className="font-bold text-[#1F2A44] text-base leading-tight">HappySkin</p>
            <p className="text-[10px] text-[#6B7280] leading-tight">Salon Management</p>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href, label)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                active === label
                  ? "bg-[#C85B95] text-white shadow-sm"
                  : "text-[#1F2A44] hover:bg-pink-50 hover:text-[#C85B95]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Login + Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2 rounded-full bg-[#C85B95] text-white text-sm font-semibold shadow hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            Login
          </button>
          <button
            className="md:hidden flex flex-col gap-1.5 p-1"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 bg-[#1F2A44] transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-[#1F2A44] transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-[#1F2A44] transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-[#E6E6E6] px-6 py-4 flex flex-col gap-2 shadow-lg">
          {NAV_ITEMS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href, label)}
              className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active === label
                  ? "bg-[#C85B95] text-white"
                  : "text-[#1F2A44] hover:bg-pink-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}