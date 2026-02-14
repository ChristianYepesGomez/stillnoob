import { motion } from 'framer-motion';
import AnimatedRing from '../shared/AnimatedRing';
import CountUp from '../shared/CountUp';
import { SLIDE_COPY } from '../shared/wrappedCopy';

const BREAKDOWN_KEYS = [
  { key: 'performance', label: 'Performance', color: '#60a5fa' },
  { key: 'survival', label: 'Survival', color: '#22c55e' },
  { key: 'preparation', label: 'Preparation', color: '#c084fc' },
  { key: 'utility', label: 'Utility', color: '#f6c843' },
  { key: 'consistency', label: 'Consistency', color: '#ff9f1c' },
];

/**
 * Slide 8: The Verdict - StillNoob Score reveal (CLIMAX)
 */
export default function ScoreRevealSlide({ score, isInView }) {
  if (!score) return null;

  const tierColor = score.tier?.color || '#888';

  return (
    <div className="text-center max-w-md px-6">
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-10 animate-glow-pulse pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${tierColor}, transparent 60%)`,
        }}
      />

      {/* Score ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex justify-center"
      >
        <AnimatedRing
          value={score.total}
          size={200}
          strokeWidth={10}
          color={tierColor}
          duration={2000}
          trigger={isInView}
        >
          <CountUp
            end={score.total}
            duration={2000}
            trigger={isInView}
            className="font-orbitron text-5xl font-bold text-white"
          />
        </AnimatedRing>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="mt-4 text-xs text-void-muted uppercase tracking-widest"
      >
        {SLIDE_COPY.scoreReveal.subtitle}
      </motion.p>

      {/* Tier name */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 2.2 }}
        className="mt-3 font-cinzel text-3xl sm:text-4xl font-bold"
        style={{ color: tierColor }}
      >
        {score.tier?.emoji} {score.tier?.label}
      </motion.h2>

      {/* Breakdown bars */}
      <div className="mt-8 space-y-3">
        {BREAKDOWN_KEYS.map((item, i) => {
          const val = score.breakdown?.[item.key] || 0;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: 2.5 + i * 0.15 }}
              className="flex items-center gap-3"
            >
              <span className="text-xs text-void-secondary w-24 text-right shrink-0">
                {item.label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-void-surface overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${val}%` } : {}}
                  transition={{ duration: 0.6, delay: 2.7 + i * 0.15, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              </div>
              <span className="font-orbitron text-xs text-void-text w-8">
                {Math.round(val)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
