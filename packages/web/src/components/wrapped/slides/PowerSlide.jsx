import { motion } from 'framer-motion';
import CountUp from '../shared/CountUp';
import { getTone, getParseColor, formatBigNumber, TONE_COLORS } from '../shared/wrappedUtils';
import { getSlideCopy } from '../shared/wrappedCopy';

/**
 * Slide 2: Your Power - DPS/HPS, vs median, parse percentile
 */
export default function PowerSlide({ summary, role, isInView }) {
  const isHealer = role === 'healer';
  const mainStat = isHealer ? (summary?.avgHps || 0) : (summary?.avgDps || 0);
  const statLabel = isHealer ? 'HPS' : 'DPS';
  const vsMedian = summary?.dpsVsMedianPct || 100;
  const parse = summary?.avgParsePercentile;

  const tone = getTone(vsMedian, { celebratory: 115, positive: 100, neutral: 80 });
  const copy = getSlideCopy('power', tone);
  const toneColor = TONE_COLORS[tone];
  const parseColor = getParseColor(parse);

  // Bar fill percentage (capped at 150% for display)
  const barPct = Math.min(vsMedian, 150);
  const barDisplay = (barPct / 150) * 100;

  return (
    <div className="text-center max-w-lg px-6">
      {/* Main stat */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5 }}
      >
        <CountUp
          end={mainStat}
          duration={1200}
          trigger={isInView}
          formatter={formatBigNumber}
          className="font-orbitron text-6xl sm:text-8xl font-bold text-white"
        />
        <p className="mt-1 text-void-muted text-sm font-rajdhani tracking-widest uppercase">
          avg {statLabel}
        </p>
      </motion.div>

      {/* Vs median bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-8 w-full"
      >
        <div className="flex justify-between text-xs text-void-muted mb-2">
          <span>vs raid median</span>
          <span style={{ color: toneColor }}>{Math.round(vsMedian)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-void-surface overflow-hidden">
          {/* Median marker */}
          <div className="relative h-full">
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: `${barDisplay}%` } : {}}
              transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: toneColor }}
            />
            {/* 100% marker */}
            <div
              className="absolute top-0 h-full w-px bg-void-text/30"
              style={{ left: `${(100 / 150) * 100}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Parse badge */}
      {parse != null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 1.2 }}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border"
          style={{ borderColor: parseColor + '40', backgroundColor: parseColor + '15' }}
        >
          <span className="text-xs text-void-secondary">Parse</span>
          <span className="font-orbitron font-bold" style={{ color: parseColor }}>
            {Math.round(parse)}
          </span>
        </motion.div>
      )}

      {/* Tone headline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.5 }}
        className="mt-8"
      >
        <h2 className="font-cinzel text-2xl font-bold" style={{ color: toneColor }}>
          {copy.headline}
        </h2>
        <p className="mt-1 text-sm text-void-secondary">{copy.subtitle}</p>
      </motion.div>
    </div>
  );
}
