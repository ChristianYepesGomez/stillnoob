/**
 * Mythic+ Coaching Engine
 * Analyzes Raider.IO data to generate actionable M+ coaching insights.
 */

import { MPLUS_BRACKETS } from '@stillnoob/shared';

/**
 * Analyze M+ data from Raider.IO and generate coaching insights.
 * @param {object} raiderIO - Transformed Raider.IO data from getCharacterRaiderIO()
 * @param {string} playerLevel - 'beginner' | 'intermediate' | 'advanced'
 * @returns {object} { dungeonAnalysis, scoreAnalysis, timingAnalysis, mplusTips }
 */
export function analyzeMythicPlus(raiderIO, playerLevel = 'beginner') {
  if (!raiderIO?.mythicPlus) return null;

  const { mythicPlus, bestRuns = [], recentRuns = [] } = raiderIO;

  const dungeonAnalysis = analyzeDungeonBalance(bestRuns);
  const timingAnalysis = analyzeTimingEfficiency(bestRuns);
  const upgradeAnalysis = analyzeUpgradePatterns(bestRuns);
  const pushTargets = identifyPushTargets(bestRuns, dungeonAnalysis);
  const scoreAnalysis = analyzeScore(mythicPlus);

  const mplusTips = generateMPlusTips({
    mythicPlus, bestRuns, recentRuns,
    dungeonAnalysis, timingAnalysis, upgradeAnalysis, pushTargets, scoreAnalysis,
  }, playerLevel);

  return {
    dungeonAnalysis,
    scoreAnalysis,
    timingAnalysis,
    upgradeAnalysis,
    pushTargets,
    mplusTips,
  };
}

/**
 * Merge M+ tips into the existing recommendations structure.
 */
export function mergeMPlusTips(recommendations, mplusTips) {
  if (!recommendations || !mplusTips?.length) return;
  const primary = mplusTips.filter(t => t.priority <= 3);
  const secondary = mplusTips.filter(t => t.priority > 3);
  recommendations.primaryTips = [...(recommendations.primaryTips || []), ...primary];
  recommendations.secondaryTips = [...(recommendations.secondaryTips || []), ...secondary];
  recommendations.primaryTips.sort((a, b) => a.priority - b.priority);
  recommendations.secondaryTips.sort((a, b) => a.priority - b.priority);
}

// ─── Analysis Functions ─────────────────────────────────────

function analyzeDungeonBalance(bestRuns) {
  if (!bestRuns.length) return { strongDungeons: [], weakDungeons: [], averageLevel: 0, levelSpread: 0, dungeonLevels: [] };

  // Group by dungeon, take the best level per dungeon
  const dungeonBest = new Map();
  for (const run of bestRuns) {
    const existing = dungeonBest.get(run.dungeon);
    if (!existing || run.level > existing.level) {
      dungeonBest.set(run.dungeon, run);
    }
  }

  const dungeonLevels = [...dungeonBest.entries()].map(([dungeon, run]) => ({
    dungeon,
    shortName: run.shortName,
    level: run.level,
    upgrades: run.upgrades,
    score: run.score,
  })).sort((a, b) => b.level - a.level);

  const levels = dungeonLevels.map(d => d.level);
  const averageLevel = levels.reduce((s, l) => s + l, 0) / levels.length;
  const maxLevel = Math.max(...levels);
  const minLevel = Math.min(...levels);
  const levelSpread = maxLevel - minLevel;

  const strongDungeons = dungeonLevels.filter(d => d.level >= averageLevel + 1);
  const weakDungeons = dungeonLevels.filter(d => d.level <= averageLevel - 1);

  return { dungeonLevels, strongDungeons, weakDungeons, averageLevel, levelSpread, maxLevel, minLevel };
}

function analyzeTimingEfficiency(bestRuns) {
  const runsWithTiming = bestRuns.filter(r => r.clearTimeMs && r.parTimeMs);
  if (!runsWithTiming.length) return { avgTimingPct: 0, tightRuns: [], easyRuns: [] };

  const withPct = runsWithTiming.map(run => ({
    dungeon: run.dungeon,
    shortName: run.shortName,
    level: run.level,
    timingPct: Math.round((run.clearTimeMs / run.parTimeMs) * 100),
    clearTimeMs: run.clearTimeMs,
    parTimeMs: run.parTimeMs,
  }));

  const avgTimingPct = Math.round(withPct.reduce((s, r) => s + r.timingPct, 0) / withPct.length);
  const tightRuns = withPct.filter(r => r.timingPct > 95);
  const easyRuns = withPct.filter(r => r.timingPct < 75);

  return { avgTimingPct, tightRuns, easyRuns, runs: withPct };
}

function analyzeUpgradePatterns(bestRuns) {
  if (!bestRuns.length) return { avgUpgrades: 0, untimed: 0, total: 0 };

  const total = bestRuns.length;
  const untimed = bestRuns.filter(r => r.upgrades === 0).length;
  const singleUpgrades = bestRuns.filter(r => r.upgrades === 1).length;
  const doubleUpgrades = bestRuns.filter(r => r.upgrades === 2).length;
  const tripleUpgrades = bestRuns.filter(r => r.upgrades >= 3).length;
  const avgUpgrades = bestRuns.reduce((s, r) => s + (r.upgrades || 0), 0) / total;

  return { avgUpgrades: Math.round(avgUpgrades * 10) / 10, untimed, singleUpgrades, doubleUpgrades, tripleUpgrades, total };
}

function identifyPushTargets(bestRuns, dungeonAnalysis) {
  if (!dungeonAnalysis.dungeonLevels?.length) return [];

  const { maxLevel, dungeonLevels } = dungeonAnalysis;

  return dungeonLevels
    .filter(d => d.level < maxLevel - 1)
    .map(d => ({
      dungeon: d.dungeon,
      shortName: d.shortName,
      currentLevel: d.level,
      targetLevel: Math.min(d.level + 2, maxLevel),
      gap: maxLevel - d.level,
      reason: d.level <= maxLevel - 3 ? 'large_gap' : 'moderate_gap',
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);
}

function analyzeScore(mythicPlus) {
  const score = mythicPlus.score || 0;
  const currentBracket = MPLUS_BRACKETS.find(b => score >= b.min && score <= b.max) || MPLUS_BRACKETS[0];
  const nextBracket = MPLUS_BRACKETS.find(b => b.min > score) || null;

  const roleScores = {
    dps: mythicPlus.scoreDps || 0,
    healer: mythicPlus.scoreHealer || 0,
    tank: mythicPlus.scoreTank || 0,
  };
  const mainRole = Object.entries(roleScores).sort((a, b) => b[1] - a[1])[0];
  const offRoles = Object.entries(roleScores).filter(([role]) => role !== mainRole[0] && roleScores[role] > 0);

  return { score, currentBracket, nextBracket, mainRole: { role: mainRole[0], score: mainRole[1] }, offRoles };
}

// ─── Tip Generation ─────────────────────────────────────────

function generateMPlusTips(ctx, playerLevel) {
  const tips = [];
  const { dungeonAnalysis, timingAnalysis, upgradeAnalysis, pushTargets, scoreAnalysis } = ctx;

  // 1. Dungeon gap detection
  if (dungeonAnalysis.levelSpread > 3 && dungeonAnalysis.weakDungeons.length > 0) {
    const weakest = dungeonAnalysis.weakDungeons[0];
    tips.push({
      category: 'mythicPlus', key: 'mplus_dungeon_gap',
      severity: dungeonAnalysis.levelSpread > 5 ? 'critical' : 'warning',
      priority: 1,
      data: { dungeon: weakest.dungeon, level: weakest.level, bestLevel: dungeonAnalysis.maxLevel, spread: dungeonAnalysis.levelSpread },
    });
  }

  // 2. Untimed best runs
  const untimedRuns = ctx.bestRuns.filter(r => r.upgrades === 0);
  if (untimedRuns.length > 0) {
    const dungeonNames = [...new Set(untimedRuns.map(r => r.dungeon))].slice(0, 3).join(', ');
    tips.push({
      category: 'mythicPlus', key: 'mplus_untimed_runs',
      severity: 'warning', priority: 2,
      data: { dungeons: dungeonNames, count: untimedRuns.length },
    });
  }

  // 3. Tight timing runs
  if (timingAnalysis.tightRuns?.length > 0) {
    const tightest = timingAnalysis.tightRuns[0];
    tips.push({
      category: 'mythicPlus', key: 'mplus_timing_tight',
      severity: 'info', priority: 5,
      data: { dungeon: tightest.dungeon, pct: tightest.timingPct, level: tightest.level },
    });
  }

  // 4. All timed (positive)
  if (ctx.bestRuns.length >= 4 && upgradeAnalysis.untimed === 0) {
    tips.push({
      category: 'mythicPlus', key: 'mplus_all_timed',
      severity: 'positive', priority: 6,
      data: { count: ctx.bestRuns.length, avgUpgrades: upgradeAnalysis.avgUpgrades },
    });
  }

  // 5. Push targets
  if (pushTargets.length > 0) {
    const top = pushTargets[0];
    tips.push({
      category: 'mythicPlus', key: 'mplus_push_target',
      severity: 'info', priority: 3,
      data: { dungeon: top.dungeon, current: top.currentLevel, target: top.targetLevel },
    });
  }

  // 6. Score bracket info
  if (scoreAnalysis.score > 0) {
    const bracketData = {
      score: Math.round(scoreAnalysis.score),
      bracket: scoreAnalysis.currentBracket.label,
    };
    if (scoreAnalysis.nextBracket) {
      bracketData.nextBracket = scoreAnalysis.nextBracket.label;
      bracketData.nextScore = scoreAnalysis.nextBracket.min;
    }
    tips.push({
      category: 'mythicPlus', key: 'mplus_score_bracket',
      severity: 'info', priority: 7,
      data: bracketData,
    });
  }

  // 7. Role score gap
  if (scoreAnalysis.offRoles.length > 0 && scoreAnalysis.mainRole.score > 500) {
    const biggestGap = scoreAnalysis.offRoles
      .filter(([, s]) => s > 0 && scoreAnalysis.mainRole.score - s > 300)
      .sort((a, b) => a[1] - b[1]);
    if (biggestGap.length > 0) {
      tips.push({
        category: 'mythicPlus', key: 'mplus_role_score_gap',
        severity: 'info', priority: 8,
        data: { role: biggestGap[0][0], roleScore: Math.round(biggestGap[0][1]), mainScore: Math.round(scoreAnalysis.mainRole.score) },
      });
    }
  }

  // 8. Low score coaching
  if (scoreAnalysis.score > 0 && scoreAnalysis.score < 1500 && playerLevel === 'beginner') {
    tips.push({
      category: 'mythicPlus', key: 'mplus_low_score',
      severity: 'info', priority: 4,
      data: { score: Math.round(scoreAnalysis.score) },
    });
  }

  return tips;
}
