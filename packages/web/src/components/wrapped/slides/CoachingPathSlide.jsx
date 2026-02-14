import { motion } from 'framer-motion';
import { SEVERITY_STYLES } from '@stillnoob/shared';
import { SLIDE_COPY } from '../shared/wrappedCopy';

/**
 * Slide 9: Coaching Path - Top 3 tips + CTA buttons
 */
export default function CoachingPathSlide({
  recommendations,
  isInView,
  onExplore,
  onRewatch,
}) {
  const tips = recommendations?.primaryTips?.slice(0, 3) || [];
  const copy = SLIDE_COPY.coachingPath;

  return (
    <div className="w-full max-w-lg px-6">
      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
        className="text-center font-cinzel text-2xl sm:text-3xl font-bold text-white mb-8"
      >
        {copy.headline}
      </motion.h2>

      {/* Tip cards */}
      <div className="space-y-3">
        {tips.map((tip, i) => {
          const style = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info;
          return (
            <motion.div
              key={tip.key}
              initial={{ opacity: 0, x: 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.2 }}
              className={`p-4 rounded-xl border ${style.bg} ${style.border}`}
            >
              <div className="flex items-start gap-3">
                <i className={`fas ${style.icon} ${style.color} mt-0.5`} />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">
                    {formatTipMessage(tip)}
                  </p>
                  <p className="text-xs text-void-secondary mt-1 capitalize">
                    {tip.category}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
      >
        <button
          onClick={onExplore}
          className="px-6 py-3 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          {copy.exploreButton}
        </button>
        <button
          onClick={onRewatch}
          className="px-6 py-3 border border-void-bright/30 text-void-text rounded-xl font-semibold hover:border-void-bright/50 transition-colors"
        >
          {copy.rewatchButton}
        </button>
      </motion.div>
    </div>
  );
}

/** Simple tip message formatter based on key patterns */
function formatTipMessage(tip) {
  const { key, data } = tip;

  const messages = {
    high_death_rate: `You die ${data?.rate?.toFixed(2) || '?'} times per fight on average. Focus on survival mechanics.`,
    low_active_time: `Your active time is ${Math.round(data?.pct || 0)}%. Always be casting.`,
    low_cpm: `Your CPM is ${data?.cpm?.toFixed(1) || '?'}. Press your buttons more frequently.`,
    low_flask: `Flask uptime is only ${Math.round(data?.uptime || 0)}%. Keep it active every pull.`,
    no_food: `You're only using food in ${Math.round(data?.rate || 0)}% of fights.`,
    low_combat_potion: `Combat potion usage is ${Math.round(data?.rate || 0)}%. Use one every fight.`,
    low_interrupts: `Averaging ${data?.avg?.toFixed(1) || '?'} interrupts. Help your group.`,
    low_parse: `Your average parse is ${Math.round(data?.pct || 0)}. Check your rotation.`,
    boss_death_spike: `High death rate on ${data?.boss || 'a boss'} (${data?.rate?.toFixed(2) || '?'}/fight). Study the mechanics.`,
    boss_weakest_dps: `${data?.weakBoss || 'A boss'} is your weakest fight — ${Math.round(data?.gap || 0)}% behind your best.`,
    spec_cpm_context: `Your CPM is ${data?.cpm?.toFixed(1) || '?'} (expected ~${data?.expected || '?'}). ${data?.context || ''}`,
    spec_deaths_context: `You're dying ${data?.rate?.toFixed(2) || '?'} times/fight. ${data?.defensiveCd || 'Use defensives proactively.'}`,
    defensive_gap: `Death rate ${data?.deathRate?.toFixed(2) || '?'} but healthstone usage only ${Math.round(data?.healthstoneRate || 0)}%.`,
    good_preparation: 'Great consumable usage! Keep it up.',
    strong_boss: `Strong performance on ${data?.boss || 'a boss'} — ${Math.round(data?.dpsVsMedian || 0)}% of median.`,
  };

  return messages[key] || `${key.replace(/_/g, ' ')}`;
}
