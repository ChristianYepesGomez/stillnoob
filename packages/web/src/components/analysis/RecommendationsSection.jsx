import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_STYLES, CATEGORY_STYLES } from '@stillnoob/shared';

export default function RecommendationsSection({ data }) {
  const { t } = useTranslation();
  const { recommendations } = data;

  const grouped = useMemo(() => {
    if (!recommendations) return {};
    const groups = {};
    for (const tip of recommendations) {
      if (!groups[tip.category]) groups[tip.category] = [];
      groups[tip.category].push(tip);
    }
    return groups;
  }, [recommendations]);

  if (!recommendations?.length) {
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
              {tips.map((tip, i) => {
                const sevStyle = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${sevStyle.bg} ${sevStyle.border}`}
                  >
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
