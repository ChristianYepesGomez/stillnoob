import { motion } from 'framer-motion';

/**
 * Simple SVG trend line with draw animation.
 * Props:
 *   data - array of numbers
 *   width - SVG width (default 300)
 *   height - SVG height (default 100)
 *   color - stroke color
 *   duration - draw duration in ms (default 1200)
 *   trigger - whether to animate (default true)
 *   fillColor - optional area fill below the line
 */
export default function TrendLine({
  data,
  width = 300,
  height = 100,
  color = '#9d5cff',
  duration = 1200,
  trigger = true,
  fillColor,
}) {
  if (!data?.length || data.length < 2) return null;

  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((val - min) / range) * h;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;

  // Area fill path (closes to bottom)
  const areaPath = fillColor
    ? `${linePath} L ${padding + w},${padding + h} L ${padding},${padding + h} Z`
    : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Area fill */}
      {areaPath && (
        <motion.path
          d={areaPath}
          fill={fillColor}
          initial={{ opacity: 0 }}
          animate={trigger ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: duration / 1000 * 0.5 }}
        />
      )}
      {/* Animated line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={trigger ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: duration / 1000, ease: 'easeOut' }}
      />
    </svg>
  );
}
