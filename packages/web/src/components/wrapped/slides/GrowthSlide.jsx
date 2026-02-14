import { motion } from 'framer-motion';
import TrendLine from '../shared/TrendLine';
import DeltaPill from '../shared/DeltaPill';
import { getTone, TONE_COLORS } from '../shared/wrappedUtils';
import { getSlideCopy } from '../shared/wrappedCopy';

/**
 * Slide 6: Growth - Weekly trends visualization
 */
export default function GrowthSlide({ weeklyTrends, isInView }) {
  if (!weeklyTrends || weeklyTrends.length < 2) return null;

  const first = weeklyTrends[0];
  const last = weeklyTrends[weeklyTrends.length - 1];

  // Calculate deltas
  const dpsChange = first.avgDps > 0
    ? ((last.avgDps - first.avgDps) / first.avgDps) * 100
    : 0;
  const deathChange = first.avgDeaths > 0
    ? ((last.avgDeaths - first.avgDeaths) / first.avgDeaths) * 100
    : 0;
  const consumableChange = last.consumableScore - first.consumableScore;

  // Overall tone
  const improvements = [
    dpsChange > 5,
    deathChange < -5,
    consumableChange > 5,
  ].filter(Boolean).length;
  const tone = improvements >= 3 ? 'celebratory'
    : improvements >= 2 ? 'positive'
    : improvements >= 1 ? 'neutral'
    : 'constructive';
  const copy = getSlideCopy('growth', tone);
  const toneColor = TONE_COLORS[tone];

  // DPS data points for trend line
  const dpsPoints = weeklyTrends.map(w => w.avgDps);

  return (
    <div className="text-center max-w-lg px-6">
      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
      >
        <h2 className="font-cinzel text-2xl sm:text-3xl font-bold" style={{ color: toneColor }}>
          {copy.headline}
        </h2>
        <p className="mt-1 text-sm text-void-secondary">{copy.subtitle}</p>
      </motion.div>

      {/* Trend line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="mt-8 flex justify-center"
      >
        <TrendLine
          data={dpsPoints}
          width={320}
          height={100}
          color={toneColor}
          fillColor={toneColor + '15'}
          duration={1200}
          trigger={isInView}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="mt-2 text-xs text-void-muted"
      >
        DPS over {weeklyTrends.length} weeks
      </motion.p>

      {/* Delta pills */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <DeltaPill
          value={dpsChange}
          label="DPS"
          trigger={isInView}
          delay={1.0}
        />
        <DeltaPill
          value={deathChange}
          label="Deaths"
          invertColor
          trigger={isInView}
          delay={1.2}
        />
        <DeltaPill
          value={consumableChange}
          label="Prep"
          suffix=" pts"
          trigger={isInView}
          delay={1.4}
        />
      </div>
    </div>
  );
}
