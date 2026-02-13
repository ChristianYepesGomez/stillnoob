import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { DIFFICULTY_COLORS } from '@stillnoob/shared';
import MPlusScoreTrend from './MPlusScoreTrend';

function formatTime(ms) {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function KeystoneLevel({ level, upgrades }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="font-orbitron font-bold text-white">+{level}</span>
      {upgrades > 0 && (
        <span className="text-sunwell-gold text-[9px]">{'★'.repeat(Math.min(upgrades, 3))}</span>
      )}
    </span>
  );
}

function getDungeonColor(level, avgLevel) {
  if (level >= avgLevel + 2) return '#22c55e'; // green
  if (level >= avgLevel - 1) return '#eab308'; // yellow
  return '#ef4444'; // red
}

export default function MythicPlusSection({
  raiderIO,
  mplusAnalysis,
  characterId,
  compact = false,
}) {
  const { t } = useTranslation();

  if (!raiderIO) return null;

  const { mythicPlus, bestRuns, recentRuns, raidProgression, gear } = raiderIO;
  const da = mplusAnalysis?.dungeonAnalysis;
  const pushTargets = mplusAnalysis?.pushTargets || [];

  // Dungeon balance chart data
  const dungeonChartData = (da?.dungeonLevels || []).map((d) => ({
    name: d.shortName || d.dungeon.slice(0, 8),
    level: d.level,
    dungeon: d.dungeon,
  }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* M+ Score + Gear + Raid Progression summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-xl bg-void-mid/30 border border-void-bright/10">
          <p
            className="text-2xl font-bold font-orbitron m-0"
            style={{ color: mythicPlus.scoreColor }}
          >
            {Math.round(mythicPlus.score)}
          </p>
          <p className="text-[10px] text-void-text m-0 mt-1">{t('raiderio.mplusScore')}</p>
        </div>

        {gear && (
          <div className="text-center p-3 rounded-xl bg-void-mid/30 border border-void-bright/10">
            <p className="text-2xl font-bold font-orbitron text-sunwell-amber m-0">
              {gear.itemLevel}
            </p>
            <p className="text-[10px] text-void-text m-0 mt-1">{t('raiderio.itemLevel')}</p>
          </div>
        )}

        {raidProgression.length > 0 && (
          <div className="text-center p-3 rounded-xl bg-void-mid/30 border border-void-bright/10 col-span-2 sm:col-span-2">
            <p className="text-lg font-bold text-white m-0">{raidProgression[0].raid}</p>
            <div className="flex justify-center gap-3 mt-1">
              {raidProgression[0].mythic > 0 && (
                <span className="text-[10px]" style={{ color: DIFFICULTY_COLORS.Mythic }}>
                  {raidProgression[0].mythic}M
                </span>
              )}
              {raidProgression[0].heroic > 0 && (
                <span className="text-[10px]" style={{ color: DIFFICULTY_COLORS.Heroic }}>
                  {raidProgression[0].heroic}H
                </span>
              )}
              {raidProgression[0].normal > 0 && (
                <span className="text-[10px]" style={{ color: DIFFICULTY_COLORS.Normal }}>
                  {raidProgression[0].normal}N
                </span>
              )}
            </div>
            <p className="text-[10px] text-void-text m-0 mt-0.5">{t('raiderio.raidProgress')}</p>
          </div>
        )}
      </div>

      {/* Dungeon Balance Chart + Push Targets */}
      {!compact && da && dungeonChartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dungeon Balance */}
          <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
            <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
              {t('raiderio.dungeonBalance')}
            </p>
            <ResponsiveContainer width="100%" height={Math.max(dungeonChartData.length * 32, 120)}>
              <BarChart
                data={dungeonChartData}
                layout="vertical"
                margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  domain={[0, 'dataMax + 2']}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d0a1a',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value, _, entry) => [`+${value}`, entry.payload.dungeon]}
                />
                <Bar dataKey="level" radius={[0, 4, 4, 0]}>
                  {dungeonChartData.map((entry, i) => (
                    <Cell key={i} fill={getDungeonColor(entry.level, da.averageLevel)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Push Targets */}
          <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
            <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
              {t('raiderio.pushTargets')}
            </p>
            {pushTargets.length === 0 ? (
              <p className="text-xs text-void-text/50">{t('common.noData')}</p>
            ) : (
              <div className="space-y-2">
                {pushTargets.map((target, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-void-deep/50 border border-void-bright/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white font-medium">{target.dungeon}</span>
                      <span className="text-xs">
                        <span className="text-red-400">+{target.currentLevel}</span>
                        <span className="text-void-text mx-1">&rarr;</span>
                        <span className="text-green-400">+{target.targetLevel}</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-void-secondary mt-1">
                      {target.gap} levels below your best
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score Trend */}
      {!compact && characterId && (
        <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
          <MPlusScoreTrend characterId={characterId} />
        </div>
      )}

      {/* Best M+ Runs */}
      {!compact && bestRuns.length > 0 && (
        <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
          <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
            {t('raiderio.bestRuns')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {bestRuns.map((run, i) => (
              <a
                key={i}
                href={run.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-lg bg-void-deep/50 border border-void-bright/5 hover:border-void-bright/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{run.dungeon}</p>
                  <p className="text-[10px] text-void-secondary">{formatTime(run.clearTimeMs)}</p>
                </div>
                <KeystoneLevel level={run.level} upgrades={run.upgrades} />
                <span className="text-[10px] font-bold text-void-accent">
                  {Math.round(run.score)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {!compact && recentRuns.length > 0 && (
        <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
          <p className="text-xs text-void-text mb-3 font-semibold uppercase tracking-wider">
            {t('raiderio.recentRuns')}
          </p>
          <div className="space-y-1.5">
            {recentRuns.map((run, i) => (
              <a
                key={i}
                href={run.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-void-surface/10 transition-colors"
              >
                <span className="text-xs text-void-secondary w-16">
                  {run.completedAt
                    ? new Date(run.completedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
                <span className="text-xs text-white flex-1 truncate">{run.dungeon}</span>
                <KeystoneLevel level={run.level} upgrades={run.upgrades} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
