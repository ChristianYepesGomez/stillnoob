import { motion } from 'framer-motion';
import CountUp from '../shared/CountUp';
import { getMPlusBracket } from '../shared/wrappedUtils';
import { SLIDE_COPY } from '../shared/wrappedCopy';

/**
 * Slide 7: M+ Snapshot - Score, bracket, strong/weak dungeons
 */
export default function MythicPlusSlide({ raiderIO, mplusAnalysis, isInView }) {
  if (!raiderIO?.mythicPlus) return null;

  const score = raiderIO.mythicPlus.score || 0;
  const scoreColor = raiderIO.mythicPlus.scoreColor || '#888';
  const itemLevel = raiderIO.gear?.itemLevel;
  const bracket = getMPlusBracket(score);

  const strong = mplusAnalysis?.dungeonAnalysis?.strongDungeons || [];
  const pushTargets = mplusAnalysis?.pushTargets || [];

  return (
    <div className="text-center max-w-lg px-6">
      {/* Section label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.3 }}
        className="text-xs font-rajdhani tracking-widest uppercase text-void-muted mb-6"
      >
        {SLIDE_COPY.mythicPlus.headline}
      </motion.p>

      {/* M+ Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <CountUp
          end={score}
          duration={1200}
          trigger={isInView}
          className="font-orbitron text-6xl sm:text-8xl font-bold"
          formatter={(v) => Math.round(v).toLocaleString()}
        />
        <span
          className="font-orbitron text-6xl sm:text-8xl font-bold"
          style={{ color: scoreColor }}
        >
          {/* Score is rendered by CountUp above */}
        </span>
      </motion.div>

      {/* Bracket badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.3, delay: 0.8 }}
        className="mt-3 inline-block px-4 py-1.5 rounded-lg border"
        style={{ borderColor: bracket.color + '40', backgroundColor: bracket.color + '15' }}
      >
        <span className="font-cinzel font-bold text-sm" style={{ color: bracket.color }}>
          {bracket.label}
        </span>
      </motion.div>

      {/* Item level */}
      {itemLevel && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.3, delay: 1.0 }}
          className="mt-3 text-sm text-void-secondary"
        >
          <span className="font-orbitron text-sunwell-gold">{itemLevel}</span> item level
        </motion.p>
      )}

      {/* Strong + Push dungeon lists */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 text-left">
        {strong.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 1.2 }}
            className="flex-1 p-4 rounded-xl bg-void-surface/50 border border-green-500/15"
          >
            <p className="text-xs text-green-400/70 uppercase tracking-wider mb-2">Strong</p>
            {strong.slice(0, 3).map((d, i) => (
              <p key={i} className="text-sm text-white">
                {d.dungeon || d.shortName}
                <span className="text-void-muted ml-2">+{d.level}</span>
              </p>
            ))}
          </motion.div>
        )}

        {pushTargets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 1.4 }}
            className="flex-1 p-4 rounded-xl bg-void-surface/50 border border-sunwell-amber/15"
          >
            <p className="text-xs text-sunwell-amber/70 uppercase tracking-wider mb-2">Push next</p>
            {pushTargets.slice(0, 3).map((d, i) => (
              <p key={i} className="text-sm text-white">
                {d.dungeon || d.shortName}
                <span className="text-void-muted ml-2">+{d.currentLevel} → +{d.targetLevel}</span>
              </p>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
