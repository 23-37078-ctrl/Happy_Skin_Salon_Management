import { motion } from "framer-motion";
import {
  HiArrowRight,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
} from "react-icons/hi2";

const FALLBACK_IMAGE = "/images/services/signature-facial.jpg";

function safeImageSource(value) {
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function formatPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0
    ? price.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
    : "Price on request";
}

export default function RecommendedServiceCard({
  name,
  image,
  reason,
  description,
  branchName,
  price,
  duration,
  onBook,
}) {
  const durationValue = Number(duration);
  const validDuration = Number.isFinite(durationValue) && durationValue > 0 && durationValue <= 1440;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22 }}
      className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#ECDDE5] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)] transition hover:border-[#DCA9C4] hover:shadow-[0_18px_42px_rgba(214,90,154,0.13)]"
    >
      <div className="relative h-44 overflow-hidden bg-[#FFF0F7]">
        <img
          src={safeImageSource(image)}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-[#B94B86] shadow-sm backdrop-blur">
          <HiOutlineSparkles className="h-4 w-4" /> Recommended
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 text-lg font-extrabold leading-snug text-[#202534]">{name || "Salon service"}</h3>
        {branchName && <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-[#A34777]"><HiOutlineMapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="line-clamp-1">{branchName}</span></p>}
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#667085]">
          {reason || description || "Professional salon care selected from our available services."}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#F1E5EB] pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#98A2B3]">Starting at</p>
            <p className="mt-0.5 text-lg font-black text-[#A83F78]">{formatPrice(price)}</p>
          </div>
          {validDuration && <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-[#667085]"><HiOutlineClock className="h-4 w-4 text-[#C85B95]" />{durationValue} min</span>}
        </div>

        <button type="button" onClick={onBook} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B94B86] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#A83F78] focus:outline-none focus:ring-4 focus:ring-[#B94B86]/20">
          Check availability <HiArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#7A6670]"><HiOutlineShieldCheck className="h-3.5 w-3.5 text-[#B94B86]" />Request first—salon confirmation follows</p>
      </div>
    </motion.article>
  );
}
