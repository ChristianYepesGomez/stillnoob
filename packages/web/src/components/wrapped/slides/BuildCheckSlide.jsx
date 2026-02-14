import { motion } from 'framer-motion';

/**
 * Slide for public-live view: Build Check (gear analysis summary)
 * Shows enchant/gem audit and stat alignment teaser in wrapped style.
 */
export default function BuildCheckSlide({ buildAnalysis, isInView }) {
  if (!buildAnalysis) return null;

  const { enchantAudit, gemAudit, statAnalysis } = buildAnalysis;
  const enchantPct = enchantAudit ? Math.round((enchantAudit.enchanted / enchantAudit.total) * 100) : 0;
  const gemPct = gemAudit?.totalSockets > 0
    ? Math.round((gemAudit.filled / gemAudit.totalSockets) * 100)
    : 100;
  const alignment = statAnalysis?.alignment || 'mixed';
  const alignColor = alignment === 'good' ? '#00ff88' : alignment === 'mixed' ? '#ff9f1c' : '#ff3b5c';

  const items = [
    {
      label: 'Enchants',
      value: `${enchantAudit?.enchanted || 0}/${enchantAudit?.total || 9}`,
      pct: enchantPct,
      icon: 'fa-wand-sparkles',
    },
    {
      label: 'Gems',
      value: `${gemAudit?.filled || 0}/${gemAudit?.totalSockets || 0}`,
      pct: gemPct,
      icon: 'fa-gem',
    },
  ];

  return (
    <div className="text-center max-w-md px-6">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
      >
        <i className="fas fa-shield-halved text-4xl text-void-accent mb-4" />
        <h2 className="font-cinzel text-2xl font-bold text-white">Gear Check</h2>
      </motion.div>

      {/* Stat alignment — teaser verdict */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-6 p-4 rounded-xl border"
        style={{ borderColor: alignColor + '30', backgroundColor: alignColor + '10' }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <i
            className={`fas ${alignment === 'good' ? 'fa-check-circle' : 'fa-search'}`}
            style={{ color: alignColor }}
          />
          <span className="font-semibold text-sm" style={{ color: alignColor }}>
            {alignment === 'good' ? 'Stats look great' : 'Your stats could improve'}
          </span>
        </div>
        {alignment !== 'good' && (
          <p className="text-[10px] text-void-muted mt-1">
            Register to see exactly what to change
          </p>
        )}
      </motion.div>

      {/* Enchant/gem bars */}
      <div className="mt-8 space-y-4">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.15 }}
            className="flex items-center gap-4"
          >
            <i className={`fas ${item.icon} text-void-muted w-5 text-center`} />
            <span className="text-sm text-void-secondary w-20">{item.label}</span>
            <div className="flex-1 h-2 rounded-full bg-void-surface overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={isInView ? { width: `${item.pct}%` } : {}}
                transition={{ duration: 0.6, delay: 0.7 + i * 0.15, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: item.pct >= 80 ? '#00ff88' : item.pct >= 50 ? '#ff9f1c' : '#ff3b5c',
                }}
              />
            </div>
            <span className="font-orbitron text-xs text-void-text w-12 text-right">{item.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Missing items callout */}
      {(enchantAudit?.missing?.length > 0 || gemAudit?.emptySlots?.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="mt-6 p-4 rounded-xl bg-red-900/10 border border-red-500/15 text-left"
        >
          {enchantAudit?.missing?.length > 0 && (
            <p className="text-xs text-red-400 mb-1">
              <i className="fas fa-exclamation-triangle mr-1" />
              Missing enchants: {enchantAudit.missing.join(', ')}
            </p>
          )}
          {gemAudit?.emptySlots?.length > 0 && (
            <p className="text-xs text-red-400">
              <i className="fas fa-exclamation-triangle mr-1" />
              Empty gem slots: {gemAudit.emptySlots.join(', ')}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
