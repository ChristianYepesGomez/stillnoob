import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_STYLES, CATEGORY_STYLES } from '@stillnoob/shared';

function TipCard({ tip, t }) {
  const sevStyle = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${sevStyle.bg} ${sevStyle.border}`}>
      <i className={`fas ${sevStyle.icon} ${sevStyle.color} mt-0.5`} />
      <div className="flex-1">
        <p className="text-sm text-white">
          {t(`rec.${tip.key}`, tip.data)}
        </p>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sevStyle.color}`}>
        {t(`severity.${tip.severity}`)}
      </span>
    </div>
  );
}

export default function RecommendationsSection({ data }) {
  const { t } = useTranslation();
  const { recommendations } = data;
  const [showMore, setShowMore] = useState(false);

  const primaryTips = recommendations?.primaryTips || [];
  const secondaryTips = recommendations?.secondaryTips || [];
  const allTips = useMemo(
    () => (showMore ? [...primaryTips, ...secondaryTips] : primaryTips),
    [showMore, primaryTips, secondaryTips],
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const tip of allTips) {
      if (!groups[tip.category]) groups[tip.category] = [];
      groups[tip.category].push(tip);
    }
    return groups;
  }, [allTips]);

  if (primaryTips.length === 0) {
    return <p className="text-center py-10 text-void-text/60">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {Object.entries(grouped).map(([category, tips]) => {
        const catStyle = CATEGORY_STYLES[category] || {};
        return (
          <div key={category} className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
            <div className="flex items-center gap-2 mb-4">
              <i className={`fas ${catStyle.icon || 'fa-circle'} ${catStyle.color || 'text-white'}`} />
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${catStyle.color || 'text-white'}`}>
                {t(`categories.${category}`)}
              </h3>
            </div>

            <div className="space-y-2">
              {tips.map((tip, i) => (
                <TipCard key={i} tip={tip} t={t} />
              ))}
            </div>
          </div>
        );
      })}

      {secondaryTips.length > 0 && (
        <button
          onClick={() => setShowMore(!showMore)}
          className="w-full py-2 text-sm text-void-text/70 hover:text-void-text transition-colors border border-void-bright/10 rounded-lg hover:border-void-bright/20"
        >
          {showMore ? t('analysis.showLess') : t('analysis.showMore', { count: secondaryTips.length })}
        </button>
      )}
    </div>
  );
}
