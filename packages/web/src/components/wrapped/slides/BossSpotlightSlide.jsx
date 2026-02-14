import { motion } from 'framer-motion';
import { formatBigNumber } from '../shared/wrappedUtils';
import { SLIDE_COPY } from '../shared/wrappedCopy';

/**
 * Slide 5: Boss Spotlight - Your Domain vs Your Nemesis
 */
export default function BossSpotlightSlide({ bossBreakdown, isInView }) {
  if (!bossBreakdown || bossBreakdown.length < 2) return null;

  // Best boss: highest dpsVsMedian
  const bestBoss = [...bossBreakdown].sort((a, b) => (b.dpsVsMedian || 0) - (a.dpsVsMedian || 0))[0];
  // Worst boss: lowest dpsVsMedian (with at least 2 fights)
  const worstCandidates = bossBreakdown.filter(b => b.fights >= 2);
  const worstBoss = worstCandidates.length > 0
    ? [...worstCandidates].sort((a, b) => (a.dpsVsMedian || 0) - (b.dpsVsMedian || 0))[0]
    : bossBreakdown[bossBreakdown.length - 1];

  // Avoid showing same boss twice
  const nemesis = worstBoss.bossName === bestBoss.bossName && bossBreakdown.length > 1
    ? bossBreakdown.find(b => b.bossName !== bestBoss.bossName) || worstBoss
    : worstBoss;

  return (
    <div className="w-full max-w-3xl px-6">
      {/* Two-panel layout */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Domain panel */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex-1 p-6 rounded-2xl border border-green-500/20 bg-green-900/10 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400" />
          <p className="text-xs font-rajdhani tracking-widest uppercase text-green-400/70 mb-4">
            {SLIDE_COPY.bossSpotlight.domain}
          </p>
          <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-white mb-4">
            {bestBoss.bossName}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">Avg DPS</span>
              <span className="font-orbitron text-green-400">{formatBigNumber(bestBoss.avgDps)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">vs Median</span>
              <span className="font-orbitron text-green-400">{Math.round(bestBoss.dpsVsMedian || 100)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">Deaths/Fight</span>
              <span className="font-orbitron text-green-400">{bestBoss.deathRate.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>

        {/* Nemesis panel */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          className="flex-1 p-6 rounded-2xl border border-red-500/20 bg-red-900/10 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-400" />
          <p className="text-xs font-rajdhani tracking-widest uppercase text-red-400/70 mb-4">
            {SLIDE_COPY.bossSpotlight.nemesis}
          </p>
          <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-white mb-4">
            {nemesis.bossName}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">Avg DPS</span>
              <span className="font-orbitron text-red-400">{formatBigNumber(nemesis.avgDps)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">vs Median</span>
              <span className="font-orbitron text-red-400">{Math.round(nemesis.dpsVsMedian || 100)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-void-secondary">Deaths/Fight</span>
              <span className="font-orbitron text-red-400">{nemesis.deathRate.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="text-center mt-6 text-sm text-void-muted"
      >
        Every hero has a strength and a weakness
      </motion.p>
    </div>
  );
}
