import { useTranslation } from 'react-i18next';
import { MPLUS_BRACKETS } from '@stillnoob/shared';

function getBracket(score) {
  return MPLUS_BRACKETS.find((b) => score >= b.min && score <= b.max) || MPLUS_BRACKETS[0];
}

function getNextBracket(score) {
  const idx = MPLUS_BRACKETS.findIndex((b) => score >= b.min && score <= b.max);
  return idx >= 0 && idx < MPLUS_BRACKETS.length - 1 ? MPLUS_BRACKETS[idx + 1] : null;
}

export default function MPlusVerdict({ mplusAnalysis, raiderIO }) {
  const { t } = useTranslation();
  const { dungeonAnalysis, scoreAnalysis, upgradeAnalysis, pushTargets } = mplusAnalysis;

  const score = scoreAnalysis?.score || raiderIO?.mythicPlus?.score || 0;
  const bracket = getBracket(score);
  const nextBracket = getNextBracket(score);
  const pointsToNext = nextBracket ? nextBracket.min - score : 0;

  const weakest = dungeonAnalysis?.weakDungeons?.[0];
  const gap = weakest ? dungeonAnalysis.maxLevel - weakest.level : 0;
  const untimedCount = upgradeAnalysis?.untimed || 0;
  const pushCount = pushTargets?.length || 0;

  return (
    <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          <i className="fas fa-dungeon mr-2 text-purple-400" />
          {t('public.mplusVerdict')}
        </h2>
        {bracket && (
          <span
            className="text-[10px] px-2 py-0.5 rounded font-semibold font-orbitron"
            style={{ color: bracket.color, backgroundColor: `${bracket.color}20`, border: `1px solid ${bracket.color}40` }}
          >
            {bracket.label}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Points to next bracket */}
        {nextBracket && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 border border-void-bright/5">
            <i className="fas fa-arrow-up text-void-accent" />
            <div>
              <p className="text-sm text-white">
                {t('public.pointsToNext', { points: pointsToNext, bracket: nextBracket.label })}
              </p>
              <div className="w-full bg-void-deep/80 rounded-full h-1.5 mt-1.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(((score - bracket.min) / (nextBracket.min - bracket.min)) * 100, 100)}%`,
                    backgroundColor: bracket.color,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Weakest dungeon */}
        {weakest && gap > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-900/10 border border-red-500/15">
            <i className="fas fa-chart-line-down text-red-400" />
            <p className="text-sm text-void-text">
              {t('public.weakestDungeon', { dungeon: weakest.dungeon, gap })}
            </p>
          </div>
        )}

        {/* Push targets */}
        {pushCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 border border-void-bright/5">
            <i className="fas fa-bullseye text-sunwell-amber" />
            <p className="text-sm text-void-text">
              {t('public.pushTargetSummary', { count: pushCount })}
            </p>
          </div>
        )}

        {/* Untimed runs */}
        {untimedCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-900/10 border border-yellow-500/15">
            <i className="fas fa-clock text-yellow-400" />
            <p className="text-sm text-void-text">
              {t('public.untimedRuns', { count: untimedCount })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
