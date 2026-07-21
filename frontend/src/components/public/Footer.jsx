import { Link } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineEnvelope,
  HiOutlineMapPin,
  HiOutlinePhone,
} from "react-icons/hi2";

const footerLinkClass = "text-sm text-white/65 transition hover:text-white";

export default function Footer() {
  const scrollTo = (target) => document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="border-t border-[#E5DCE1] bg-[#1F2A44] text-white">
      <div className="grid w-full gap-9 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.75fr_0.85fr_1.2fr] lg:px-8">
        <div>
          <button type="button" onClick={() => scrollTo("#home")} className="flex items-center gap-3 text-left" aria-label="Back to top">
            <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/15" />
            <div>
              <p className="text-lg font-extrabold">Happy Skin</p>
              <p className="text-xs text-white/60">Aesthetic and Nails Beauty Lounge</p>
            </div>
          </button>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Professional beauty and wellness services across our Batangas branches.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="text-sm font-extrabold">Explore</h2>
          <div className="mt-4 flex flex-col items-start gap-3">
            <button type="button" onClick={() => scrollTo("#home")} className={footerLinkClass}>Home</button>
            <button type="button" onClick={() => scrollTo("#branches")} className={footerLinkClass}>Branches</button>
            <button type="button" onClick={() => scrollTo("#services")} className={footerLinkClass}>Services</button>
          </div>
        </nav>

        <nav aria-label="Customer links">
          <h2 className="text-sm font-extrabold">Customers</h2>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Link to="/login" className={footerLinkClass}>Login</Link>
            <Link to="/login?redirect=%2Fcustomer%2Fbook" className={footerLinkClass}>Book an appointment</Link>
          </div>
        </nav>

        <div>
          <h2 className="text-sm font-extrabold">Contact</h2>
          <address className="mt-4 space-y-3 not-italic">
            <a href="tel:09123456789" className={`flex items-center gap-2.5 ${footerLinkClass}`}><HiOutlinePhone className="h-4 w-4 shrink-0 text-[#F4A9D0]" />0912 345 6789</a>
            <a href="mailto:happyskinops@example.com" className={`flex items-center gap-2.5 ${footerLinkClass}`}><HiOutlineEnvelope className="h-4 w-4 shrink-0 text-[#F4A9D0]" />happyskinops@example.com</a>
            <p className="flex items-center gap-2.5 text-sm text-white/65"><HiOutlineMapPin className="h-4 w-4 shrink-0 text-[#F4A9D0]" />Lipa City, Batangas</p>
          </address>
          <Link to="/login?redirect=%2Fcustomer%2Fbook" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#B94B86]">
            <HiOutlineCalendarDays className="h-4 w-4" /> Book now
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/50 lg:px-8">
        © 2026 Happy Skin. All rights reserved.
      </div>
    </footer>
  );
}
