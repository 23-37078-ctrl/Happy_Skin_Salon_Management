import { useEffect, useRef, useState } from "react";

function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting)
        setTimeout(() => el.classList.add("opacity-100", "translate-y-0"), delay);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className="opacity-0 translate-y-6 transition-all duration-700 ease-out">
      {children}
    </div>
  );
}

const CONTACT_INFO = [
  {
    icon: "✉",
    label: "Email",
    value: "happyskinops@example.com",
    href: "mailto:happyskinops@example.com",
  },
  {
    icon: "📞",
    label: "Phone",
    value: "0912 345 6789",
    href: "tel:09123456789",
  },
  {
    icon: "📍",
    label: "Location",
    value: "Lipa City, Batangas",
    href: "#",
  },
];

export default function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setForm({ name: "", email: "", message: "" });
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-[#E6E6E6] text-sm text-[#1F2A44] placeholder-gray-400 outline-none focus:ring-2 focus:ring-pink-200 focus:border-[#C85B95] transition-all bg-white";

  return (
    <section id="contact" className="py-24 bg-[#FAF6F8]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Left */}
        <FadeIn>
          <span className="inline-block px-4 py-1.5 rounded-full bg-pink-100 text-[#C85B95] text-xs font-semibold tracking-wide mb-5">
            Contact
          </span>
          <h2 className="text-4xl font-extrabold text-[#1F2A44] mb-4 leading-tight">
            Get in touch with the salon.
          </h2>
          <p className="text-[#6B7280] text-sm leading-relaxed mb-10">
            Use this section for appointment concerns, branch inquiries, and
            service-related questions.
          </p>

          {/* Contact Info Card */}
          <div className="bg-white rounded-2xl border border-[#E6E6E6] p-6 space-y-5 shadow-sm">
            {CONTACT_INFO.map(({ icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-4 group"
              >
                <div className="w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center text-lg flex-shrink-0 group-hover:bg-[#C85B95] group-hover:text-white transition-all duration-200">
                  {icon}
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7280] uppercase tracking-widest font-semibold">
                    {label}
                  </p>
                  <p className="text-sm font-medium text-[#1F2A44] group-hover:text-[#C85B95] transition-colors">
                    {value}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </FadeIn>

        {/* Right — Form */}
        <FadeIn delay={150}>
          <div className="bg-white rounded-3xl border border-[#E6E6E6] p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#1F2A44] mb-6">
              Send us a message
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                  Full Name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                  Email Address
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">
                  Message
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Tell us about your inquiry..."
                  rows={4}
                  required
                  className={inputClass + " resize-none"}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#C85B95] text-white font-semibold text-sm hover:bg-[#b34d82] hover:shadow-lg transition-all duration-200"
              >
                {sent ? "Message Sent! ✓" : "Send Message"}
              </button>
            </form>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}