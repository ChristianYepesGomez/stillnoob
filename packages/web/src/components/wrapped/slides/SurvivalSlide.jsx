import { motion } from 'framer-motion';
import CountUp from '../shared/CountUp';
import { getTone, TONE_COLORS } from '../shared/wrappedUtils';
import { getSlideCopy } from '../shared/wrappedCopy';

/**
 * Slide 3: Survival Report - Death rate + best boss survival
 */
export default function SurvivalSlide({ summary, bossBreakdown, isInView }) {
  const deathRate = summary?.deathRate || 0;
  const totalDeaths = Math.round(deathRate * (summary?.totalFights || 0));

  const tone = getTone(deathRate, {
    // Inverted: lower is better
    celebratory: -Infinity, // handled below
    positive: -Infinity,
    neutral: -Infinity,
  });
  // Custom tone logic for deaths (lower = better)
  const actualTone = deathRate < 0.1 ? 'celebratory'
    : deathRate < 0.2 ? 'positive'
    : deathRate < 0.4 ? 'neutral'
    : 'constructive';
  const copy = getSlideCopy('survival', actualTone);
  const toneColor = TONE_COLORS[actualTone];

  // Best boss by lowest death rate (with at least 3 fights)
  const validBosses = (bossBreakdown || []).filter(b => b.fights >= 2);
  const bestBoss = validBosses.length > 0
    ? validBosses.reduce((best, b) => b.deathRate < best.deathRate ? b : best)
    : null;

  return (
    <div className="text-center max-w-lg px-6">
      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-6"
      >
        <i
          className={`fas ${copy.icon} text-5xl sm:text-6xl`}
          style={{ color: toneColor }}
        />
      </motion.div>

      {/* Death rate */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <CountUp
          end={deathRate}
          duration={800}
          trigger={isInView}
          formatter={(v) => v.toFixed(2)}
          className="font-orbitron text-5xl sm:text-7xl font-bold text-white"
        />
        <p className="mt-2 text-void-muted text-sm font-rajdhani tracking-widest uppercase">
          deaths per fight
        </p>
      </motion.div>

      {/* Total deaths context */}
      {totalDeaths > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-4 text-void-secondary text-sm"
        >
          {totalDeaths} total death{totalDeaths !== 1 ? 's' : ''} across {summary.totalFights} fights
        </motion.p>
      )}

      {/* Tone headline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-8"
      >
        <h2 className="font-cinzel text-2xl font-bold" style={{ color: toneColor }}>
          {copy.headline}
        </h2>
        <p className="mt-1 text-sm text-void-secondary">{copy.subtitle}</p>
      </motion.div>

      {/* Best boss callout */}
      {bestBoss && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 1.4 }}
          className="mt-8 px-4 py-3 rounded-xl bg-void-surface/50 border border-void-bright/10 inline-block"
        >
          <p className="text-xs text-void-muted uppercase tracking-wider mb-1">Best survival</p>
          <p className="text-white font-semibold">
            {bestBoss.bossName}
            <span className="text-void-secondary text-sm ml-2">
              {bestBoss.deathRate.toFixed(2)} deaths/fight
            </span>
          </p>
        </motion.div>
      )}
    </div>
  );
}
