import { motion } from 'framer-motion';

/**
 * Small up/down change indicator pill.
 * Props:
 *   value - change value (positive = improvement, negative = decline)
 *   label - what the metric is (e.g., "DPS", "Deaths")
 *   invertColor - if true, negative is good (e.g., deaths going down is good)
 *   suffix - optional suffix (default "%")
 *   trigger - whether to animate in (default true)
 *   delay - animation delay in seconds
 */
export default function DeltaPill({
  value,
  label,
  invertColor = false,
  suffix = '%',
  trigger = true,
  delay = 0,
}) {
  const isPositive = invertColor ? value <= 0 : value >= 0;
  const arrow = value >= 0 ? '\u2191' : '\u2193'; // ↑ ↓
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const bg = isPositive ? 'bg-green-900/30' : 'bg-red-900/30';
  const border = isPositive ? 'border-green-500/20' : 'border-red-500/20';

  const displayValue = Math.abs(Math.round(value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={trigger ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.4, delay }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg} ${border}`}
    >
      <span className={`font-orbitron text-sm font-bold ${color}`}>
        {arrow} {displayValue}{suffix}
      </span>
      <span className="text-xs text-void-secondary">{label}</span>
    </motion.div>
  );
}
