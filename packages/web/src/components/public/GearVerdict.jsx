import { useTranslation } from 'react-i18next';

const ALIGNMENT_STYLES = {
  good: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-500/30', icon: 'fa-check-circle' },
  mixed: { bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: 'fa-exclamation-circle' },
  poor: { bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-500/30', icon: 'fa-times-circle' },
};

export default function GearVerdict({ buildAnalysis }) {
  const { t } = useTranslation();
  const { statAnalysis, enchantAudit, gemAudit, gearTips } = buildAnalysis;

  const missingEnchants = enchantAudit?.missing?.length || 0;
  const emptyGems = gemAudit?.empty || 0;
  const alignment = statAnalysis?.alignment || 'mixed';
  const alignStyle = ALIGNMENT_STYLES[alignment] || ALIGNMENT_STYLES.mixed;

  // Top critical/warning tips (max 2)
  const topTips = (gearTips || [])
    .filter((tip) => tip.severity === 'critical' || tip.severity === 'warning')
    .slice(0, 2);

  return (
    <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          <i className="fas fa-shield-halved mr-2 text-amber-400" />
          {t('public.gearVerdict')}
        </h2>
        <span
          className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${alignStyle.bg} ${alignStyle.text} ${alignStyle.border}`}
        >
          <i className={`fas ${alignStyle.icon} mr-1`} />
          {t(`analysis.alignment${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`)}
        </span>
      </div>

      {/* Stat bars mini preview */}
      {statAnalysis?.distribution && (
        <div className="space-y-1.5 mb-4">
          {Object.entries(statAnalysis.distribution)
            .sort((a, b) => b[1] - a[1])
            .map(([stat, pct]) => {
              const rank = statAnalysis.specPriority?.indexOf(stat) ?? -1;
              const color =
                rank === 0 || rank === 1 ? 'bg-green-500' : rank === 2 ? 'bg-yellow-500' : 'bg-gray-500';
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-[10px] text-void-secondary w-16 text-right capitalize">{stat}</span>
                  <div className="flex-1 h-2 bg-void-deep/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-orbitron text-void-muted w-8">{Math.round(pct)}%</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Issues grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className={`flex items-center gap-2 p-3 rounded-xl border ${missingEnchants > 0 ? 'bg-red-900/10 border-red-500/20' : 'bg-green-900/10 border-green-500/20'}`}
        >
          <i
            className={`fas ${missingEnchants > 0 ? 'fa-times-circle text-red-400' : 'fa-check-circle text-green-400'}`}
          />
          <div>
            <p className={`text-sm font-semibold ${missingEnchants > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {missingEnchants > 0
                ? t('public.missingEnchants', { count: missingEnchants })
                : t('public.allEnchanted')}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 p-3 rounded-xl border ${emptyGems > 0 ? 'bg-red-900/10 border-red-500/20' : 'bg-green-900/10 border-green-500/20'}`}
        >
          <i
            className={`fas ${emptyGems > 0 ? 'fa-gem text-red-400' : 'fa-gem text-green-400'}`}
          />
          <div>
            <p className={`text-sm font-semibold ${emptyGems > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {emptyGems > 0
                ? t('public.missingGems', { count: emptyGems })
                : t('public.allGemmed')}
            </p>
          </div>
        </div>
      </div>

      {/* Top gear tips */}
      {topTips.length > 0 && (
        <div className="space-y-2">
          {topTips.map((tip, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg border ${
                tip.severity === 'critical'
                  ? 'bg-red-900/10 border-red-500/20'
                  : 'bg-yellow-900/10 border-yellow-500/20'
              }`}
            >
              <i
                className={`fas ${tip.severity === 'critical' ? 'fa-circle-exclamation text-red-400' : 'fa-triangle-exclamation text-yellow-400'} mt-0.5 text-sm`}
              />
              <p className="text-sm text-void-text">{t(`rec.${tip.key}`, tip.data)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
