import { motion } from 'framer-motion';
import AnimatedRing from '../shared/AnimatedRing';
import { getTone, TONE_COLORS } from '../shared/wrappedUtils';
import { getSlideCopy } from '../shared/wrappedCopy';

const CONSUMABLES = [
  { key: 'avgFlaskUptime', label: 'Flask', icon: 'fa-flask', suffix: '%' },
  { key: 'combatPotionRate', label: 'Combat Potion', icon: 'fa-bolt', suffix: '%' },
  { key: 'healthstoneRate', label: 'Healthstone', icon: 'fa-heart', suffix: '%' },
  { key: 'foodRate', label: 'Food', icon: 'fa-utensils', suffix: '%' },
  { key: 'augmentRate', label: 'Augment Rune', icon: 'fa-scroll', suffix: '%' },
];

/**
 * Slide 4: Preparation - Consumable score + individual rates
 */
export default function PreparationSlide({ summary, isInView }) {
  const score = summary?.consumableScore || 0;

  const tone = getTone(score, { celebratory: 80, positive: 60, neutral: 40 });
  const copy = getSlideCopy('preparation', tone);
  const toneColor = TONE_COLORS[tone];

  return (
    <div className="text-center max-w-md px-6">
      {/* Animated ring with score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5 }}
        className="flex justify-center"
      >
        <AnimatedRing
          value={score}
          size={160}
          strokeWidth={8}
          color={toneColor}
          duration={800}
          trigger={isInView}
        >
          <span className="font-orbitron text-4xl font-bold text-white">
            {Math.round(score)}
          </span>
          <span className="text-xs text-void-muted mt-1">PREP SCORE</span>
        </AnimatedRing>
      </motion.div>

      {/* Tone headline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-6"
      >
        <h2 className="font-cinzel text-xl font-bold" style={{ color: toneColor }}>
          {copy.headline}
        </h2>
        <p className="mt-1 text-sm text-void-secondary">{copy.subtitle}</p>
      </motion.div>

      {/* Individual consumable bars */}
      <div className="mt-8 space-y-3 text-left">
        {CONSUMABLES.map((c, i) => {
          const value = summary?.[c.key] || 0;
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: 0.8 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <i className={`fas ${c.icon} text-void-muted w-5 text-center text-sm`} />
              <span className="text-xs text-void-secondary w-28 shrink-0">{c.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-void-surface overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${Math.min(value, 100)}%` } : {}}
                  transition={{ duration: 0.6, delay: 1.0 + i * 0.1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: value >= 80 ? '#00ff88' : value >= 50 ? '#ff9f1c' : '#ff3b5c',
                  }}
                />
              </div>
              <span className="font-orbitron text-xs text-void-text w-10 text-right">
                {Math.round(value)}{c.suffix}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
