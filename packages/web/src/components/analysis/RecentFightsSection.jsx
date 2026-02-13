import { useTranslation } from 'react-i18next';
import { DIFFICULTY_COLORS } from '@stillnoob/shared';

function formatDps(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : Math.round(val);
}

function formatDmg(val) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return Math.round(val);
}

export default function RecentFightsSection({ data }) {
  const { t } = useTranslation();
  const { recentFights } = data;

  if (!recentFights?.length) {
    return <p className="text-center py-10 text-void-text/60">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
        <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
          {t('analysis.recentFights')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-void-text/60 border-b border-void-bright/10">
                <th className="text-left py-2 px-2">{t('analysis.date')}</th>
                <th className="text-left py-2 px-2">{t('analysis.boss')}</th>
                <th className="text-center py-2 px-2 hidden sm:table-cell">
                  {t('analysis.difficulty')}
                </th>
                <th className="text-center py-2 px-2">{t('analysis.dps')}</th>
                <th className="text-center py-2 px-2">{t('analysis.deaths')}</th>
                <th className="text-center py-2 px-2 hidden md:table-cell">
                  {t('analysis.dmgTaken')}
                </th>
                <th className="text-center py-2 px-2 hidden md:table-cell">
                  {t('analysis.vsMedian')}
                </th>
                <th className="text-center py-2 px-2 hidden lg:table-cell">
                  <i className="fas fa-flask" title={t('categories.consumables')} />
                </th>
              </tr>
            </thead>
            <tbody>
              {recentFights.map((fight, i) => {
                const diffColor = DIFFICULTY_COLORS[fight.difficulty] || '#fff';
                const medianPct = Math.round(fight.dpsVsMedian || 100);
                const usedConsumables =
                  (fight.potions ? 1 : 0) +
                  (fight.healthstones ? 1 : 0) +
                  (fight.combatPotions ? 1 : 0);

                return (
                  <tr
                    key={i}
                    className="border-b border-void-bright/5 hover:bg-void-surface/10 transition-colors"
                  >
                    <td className="py-2 px-2 text-void-secondary whitespace-nowrap">
                      {fight.date
                        ? new Date(fight.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-white font-medium">
                      {fight.boss}
                      <span
                        className="ml-1.5 text-[9px] px-1 py-0.5 rounded sm:hidden"
                        style={{ backgroundColor: `${diffColor}20`, color: diffColor }}
                      >
                        {fight.difficulty?.[0]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center hidden sm:table-cell">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: `${diffColor}20`, color: diffColor }}
                      >
                        {fight.difficulty}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-blue-400 font-bold font-orbitron">
                      {formatDps(fight.dps)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={fight.deaths > 0 ? 'text-red-400' : 'text-green-400'}>
                        {fight.deaths}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center hidden md:table-cell text-void-secondary">
                      {formatDmg(fight.damageTaken || 0)}
                    </td>
                    <td className="py-2 px-2 text-center hidden md:table-cell">
                      <span
                        className={`font-bold ${
                          medianPct >= 100
                            ? 'text-green-400'
                            : medianPct >= 80
                              ? 'text-yellow-400'
                              : 'text-red-400'
                        }`}
                      >
                        {medianPct}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {fight.potions > 0 && (
                          <i
                            className="fas fa-heart text-red-400 text-[9px]"
                            title="Health Potion"
                          />
                        )}
                        {fight.healthstones > 0 && (
                          <i className="fas fa-gem text-green-400 text-[9px]" title="Healthstone" />
                        )}
                        {fight.combatPotions > 0 && (
                          <i
                            className="fas fa-bolt text-blue-400 text-[9px]"
                            title="Combat Potion"
                          />
                        )}
                        {usedConsumables === 0 && <span className="text-void-muted">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
