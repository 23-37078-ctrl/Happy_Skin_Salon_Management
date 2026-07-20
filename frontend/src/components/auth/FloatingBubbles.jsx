import { motion } from "framer-motion";

/**
 * FloatingBubbles
 * Decorative, purely ambient background bubbles.
 * - Absolutely positioned, pointer-events disabled (never blocks interaction)
 * - Sits behind everything (z-0), parent must be `relative overflow-hidden`
 * - Respects prefers-reduced-motion by using very slow, subtle motion only
 */
const BUBBLES = [
  { size: 220, top: "-8%", left: "-6%", color: "#F7B2D9", duration: 18, delay: 0, opacity: 0.35 },
  { size: 140, top: "62%", left: "-4%", color: "#FFD8EC", duration: 14, delay: 1.2, opacity: 0.4 },
  { size: 90, top: "8%", left: "82%", color: "#F9D6E5", duration: 12, delay: 0.6, opacity: 0.5 },
  { size: 260, top: "70%", left: "68%", color: "#F7B2D9", duration: 20, delay: 2, opacity: 0.28 },
  { size: 60, top: "38%", left: "90%", color: "#FFFFFF", duration: 10, delay: 0.3, opacity: 0.5 },
  { size: 110, top: "20%", left: "38%", color: "#FFFFFF", duration: 16, delay: 1.6, opacity: 0.3 },
];

export default function FloatingBubbles({ className = "" }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      {BUBBLES.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: b.color,
            opacity: b.opacity,
            filter: "blur(2px)",
          }}
          animate={{
            y: [0, -22, 0, 18, 0],
            x: [0, 12, 0, -10, 0],
            scale: [1, 1.06, 1, 0.97, 1],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Minimal sparkles */}
      {[...Array(5)].map((_, i) => (
        <motion.span
          key={`spark-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            width: 4,
            height: 4,
            top: `${15 + i * 16}%`,
            left: `${10 + ((i * 23) % 80)}%`,
          }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.6, 1, 0.6] }}
          transition={{
            duration: 4 + i,
            delay: i * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}