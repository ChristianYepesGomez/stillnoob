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

  // Only critical tips visible for free (max 2)
  const topTips = (gearTips || [])
    .filter((tip) => tip.severity === 'critical')
    .slice(0, 2);

  return (
    <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5 animate-fade-in">
      <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
        <i className="fas fa-shield-halved mr-2 text-amber-400" />
        {t('public.gearVerdict')}
      </h2>

      {/* Stat priority teaser — no detail bars, just verdict */}
      {statAnalysis?.alignment && (
        <div
          className={`p-4 rounded-xl border mb-4 ${alignStyle.bg} ${alignStyle.border}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className={`fas ${alignStyle.icon} ${alignStyle.text}`} />
              <span className={`text-sm font-semibold ${alignStyle.text}`}>
                {alignment === 'good'
                  ? t('public.statsPriorityGood')
                  : t('public.statsPriorityImprovable')}
              </span>
            </div>
            {alignment !== 'good' && (
              <span className="text-[10px] text-void-muted flex items-center gap-1">
                <i className="fas fa-lock text-void-muted/60" />
                {t('public.statsPriorityLocked')}
              </span>
            )}
          </div>
          {alignment !== 'good' && (
            <p className="text-xs text-void-secondary mt-2">
              {t('public.statsPriorityHint')}
            </p>
          )}
        </div>
      )}

      {/* Enchant & gem status — free value */}
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

      {/* Critical gear tips only */}
      {topTips.length > 0 && (
        <div className="space-y-2">
          {topTips.map((tip, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 rounded-lg border bg-red-900/10 border-red-500/20"
            >
              <i className="fas fa-circle-exclamation text-red-400 mt-0.5 text-sm" />
              <p className="text-sm text-void-text">{t(`rec.${tip.key}`, tip.data)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
