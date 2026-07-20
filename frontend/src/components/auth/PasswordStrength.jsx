import { motion } from "framer-motion";

function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LEVELS = [
  { label: "Too short", color: "#E5E7EB" },
  { label: "Weak", color: "#EF4444" },
  { label: "Fair", color: "#F59E0B" },
  { label: "Good", color: "#EC4899" },
  { label: "Strong", color: "#16A34A" },
];

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: i < score ? "100%" : "0%" }}
              transition={{ duration: 0.3 }}
              style={{ background: level.color }}
            />
          </div>
        ))}
      </div>
      <p
        className="mt-1 text-xs"
        style={{ fontFamily: "'Poppins', sans-serif", color: level.color }}
      >
        {level.label}
      </p>
    </div>
  );
}