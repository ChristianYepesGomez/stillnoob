import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { DIFFICULTY_COLORS } from '@stillnoob/shared';
import StatCard from './StatCard';
import ConsumableBar from './ConsumableBar';

function formatDps(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : Math.round(val);
}

export default function BossesSection({ data }) {
  const { t } = useTranslation();
  const { bossBreakdown, recentFights } = data;
  const [selectedBoss, setSelectedBoss] = useState(null);

  const boss = selectedBoss || bossBreakdown?.[0];

  const bossFightData = useMemo(() => {
    if (!recentFights || !boss) return [];
    return recentFights
      .filter(f => f.boss === boss.bossName && f.difficulty === boss.difficulty)
      .reverse()
      .map((f, i) => ({
        attempt: i + 1,
        dps: Math.round(f.dps),
        deaths: f.deaths,
      }));
  }, [recentFights, boss]);

  if (!bossBreakdown?.length) {
    return <p className="text-center py-10 text-void-text/60">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Boss selector */}
      <div className="flex flex-wrap gap-2">
        {bossBreakdown.map((b) => (
          <button
            key={`${b.bossId}-${b.difficulty}`}
            onClick={() => setSelectedBoss(b)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              boss?.bossId === b.bossId && boss?.difficulty === b.difficulty
                ? 'bg-void-bright/20 border-void-bright text-white'
                : 'bg-void-deep border-void-bright/20 text-void-text hover:text-white'
            }`}
          >
            {b.bossName}
            <span
              className="ml-1.5 text-[10px] px-1 py-0.5 rounded"
              style={{ backgroundColor: `${DIFFICULTY_COLORS[b.difficulty]}20`, color: DIFFICULTY_COLORS[b.difficulty] }}
            >
              {b.difficulty}
            </span>
          </button>
        ))}
      </div>

      {boss && (
        <>
          {/* Boss stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label={t('analysis.totalFights')} value={boss.fights} color="text-white" />
            <StatCard
              label={t('analysis.deathsPerFight')}
              value={boss.deathRate.toFixed(2)}
              color={boss.deathRate > 0.3 ? 'text-red-400' : 'text-green-400'}
            />
            <StatCard label={t('analysis.avgDps')} value={formatDps(boss.avgDps)} color="text-blue-400" />
            <StatCard label={t('analysis.bestDps')} value={formatDps(boss.bestDps)} color="text-purple-400" />
            <StatCard
              label={t('analysis.interrupts')}
              value={(boss.interruptsPerFight || 0).toFixed(1)}
              color="text-yellow-400"
            />
            <StatCard
              label={t('analysis.dispels')}
              value={(boss.dispelsPerFight || 0).toFixed(1)}
              color="text-teal-400"
            />
          </div>

          {/* DPS chart per attempt */}
          {bossFightData.length > 1 && (
            <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
              <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
                {t('analysis.dpsTrend')}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={bossFightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a0f2e33" />
                  <XAxis dataKey="attempt" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => formatDps(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12091f', border: '1px solid #1a0f2e', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="dps" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Consumable bars */}
          <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
            <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
              {t('categories.consumables')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ConsumableBar label={t('consumables.healthPotion')} pct={boss.healthPotionRate} />
              <ConsumableBar label={t('consumables.healthstone')} pct={boss.healthstoneRate} />
              <ConsumableBar label={t('consumables.combatPotion')} pct={boss.combatPotionRate} />
              <ConsumableBar label={t('consumables.flask')} pct={boss.flaskUptime} />
              <ConsumableBar label={t('consumables.food')} pct={boss.foodRate} />
              <ConsumableBar label={t('consumables.augmentRune')} pct={boss.augmentRate} />
            </div>
          </div>

          {/* DPS vs Median */}
          <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
            <p className="text-xs text-void-text mb-2 font-semibold uppercase tracking-wider">
              {t('analysis.dpsVsMedian')}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-void-surface/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(boss.dpsVsMedian || 100, 150) / 1.5}%`,
                    backgroundColor: boss.dpsVsMedian >= 100 ? '#22c55e' : boss.dpsVsMedian >= 80 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-sm font-bold" style={{
                color: boss.dpsVsMedian >= 100 ? '#22c55e' : boss.dpsVsMedian >= 80 ? '#eab308' : '#ef4444',
              }}>
                {Math.round(boss.dpsVsMedian || 100)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
