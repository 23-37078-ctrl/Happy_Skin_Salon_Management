import { motion } from "framer-motion";

/**
 * AuthIllustration
 * Lightweight, hand-rolled flat-style SVG (no external image request —
 * keeps the auth screen fast and avoids a broken-image flash).
 * Depicts a stylized customer receiving a facial/beauty treatment.
 */
export default function AuthIllustration({ className = "" }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 420 380" className="w-full h-auto drop-shadow-xl" role="img" aria-label="Illustration of a beauty treatment">
        {/* soft ground shadow */}
        <ellipse cx="210" cy="352" rx="140" ry="16" fill="#C2185B" opacity="0.08" />

        {/* mirror / vanity backdrop */}
        <rect x="60" y="40" width="300" height="230" rx="24" fill="#FFFFFF" opacity="0.35" />
        <rect x="60" y="40" width="300" height="230" rx="24" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2" />

        {/* hanging plant */}
        <path d="M340 40 v18" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2" />
        <circle cx="340" cy="66" r="16" fill="#F7B2D9" opacity="0.6" />
        <circle cx="330" cy="72" r="10" fill="#F9D6E5" opacity="0.7" />
        <circle cx="350" cy="72" r="10" fill="#F9D6E5" opacity="0.7" />

        {/* chair */}
        <rect x="150" y="230" width="120" height="18" rx="9" fill="#C2185B" opacity="0.25" />
        <rect x="160" y="180" width="100" height="70" rx="20" fill="#FFFFFF" />
        <rect x="160" y="180" width="100" height="70" rx="20" fill="none" stroke="#E75480" strokeOpacity="0.25" strokeWidth="2" />

        {/* customer body */}
        <path d="M170 250 q40 -20 80 0 l6 60 q-46 18 -92 0 z" fill="#E75480" />
        {/* customer neck + head */}
        <rect x="196" y="150" width="28" height="30" rx="10" fill="#F3B79A" />
        <circle cx="210" cy="135" r="34" fill="#F7C9A8" />
        {/* hair */}
        <path d="M176 130 q0 -40 34 -42 q34 2 34 42 q0 -6 -6 -10 q-4 14 -14 4 q-2 12 -14 6 q-6 10 -18 2 q-6 4 -16 -2 z" fill="#6B3F5D" />
        {/* closed relaxed eyes */}
        <path d="M198 136 q4 4 8 0" stroke="#8A5A46" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M216 136 q4 4 8 0" stroke="#8A5A46" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* soft smile */}
        <path d="M202 148 q8 6 16 0" stroke="#C2185B" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* face mask sheet */}
        <ellipse cx="210" cy="132" rx="28" ry="22" fill="#FFFFFF" opacity="0.35" />

        {/* beautician hand + tool */}
        <path d="M290 150 q-30 4 -46 20" stroke="#F3B79A" strokeWidth="14" strokeLinecap="round" fill="none" />
        <circle cx="292" cy="148" r="9" fill="#F3B79A" />

        {/* skincare bottle */}
        <rect x="96" y="196" width="24" height="40" rx="6" fill="#C2185B" opacity="0.85" />
        <rect x="102" y="188" width="12" height="10" rx="3" fill="#6B3F5D" />

        {/* nail polish bottle */}
        <rect x="284" y="210" width="18" height="26" rx="4" fill="#F9D6E5" stroke="#E75480" strokeWidth="1.5" />
        <rect x="289" y="202" width="8" height="10" rx="2" fill="#6B3F5D" />

        {/* floating petals */}
        <motion.circle
          cx="90" cy="90" r="6" fill="#F7B2D9"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="330" cy="120" r="5" fill="#F9D6E5"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </svg>
    </motion.div>
  );
}