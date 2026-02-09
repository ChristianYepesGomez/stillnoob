import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import ScoreBadge from './ScoreBadge';
import StatCard from './StatCard';
import ConsumableBar from './ConsumableBar';

function formatDps(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : Math.round(val);
}

export default function OverviewSection({ data }) {
  const { t } = useTranslation();
  const { summary, score, recommendations } = data;

  const radarData = useMemo(() => {
    if (!summary) return [];
    const b = score?.breakdown || {};
    return [
      { axis: t('analysis.scorePerformance'), value: b.performance ?? Math.min(summary.dpsVsMedianPct || 0, 100), max: 100 },
      { axis: t('analysis.scoreSurvival'), value: b.survival ?? Math.max(0, 100 - (summary.deathRate || 0) * 100), max: 100 },
      { axis: t('analysis.scorePreparation'), value: b.preparation ?? (summary.consumableScore || 0), max: 100 },
      { axis: t('analysis.scoreUtility'), value: b.utility ?? Math.min((summary.avgInterrupts || 0) * 33, 100), max: 100 },
      { axis: t('analysis.scoreConsistency'), value: b.consistency ?? 50, max: 100 },
    ];
  }, [summary, score, t]);

  const topTips = (recommendations || []).filter(r => r.severity !== 'positive').slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* StillNoob Score */}
      {score && <ScoreBadge score={score} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={t('analysis.avgDps')}
          value={formatDps(summary.avgDps || 0)}
          color="text-blue-400"
        />
        <StatCard
          label={t('analysis.deathsPerFight')}
          value={(summary.deathRate || 0).toFixed(2)}
          color={summary.deathRate > 0.3 ? 'text-red-400' : 'text-green-400'}
        />
        <StatCard
          label={t('analysis.consumableScore')}
          value={`${summary.consumableScore || 0}`}
          subValue="/100"
          color={summary.consumableScore >= 70 ? 'text-green-400' : 'text-yellow-400'}
        />
        <StatCard
          label={t('analysis.vsMedian')}
          value={`${Math.round(summary.dpsVsMedianPct || 100)}%`}
          color={summary.dpsVsMedianPct >= 100 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar chart */}
        <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
          <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
            Performance Profile
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#1a0f2e" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Radar dataKey="value" stroke="#c084fc" fill="#c084fc" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Top recommendations */}
        <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
          <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
            {t('analysis.recommendations')}
          </p>
          {topTips.length === 0 ? (
            <p className="text-sm text-void-text/60">{t('common.noData')}</p>
          ) : (
            <div className="space-y-2">
              {topTips.map((tip, i) => (
                <div key={i} className={`p-3 rounded-lg text-xs border ${
                  tip.severity === 'critical' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                  tip.severity === 'warning' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                  'bg-blue-900/20 border-blue-500/30 text-blue-400'
                }`}>
                  {t(`rec.${tip.key}`, tip.data)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consumable breakdown */}
      <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
        <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
          {t('categories.consumables')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ConsumableBar label={t('consumables.healthPotion')} pct={summary.healthPotionRate} />
          <ConsumableBar label={t('consumables.healthstone')} pct={summary.healthstoneRate} />
          <ConsumableBar label={t('consumables.combatPotion')} pct={summary.combatPotionRate} />
          <ConsumableBar label={t('consumables.flask')} pct={summary.avgFlaskUptime} />
          <ConsumableBar label={t('consumables.food')} pct={summary.foodRate} />
          <ConsumableBar label={t('consumables.augmentRune')} pct={summary.augmentRate} />
        </div>
      </div>
    </div>
  );
}
