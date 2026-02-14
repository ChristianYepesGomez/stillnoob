import { motion } from 'framer-motion';

/**
 * Animated SVG circular progress ring.
 * Props:
 *   value - current value (0-100)
 *   size - diameter in px (default 200)
 *   strokeWidth - ring thickness (default 8)
 *   color - ring color
 *   bgColor - background ring color (default void-muted)
 *   duration - fill animation duration in ms (default 1500)
 *   trigger - whether to animate (default true)
 *   children - content inside the ring (e.g., score number)
 */
export default function AnimatedRing({
  value,
  size = 200,
  strokeWidth = 8,
  color = '#9d5cff',
  bgColor = 'rgba(92, 79, 115, 0.3)',
  duration = 1500,
  trigger = true,
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillOffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated fill ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={trigger ? { strokeDashoffset: fillOffset } : { strokeDashoffset: circumference }}
          transition={{ duration: duration / 1000, ease: 'easeOut' }}
        />
      </svg>
      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
