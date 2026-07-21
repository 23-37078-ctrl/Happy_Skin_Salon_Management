import { FaFacebookF, FaInstagram, FaTiktok } from "react-icons/fa6";

const footerGroups = [
  { title: "Popular Services", links: ["Signature Facial", "Diamond Peel", "Pico Whitening Laser", "Gel Manicure", "Hair Spa Treatment"], targets: ["#services", "#services", "#services", "#services", "#services"] },
  { title: "Our Branches", links: ["Happy Skin Main Branch", "Happy Skin Lipa Branch", "Happy Skin Batangas City Branch"], targets: ["#branches", "#branches", "#branches"] },
  { title: "About Happy Skin", links: ["About Us", "Our Services", "Book an Appointment", "Salon Locations"], targets: ["#about", "#services", "#services", "#branches"] },
  { title: "Support", links: ["Contact Us", "Frequently Asked Questions", "Booking Assistance", "Customer Feedback"], targets: ["#contact", "#contact", "#contact", "#contact"] },
];

export default function Footer() {
  const scrollTo = (target) => document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="text-[#1F2A44]">
      <div className="border-t border-[#E5DCE1] bg-[#F2F4F6]">
        <div className="w-full max-w-none px-6 py-12 lg:px-8">
          <button type="button" onClick={() => scrollTo("#home")} className="flex items-center gap-3 text-left">
            <img src="/images/happy-skin-logo.svg" alt="Happy Skin" className="h-16 w-16 rounded-full object-cover ring-2 ring-[#F8DCEB]" />
            <div><p className="text-2xl font-extrabold">Happy Skin</p><p className="text-xs text-[#667085]">Aesthetic and Nails Beauty Lounge</p></div>
          </button>
          <div className="mt-7 border-t border-[#D9DEE3] pt-8">
            <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="text-base font-extrabold">{group.title}</h2>
                  <ul className="mt-4 space-y-2.5">
                    {group.links.map((link, index) => <li key={link}><button type="button" onClick={() => scrollTo(group.targets[index])} className="text-left text-sm text-[#475467] transition hover:text-[#C85B95]">{link}</button></li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#1F2A44] text-white">
        <div className="flex w-full max-w-none flex-col gap-8 px-6 py-9 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="font-bold">Happy Skin Beauty Lounge</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">Professional salon care across our Main, Lipa, and Batangas City branches.</p>
            <p className="mt-7 text-sm text-white/60">© 2026 Happy Skin Salon Management System. All rights reserved.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-white/85"><button type="button" className="hover:text-[#F4A9D0]">Terms of Service</button><span>•</span><button type="button" className="hover:text-[#F4A9D0]">Privacy Policy</button></div>
          </div>
          <div className="lg:text-right">
            <p className="text-sm font-bold">Follow Happy Skin</p>
            <div className="mt-3 flex gap-3 lg:justify-end">
              {[[FaFacebookF, "Facebook"], [FaInstagram, "Instagram"], [FaTiktok, "TikTok"]].map(([Icon, label]) => <a key={label} href="#contact" aria-label={label} className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#1F2A44] transition hover:-translate-y-1 hover:bg-[#F8DCEB] hover:text-[#C85B95]"><Icon className="h-5 w-5" /></a>)}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
