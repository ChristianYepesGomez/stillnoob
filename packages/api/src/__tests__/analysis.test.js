import { describe, it, expect } from 'vitest';
import { calculateStillNoobScore, detectPlayerLevel, generateRecommendations } from '../services/analysis.js';

// ─── Helpers ─────────────────────────────────────────────────

/** Builds a summary object with sensible defaults, overridable by `overrides`. */
function makeSummary(overrides = {}) {
  return {
    totalFights: 10,
    avgDps: 5000,
    avgHps: 0,
    avgDtps: 2000,
    deathRate: 0.1,
    consumableScore: 80,
    dpsVsMedianPct: 105,
    healthPotionRate: 60,
    healthstoneRate: 40,
    combatPotionRate: 75,
    avgFlaskUptime: 95,
    foodRate: 90,
    augmentRate: 50,
    avgInterrupts: 2,
    avgDispels: 1,
    avgActiveTime: 88,
    avgCpm: 35,
    avgParsePercentile: null,
    ...overrides,
  };
}

/** Builds a boss breakdown entry. */
function makeBoss(overrides = {}) {
  return {
    bossId: 1001,
    bossName: 'Vexus',
    difficulty: 'Heroic',
    fights: 5,
    deaths: 1,
    deathRate: 0.2,
    avgDps: 5000,
    bestDps: 6000,
    avgDtps: 2000,
    healthPotionRate: 60,
    healthstoneRate: 40,
    combatPotionRate: 70,
    interruptsPerFight: 2,
    dispelsPerFight: 1,
    dpsVsMedian: 105,
    avgActiveTime: 88,
    avgCpm: 35,
    ...overrides,
  };
}

/** Builds a weekly trend entry. */
function makeWeek(overrides = {}) {
  return {
    weekStart: '2026-02-06',
    fights: 5,
    avgDps: 5000,
    avgHps: 0,
    avgDeaths: 0.2,
    avgDtps: 2000,
    consumableScore: 80,
    avgActiveTime: 88,
    avgCpm: 35,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
//  calculateStillNoobScore
// ═══════════════════════════════════════════════════════════════

describe('calculateStillNoobScore', () => {
  it('returns zero score when no fights', () => {
    const result = calculateStillNoobScore({ totalFights: 0 }, []);
    expect(result.total).toBe(0);
    expect(result.tier.key).toBe('noob');
    expect(result.breakdown.performance).toBe(0);
  });

  it('returns zero score when summary is null', () => {
    const result = calculateStillNoobScore(null, []);
    expect(result.total).toBe(0);
  });

  it('calculates a mid-range score for average player', () => {
    const summary = makeSummary({ dpsVsMedianPct: 100, deathRate: 0.2, consumableScore: 60 });
    const result = calculateStillNoobScore(summary, []);
    expect(result.total).toBeGreaterThan(30);
    expect(result.total).toBeLessThan(80);
    expect(result.breakdown.performance).toBeGreaterThan(0);
    expect(result.breakdown.survival).toBeGreaterThan(0);
    expect(result.breakdown.preparation).toBeGreaterThan(0);
  });

  it('assigns high score for excellent stats', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 130,
      deathRate: 0,
      consumableScore: 100,
      avgInterrupts: 5,
      avgDispels: 3,
    });
    const bosses = [
      makeBoss({ avgDps: 7000 }),
      makeBoss({ bossName: 'Boss2', avgDps: 7100 }),
      makeBoss({ bossName: 'Boss3', avgDps: 6900 }),
    ];
    const result = calculateStillNoobScore(summary, bosses);
    expect(result.total).toBeGreaterThanOrEqual(85);
    expect(result.tier.key).not.toBe('noob');
  });

  it('assigns low score for poor stats', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 65,
      deathRate: 0.5,
      consumableScore: 10,
      avgInterrupts: 0,
      avgDispels: 0,
    });
    const result = calculateStillNoobScore(summary, []);
    expect(result.total).toBeLessThan(25);
  });

  it('performance score: 70% median maps to 0, 130%+ maps to 100', () => {
    const low = calculateStillNoobScore(makeSummary({ dpsVsMedianPct: 70 }), []);
    const high = calculateStillNoobScore(makeSummary({ dpsVsMedianPct: 135 }), []);
    expect(low.breakdown.performance).toBe(0);
    expect(high.breakdown.performance).toBe(100);
  });

  it('survival score: 0 deaths = 100, 0.5+ = 0', () => {
    const perfect = calculateStillNoobScore(makeSummary({ deathRate: 0 }), []);
    const worst = calculateStillNoobScore(makeSummary({ deathRate: 0.6 }), []);
    expect(perfect.breakdown.survival).toBe(100);
    expect(worst.breakdown.survival).toBe(0);
  });

  it('utility score scales with interrupts + dispels', () => {
    const none = calculateStillNoobScore(makeSummary({ avgInterrupts: 0, avgDispels: 0 }), []);
    const maxed = calculateStillNoobScore(makeSummary({ avgInterrupts: 3, avgDispels: 2 }), []);
    expect(none.breakdown.utility).toBe(0);
    expect(maxed.breakdown.utility).toBe(100);
  });

  it('consistency score degrades with high DPS variance across bosses', () => {
    const consistent = [
      makeBoss({ avgDps: 5000 }),
      makeBoss({ bossName: 'B2', avgDps: 5200 }),
      makeBoss({ bossName: 'B3', avgDps: 4800 }),
    ];
    const inconsistent = [
      makeBoss({ avgDps: 8000 }),
      makeBoss({ bossName: 'B2', avgDps: 3000 }),
      makeBoss({ bossName: 'B3', avgDps: 5000 }),
    ];
    const c = calculateStillNoobScore(makeSummary(), consistent);
    const i = calculateStillNoobScore(makeSummary(), inconsistent);
    expect(c.breakdown.consistency).toBeGreaterThan(i.breakdown.consistency);
  });

  it('tier matches score range', () => {
    // Exact boundaries
    const zero = calculateStillNoobScore(makeSummary({ totalFights: 0 }), []);
    expect(zero.tier.key).toBe('noob');

    const summary = makeSummary({
      dpsVsMedianPct: 130,
      deathRate: 0,
      consumableScore: 100,
      avgInterrupts: 5,
      avgDispels: 3,
    });
    const bosses = [
      makeBoss({ avgDps: 7000 }),
      makeBoss({ bossName: 'B2', avgDps: 7050 }),
      makeBoss({ bossName: 'B3', avgDps: 6950 }),
    ];
    const high = calculateStillNoobScore(summary, bosses);
    expect(high.total).toBeGreaterThanOrEqual(high.tier.min);
    expect(high.total).toBeLessThanOrEqual(high.tier.max);
  });

  it('total score is clamped between 0 and 100', () => {
    const low = calculateStillNoobScore(makeSummary({ dpsVsMedianPct: 0, deathRate: 10, consumableScore: 0, avgInterrupts: 0, avgDispels: 0 }), []);
    const high = calculateStillNoobScore(makeSummary({ dpsVsMedianPct: 200, deathRate: 0, consumableScore: 200, avgInterrupts: 10, avgDispels: 10 }), [
      makeBoss({ avgDps: 5000 }), makeBoss({ bossName: 'B2', avgDps: 5000 }), makeBoss({ bossName: 'B3', avgDps: 5000 }),
    ]);
    expect(low.total).toBeGreaterThanOrEqual(0);
    expect(high.total).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════
//  detectPlayerLevel
// ═══════════════════════════════════════════════════════════════

describe('detectPlayerLevel', () => {
  it('returns beginner for null/missing summary', () => {
    expect(detectPlayerLevel(null, [])).toBe('beginner');
    expect(detectPlayerLevel({ totalFights: 0 }, [])).toBe('beginner');
  });

  it('returns beginner for low stats', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 70,
      deathRate: 0.5,
      consumableScore: 20,
      avgActiveTime: 60,
      avgParsePercentile: 10,
    });
    expect(detectPlayerLevel(summary, [])).toBe('beginner');
  });

  it('returns intermediate for decent stats', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 100,
      deathRate: 0.15,
      consumableScore: 60,
      avgActiveTime: 86,
      avgParsePercentile: 50,
    });
    const bosses = [
      makeBoss({ avgDps: 5000 }),
      makeBoss({ bossName: 'B2', avgDps: 5100 }),
      makeBoss({ bossName: 'B3', avgDps: 4900 }),
    ];
    expect(detectPlayerLevel(summary, bosses)).toBe('intermediate');
  });

  it('returns advanced for excellent stats', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 120,
      deathRate: 0.03,
      consumableScore: 90,
      avgActiveTime: 95,
      avgParsePercentile: 80,
    });
    const bosses = [
      makeBoss({ avgDps: 7000 }),
      makeBoss({ bossName: 'B2', avgDps: 7100 }),
      makeBoss({ bossName: 'B3', avgDps: 6900 }),
    ];
    const raiderIO = {
      mythicPlus: { score: 3000 },
      raidProgression: [{ mythic: 3, heroic: 8 }],
    };
    expect(detectPlayerLevel(summary, bosses, raiderIO)).toBe('advanced');
  });

  it('works without raiderIO data (graceful undefined)', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 105,
      deathRate: 0.1,
      consumableScore: 70,
      avgActiveTime: 88,
      avgParsePercentile: 55,
    });
    // Should not throw
    const level = detectPlayerLevel(summary, [], undefined);
    expect(['beginner', 'intermediate', 'advanced']).toContain(level);
  });

  it('raiderIO M+ score contributes to level', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 100,
      deathRate: 0.12,
      consumableScore: 55,
      avgActiveTime: 86,
      avgParsePercentile: 45,
    });
    const withoutIO = detectPlayerLevel(summary, []);
    const withHighIO = detectPlayerLevel(summary, [], {
      mythicPlus: { score: 3000 },
      raidProgression: [{ mythic: 5, heroic: 8 }],
    });
    // With high raiderIO, the level should be the same or higher
    const levels = ['beginner', 'intermediate', 'advanced'];
    expect(levels.indexOf(withHighIO)).toBeGreaterThanOrEqual(levels.indexOf(withoutIO));
  });

  it('consistency affects level (low variance = higher score)', () => {
    const summary = makeSummary({
      dpsVsMedianPct: 100,
      deathRate: 0.12,
      consumableScore: 55,
      avgActiveTime: 87,
      avgParsePercentile: 50,
    });
    const consistent = [
      makeBoss({ avgDps: 5000 }),
      makeBoss({ bossName: 'B2', avgDps: 5100 }),
      makeBoss({ bossName: 'B3', avgDps: 4900 }),
    ];
    const inconsistent = [
      makeBoss({ avgDps: 8000 }),
      makeBoss({ bossName: 'B2', avgDps: 3000 }),
      makeBoss({ bossName: 'B3', avgDps: 5000 }),
    ];
    const levelConsistent = detectPlayerLevel(summary, consistent);
    const levelInconsistent = detectPlayerLevel(summary, inconsistent);
    const levels = ['beginner', 'intermediate', 'advanced'];
    expect(levels.indexOf(levelConsistent)).toBeGreaterThanOrEqual(levels.indexOf(levelInconsistent));
  });
});

// ═══════════════════════════════════════════════════════════════
//  generateRecommendations
// ═══════════════════════════════════════════════════════════════

describe('generateRecommendations', () => {
  it('returns empty tips when no fights', () => {
    const result = generateRecommendations({
      summary: { totalFights: 0 },
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    expect(result.primaryTips).toEqual([]);
    expect(result.secondaryTips).toEqual([]);
    expect(result.playerLevel).toBe('beginner');
  });

  it('returns empty tips for null summary', () => {
    const result = generateRecommendations({
      summary: null,
      bossBreakdown: [],
      weeklyTrends: [],
    });
    expect(result.primaryTips).toEqual([]);
  });

  it('generates insufficient_data tip when < 3 fights', () => {
    const result = generateRecommendations({
      summary: makeSummary({ totalFights: 2, dpsVsMedianPct: 100, deathRate: 0, avgFlaskUptime: 100, combatPotionRate: 100, foodRate: 100, healthPotionRate: 100, healthstoneRate: 100 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'insufficient_data')).toBe(true);
  });

  it('generates high_death_rate for > 0.4 death rate', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.5 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'high_death_rate' && t.severity === 'critical')).toBe(true);
  });

  it('generates moderate_death_rate for 0.2-0.4', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.3 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'moderate_death_rate')).toBe(true);
  });

  it('generates good_survival for low death rate', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.05 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'good_survival')).toBe(true);
  });

  it('generates below_raid_median for < 80% DPS', () => {
    const result = generateRecommendations({
      summary: makeSummary({ dpsVsMedianPct: 70 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'below_raid_median' && t.severity === 'critical')).toBe(true);
  });

  it('generates above_raid_median for > 110% DPS', () => {
    const result = generateRecommendations({
      summary: makeSummary({ dpsVsMedianPct: 120 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'above_raid_median' && t.severity === 'positive')).toBe(true);
  });

  it('generates low_flask tip when flask uptime < 90%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgFlaskUptime: 50 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_flask')).toBe(true);
  });

  it('generates low_combat_potion when < 70%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ combatPotionRate: 40 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_combat_potion')).toBe(true);
  });

  it('generates good_consumables when all consumable usage is high', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        healthPotionRate: 70,
        combatPotionRate: 80,
        avgFlaskUptime: 95,
        foodRate: 90,
        healthstoneRate: 50,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'good_consumables')).toBe(true);
  });

  it('generates low_active_time when < 85%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 65 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'low_active_time');
    expect(tip).toBeDefined();
    expect(tip.severity).toBe('critical'); // < 70 is critical
  });

  it('generates low_cpm when < 30', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgCpm: 18 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_cpm')).toBe(true);
  });

  it('generates low_parse for avgParsePercentile < 25', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 15 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_parse' && t.severity === 'critical')).toBe(true);
  });

  it('generates high_parse for avgParsePercentile >= 75', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 85 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'high_parse')).toBe(true);
  });

  // ── Trend-based tips ──

  it('generates dps_improving when DPS rises 10%+ over 4 weeks', () => {
    const trends = [
      makeWeek({ weekStart: '2026-01-16', avgDps: 4000, avgDeaths: 0.3 }),
      makeWeek({ weekStart: '2026-01-23', avgDps: 4100, avgDeaths: 0.3 }),
      makeWeek({ weekStart: '2026-01-30', avgDps: 4800, avgDeaths: 0.2 }),
      makeWeek({ weekStart: '2026-02-06', avgDps: 5000, avgDeaths: 0.1 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ dpsVsMedianPct: 105 }),
      bossBreakdown: [],
      weeklyTrends: trends,
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'dps_improving')).toBe(true);
  });

  it('generates dps_declining when DPS drops 10%+ over 4 weeks', () => {
    const trends = [
      makeWeek({ weekStart: '2026-01-16', avgDps: 5500, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-23', avgDps: 5400, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-30', avgDps: 4500, avgDeaths: 0.2 }),
      makeWeek({ weekStart: '2026-02-06', avgDps: 4200, avgDeaths: 0.2 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: [],
      weeklyTrends: trends,
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'dps_declining')).toBe(true);
  });

  it('generates dps_stagnating for intermediate/advanced when DPS flat', () => {
    const trends = [
      makeWeek({ weekStart: '2026-01-16', avgDps: 5000, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-23', avgDps: 5050, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-30', avgDps: 5000, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-02-06', avgDps: 5020, avgDeaths: 0.1 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: [],
      weeklyTrends: trends,
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'dps_stagnating')).toBe(true);
  });

  it('does NOT generate dps_stagnating for beginners', () => {
    const trends = [
      makeWeek({ weekStart: '2026-01-16', avgDps: 5000, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-23', avgDps: 5050, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-01-30', avgDps: 5000, avgDeaths: 0.1 }),
      makeWeek({ weekStart: '2026-02-06', avgDps: 5020, avgDeaths: 0.1 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: [],
      weeklyTrends: trends,
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'dps_stagnating')).toBe(false);
  });

  // ── Boss-specific tips ──

  it('generates weakest_boss for intermediate/advanced with gap > 15', () => {
    const bosses = [
      makeBoss({ bossName: 'Strong Boss', dpsVsMedian: 120, fights: 3, avgDps: 6000 }),
      makeBoss({ bossId: 1002, bossName: 'Weak Boss', dpsVsMedian: 85, fights: 3, avgDps: 4000 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'weakest_boss');
    expect(tip).toBeDefined();
    expect(tip.data.weakBoss).toBe('Weak Boss');
    expect(tip.data.strongBoss).toBe('Strong Boss');
  });

  it('does NOT generate weakest_boss for beginners', () => {
    const bosses = [
      makeBoss({ bossName: 'Strong Boss', dpsVsMedian: 130, fights: 3, avgDps: 6000 }),
      makeBoss({ bossId: 1002, bossName: 'Weak Boss', dpsVsMedian: 80, fights: 3, avgDps: 3500 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'weakest_boss')).toBe(false);
  });

  it('generates deadliest_boss for intermediate/advanced', () => {
    const bosses = [
      makeBoss({ bossName: 'Safe Boss', deathRate: 0.05, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Deadly Boss', deathRate: 0.4, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'deadliest_boss');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Deadly Boss');
  });

  it('generates high_damage_boss when a boss dtps is 1.4x above average', () => {
    const bosses = [
      makeBoss({ bossName: 'Normal Boss', avgDtps: 2000, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Painful Boss', avgDtps: 5000, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgDtps: 2500 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'high_damage_boss' && t.data.boss === 'Painful Boss')).toBe(true);
  });

  // ── Utility tips ──

  it('generates low_interrupts when avg < 1 with enough fights', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgInterrupts: 0.3, totalFights: 10 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_interrupts')).toBe(true);
  });

  it('generates good_interrupts when avg >= 3', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgInterrupts: 4 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'good_interrupts')).toBe(true);
  });

  it('generates good_dispels when avg >= 2', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgDispels: 3 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'good_dispels')).toBe(true);
  });

  // ── Tip splitting and ordering ──

  it('respects TIP_LIMITS per player level', () => {
    // Beginner: 3 primary tips
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, dpsVsMedianPct: 60, avgFlaskUptime: 30,
        combatPotionRate: 20, foodRate: 10, healthPotionRate: 10,
        healthstoneRate: 5, avgActiveTime: 60, avgCpm: 15,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    expect(result.primaryTips.length).toBe(3);
    expect(result.secondaryTips.length).toBeGreaterThan(0);
  });

  it('intermediate gets 5 primary tips', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, dpsVsMedianPct: 60, avgFlaskUptime: 30,
        combatPotionRate: 20, foodRate: 10, healthPotionRate: 10,
        healthstoneRate: 5, avgActiveTime: 60, avgCpm: 15,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    expect(result.primaryTips.length).toBe(5);
  });

  it('tips are sorted by priority (lowest number first)', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, dpsVsMedianPct: 60, avgFlaskUptime: 30,
        combatPotionRate: 20, foodRate: 10, healthPotionRate: 10,
        healthstoneRate: 5, avgActiveTime: 60, avgCpm: 15,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    for (let i = 1; i < allTips.length; i++) {
      expect(allTips[i].priority).toBeGreaterThanOrEqual(allTips[i - 1].priority);
    }
  });

  it('every tip has required fields', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.5, dpsVsMedianPct: 60 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    for (const tip of allTips) {
      expect(tip).toHaveProperty('category');
      expect(tip).toHaveProperty('key');
      expect(tip).toHaveProperty('severity');
      expect(tip).toHaveProperty('priority');
      expect(tip).toHaveProperty('data');
      expect(typeof tip.priority).toBe('number');
    }
  });

  it('playerLevel is passed through in the result', () => {
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    expect(result.playerLevel).toBe('advanced');
  });
});
