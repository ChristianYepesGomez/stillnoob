/**
 * Mythic+ Analysis Engine
 * Analyzes Raider.IO data to produce visual analysis data (charts, brackets, trends).
 * Coaching tips are generated separately by the build analysis system (Phase 3+4).
 */

import { MPLUS_BRACKETS } from '@stillnoob/shared';

/**
 * Analyze M+ data from Raider.IO for visual display.
 * @param {object} raiderIO - Transformed Raider.IO data from getCharacterRaiderIO()
 * @returns {object} { dungeonAnalysis, scoreAnalysis, timingAnalysis, upgradeAnalysis, pushTargets }
 */
export function analyzeMythicPlus(raiderIO) {
  if (!raiderIO?.mythicPlus) return null;

  const { mythicPlus, bestRuns = [] } = raiderIO;

  const dungeonAnalysis = analyzeDungeonBalance(bestRuns);
  const timingAnalysis = analyzeTimingEfficiency(bestRuns);
  const upgradeAnalysis = analyzeUpgradePatterns(bestRuns);
  const pushTargets = identifyPushTargets(bestRuns, dungeonAnalysis);
  const scoreAnalysis = analyzeScore(mythicPlus);

  return {
    dungeonAnalysis,
    scoreAnalysis,
    timingAnalysis,
    upgradeAnalysis,
    pushTargets,
  };
}

// ─── Analysis Functions ─────────────────────────────────────

function analyzeDungeonBalance(bestRuns) {
  if (!bestRuns.length)
    return {
      strongDungeons: [],
      weakDungeons: [],
      averageLevel: 0,
      levelSpread: 0,
      dungeonLevels: [],
    };

  // Group by dungeon, take the best level per dungeon
  const dungeonBest = new Map();
  for (const run of bestRuns) {
    const existing = dungeonBest.get(run.dungeon);
    if (!existing || run.level > existing.level) {
      dungeonBest.set(run.dungeon, run);
    }
  }

  const dungeonLevels = [...dungeonBest.entries()]
    .map(([dungeon, run]) => ({
      dungeon,
      shortName: run.shortName,
      level: run.level,
      upgrades: run.upgrades,
      score: run.score,
    }))
    .sort((a, b) => b.level - a.level);

  const levels = dungeonLevels.map((d) => d.level);
  const averageLevel = levels.reduce((s, l) => s + l, 0) / levels.length;
  const maxLevel = Math.max(...levels);
  const minLevel = Math.min(...levels);
  const levelSpread = maxLevel - minLevel;

  const strongDungeons = dungeonLevels.filter((d) => d.level >= averageLevel + 1);
  const weakDungeons = dungeonLevels.filter((d) => d.level <= averageLevel - 1);

  return {
    dungeonLevels,
    strongDungeons,
    weakDungeons,
    averageLevel,
    levelSpread,
    maxLevel,
    minLevel,
  };
}

function analyzeTimingEfficiency(bestRuns) {
  const runsWithTiming = bestRuns.filter((r) => r.clearTimeMs && r.parTimeMs);
  if (!runsWithTiming.length) return { avgTimingPct: 0, tightRuns: [], easyRuns: [] };

  const withPct = runsWithTiming.map((run) => ({
    dungeon: run.dungeon,
    shortName: run.shortName,
    level: run.level,
    timingPct: Math.round((run.clearTimeMs / run.parTimeMs) * 100),
    clearTimeMs: run.clearTimeMs,
    parTimeMs: run.parTimeMs,
  }));

  const avgTimingPct = Math.round(withPct.reduce((s, r) => s + r.timingPct, 0) / withPct.length);
  const tightRuns = withPct.filter((r) => r.timingPct > 95);
  const easyRuns = withPct.filter((r) => r.timingPct < 75);

  return { avgTimingPct, tightRuns, easyRuns, runs: withPct };
}

function analyzeUpgradePatterns(bestRuns) {
  if (!bestRuns.length) return { avgUpgrades: 0, untimed: 0, total: 0 };

  const total = bestRuns.length;
  const untimed = bestRuns.filter((r) => r.upgrades === 0).length;
  const singleUpgrades = bestRuns.filter((r) => r.upgrades === 1).length;
  const doubleUpgrades = bestRuns.filter((r) => r.upgrades === 2).length;
  const tripleUpgrades = bestRuns.filter((r) => r.upgrades >= 3).length;
  const avgUpgrades = bestRuns.reduce((s, r) => s + (r.upgrades || 0), 0) / total;

  return {
    avgUpgrades: Math.round(avgUpgrades * 10) / 10,
    untimed,
    singleUpgrades,
    doubleUpgrades,
    tripleUpgrades,
    total,
  };
}

function identifyPushTargets(bestRuns, dungeonAnalysis) {
  if (!dungeonAnalysis.dungeonLevels?.length) return [];

  const { maxLevel, dungeonLevels } = dungeonAnalysis;

  return dungeonLevels
    .filter((d) => d.level < maxLevel - 1)
    .map((d) => ({
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
  const currentBracket =
    MPLUS_BRACKETS.find((b) => score >= b.min && score <= b.max) || MPLUS_BRACKETS[0];
  const nextBracket = MPLUS_BRACKETS.find((b) => b.min > score) || null;

  const roleScores = {
    dps: mythicPlus.scoreDps || 0,
    healer: mythicPlus.scoreHealer || 0,
    tank: mythicPlus.scoreTank || 0,
  };
  const mainRole = Object.entries(roleScores).sort((a, b) => b[1] - a[1])[0];
  const offRoles = Object.entries(roleScores).filter(
    ([role]) => role !== mainRole[0] && roleScores[role] > 0,
  );

  return {
    score,
    currentBracket,
    nextBracket,
    mainRole: { role: mainRole[0], score: mainRole[1] },
    offRoles,
  };
}
