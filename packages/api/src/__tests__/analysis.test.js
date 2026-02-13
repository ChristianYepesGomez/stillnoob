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
  // ── Structural tests ──

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

  it('every tip has required fields', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.5, avgActiveTime: 60, avgCpm: 15 }),
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

  it('tips are sorted by priority (lowest number first)', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, avgFlaskUptime: 30, combatPotionRate: 20,
        foodRate: 10, avgActiveTime: 60, avgCpm: 15,
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

  it('respects TIP_LIMITS: beginner gets 3 primary tips', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, avgFlaskUptime: 30, combatPotionRate: 20,
        foodRate: 10, avgActiveTime: 60, avgCpm: 15, avgParsePercentile: 10,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    expect(result.primaryTips.length).toBe(3);
    expect(result.secondaryTips.length).toBeGreaterThan(0);
  });

  it('respects TIP_LIMITS: intermediate gets 5 primary tips', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.5, avgFlaskUptime: 30, combatPotionRate: 20,
        foodRate: 10, avgActiveTime: 60, avgCpm: 15, avgParsePercentile: 10,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    expect(result.primaryTips.length).toBe(5);
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

  // ── Tier 1: Boss-Specific Tips ──

  it('generates boss_uptime_drop when active time drops ≥8pts on a boss', () => {
    const bosses = [
      makeBoss({ bossName: 'Easy Boss', avgActiveTime: 90, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Hard Boss', avgActiveTime: 72, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 88 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'boss_uptime_drop');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Hard Boss');
    expect(tip.data.drop).toBe(16);
  });

  it('does NOT generate boss_uptime_drop when drop < 8pts', () => {
    const bosses = [
      makeBoss({ bossName: 'Boss A', avgActiveTime: 85, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 88 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'boss_uptime_drop')).toBe(false);
  });

  it('generates boss_cpm_drop when boss CPM < 85% of average', () => {
    const bosses = [
      makeBoss({ bossName: 'Mechanic Boss', avgCpm: 25, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgCpm: 35 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'boss_cpm_drop');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Mechanic Boss');
  });

  it('generates boss_excess_damage when DTPS > 130% of average', () => {
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
    const tip = allTips.find(t => t.key === 'boss_excess_damage');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Painful Boss');
    expect(tip.data.excessPct).toBe(100);
  });

  it('generates boss_death_spike when boss deathRate > max(avg*2, 0.2)', () => {
    const bosses = [
      makeBoss({ bossName: 'Safe Boss', deathRate: 0.05, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Deadly Boss', deathRate: 0.4, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.1 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'boss_death_spike');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Deadly Boss');
  });

  it('generates boss_potion_neglect on weakest DPS boss with low pot rate', () => {
    const bosses = [
      makeBoss({ bossName: 'Strong Boss', dpsVsMedian: 120, combatPotionRate: 80, fights: 5, avgDps: 6000 }),
      makeBoss({ bossId: 1002, bossName: 'Weak Boss', dpsVsMedian: 90, combatPotionRate: 30, fights: 5, avgDps: 4000 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'boss_potion_neglect');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Weak Boss');
    expect(tip.data.rate).toBe(30);
    expect(tip.data.bestRate).toBe(80);
  });

  it('generates boss_weakest_dps when gap > 10% between bosses', () => {
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
    const tip = allTips.find(t => t.key === 'boss_weakest_dps');
    expect(tip).toBeDefined();
    expect(tip.data.weakBoss).toBe('Weak Boss');
    expect(tip.data.strongBoss).toBe('Strong Boss');
    expect(tip.data.gap).toBe(35);
  });

  it('does NOT generate boss tips for bosses with < 3 fights (except boss_weakest_dps with ≥2)', () => {
    const bosses = [
      makeBoss({ bossName: 'Boss A', avgActiveTime: 60, avgDtps: 8000, deathRate: 0.8, fights: 2 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 88, avgDtps: 2000, deathRate: 0.1 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'boss_uptime_drop')).toBe(false);
    expect(allTips.some(t => t.key === 'boss_excess_damage')).toBe(false);
    expect(allTips.some(t => t.key === 'boss_death_spike')).toBe(false);
  });

  // ── Tier 2: Cross-Pattern Tips ──

  it('generates deaths_from_damage when high-death boss also has high DTPS', () => {
    const bosses = [
      makeBoss({ bossId: 1001, bossName: 'Safe Boss', deathRate: 0.05, avgDtps: 1500, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Deadly Boss', deathRate: 0.3, avgDtps: 4000, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.15, avgDtps: 2000 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'deaths_from_damage');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Deadly Boss');
  });

  it('generates uptime_drives_dps when low-uptime boss has low DPS vs median', () => {
    const bosses = [
      makeBoss({ bossId: 1001, bossName: 'Good Boss', avgActiveTime: 90, dpsVsMedian: 115, fights: 5 }),
      makeBoss({ bossId: 1002, bossName: 'Bad Boss', avgActiveTime: 72, dpsVsMedian: 85, fights: 5 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 88 }),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'uptime_drives_dps');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Bad Boss');
  });

  it('generates parse_vs_raid when low parse but beating raid median', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 30, dpsVsMedianPct: 115 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'parse_vs_raid');
    expect(tip).toBeDefined();
    expect(tip.data.context).toBe('raid_low');
  });

  it('generates parse_vs_raid when high parse but not beating median', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 80, dpsVsMedianPct: 100 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'parse_vs_raid');
    expect(tip).toBeDefined();
    expect(tip.data.context).toBe('raid_strong');
  });

  it('generates defensive_gap when dying but not using defensives', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.3, healthstoneRate: 10, healthPotionRate: 20 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'defensive_gap');
    expect(tip).toBeDefined();
    expect(tip.data.healthstoneRate).toBe(10);
  });

  it('does NOT generate defensive_gap when healthstone usage is adequate', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.3, healthstoneRate: 50 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'defensive_gap')).toBe(false);
  });

  // ── Tier 3: General Tips ──

  it('generates high_death_rate for deathRate > 0.4', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.5 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'high_death_rate' && t.severity === 'critical')).toBe(true);
  });

  it('does NOT generate high_death_rate for deathRate ≤ 0.4', () => {
    const result = generateRecommendations({
      summary: makeSummary({ deathRate: 0.3 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'high_death_rate')).toBe(false);
  });

  it('generates low_active_time when < 85%, critical when < 70%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgActiveTime: 65 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'low_active_time');
    expect(tip).toBeDefined();
    expect(tip.severity).toBe('critical');
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

  it('generates low_flask when uptime < 90%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgFlaskUptime: 50 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_flask')).toBe(true);
  });

  it('generates low_combat_potion when < 60%', () => {
    const result = generateRecommendations({
      summary: makeSummary({ combatPotionRate: 40 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_combat_potion')).toBe(true);
  });

  it('generates low_parse for avgParsePercentile < 25 (critical)', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 15 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'beginner',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'low_parse' && t.severity === 'critical')).toBe(true);
  });

  it('generates below_avg_parse for parse 25-49', () => {
    const result = generateRecommendations({
      summary: makeSummary({ avgParsePercentile: 35 }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    expect(allTips.some(t => t.key === 'below_avg_parse' && t.severity === 'warning')).toBe(true);
  });

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

  it('generates good_preparation when all consumables are high', () => {
    const result = generateRecommendations({
      summary: makeSummary({
        healthPotionRate: 70, combatPotionRate: 80,
        avgFlaskUptime: 95, foodRate: 90,
      }),
      bossBreakdown: [],
      weeklyTrends: [],
      playerLevel: 'intermediate',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'good_preparation');
    expect(tip).toBeDefined();
    expect(tip.severity).toBe('positive');
  });

  it('generates strong_boss for best performing boss with > 110% vs median', () => {
    const bosses = [
      makeBoss({ bossName: 'Best Boss', dpsVsMedian: 125, fights: 3, avgDps: 7000 }),
      makeBoss({ bossId: 1002, bossName: 'Ok Boss', dpsVsMedian: 100, fights: 3, avgDps: 5000 }),
    ];
    const result = generateRecommendations({
      summary: makeSummary(),
      bossBreakdown: bosses,
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const tip = allTips.find(t => t.key === 'strong_boss');
    expect(tip).toBeDefined();
    expect(tip.data.boss).toBe('Best Boss');
    expect(tip.severity).toBe('positive');
  });

  // ── Removed tips should NOT appear ──

  it('does NOT generate removed tip keys', () => {
    const removedKeys = [
      'insufficient_data', 'moderate_death_rate', 'dps_stagnating',
      'dps_improving', 'dps_declining', 'improving_survival', 'worsening_survival',
      'good_survival', 'good_active_time', 'good_cpm', 'good_interrupts',
      'good_dispels', 'good_consistency', 'good_consumables',
      'above_raid_median', 'below_raid_median', 'inconsistent_dps',
      'high_damage_boss', 'deadliest_boss', 'weakest_boss', 'high_parse',
    ];
    const result = generateRecommendations({
      summary: makeSummary({
        deathRate: 0.05, dpsVsMedianPct: 120, avgActiveTime: 95,
        avgCpm: 40, avgParsePercentile: 85, avgInterrupts: 5, avgDispels: 4,
      }),
      bossBreakdown: [
        makeBoss({ bossName: 'A', dpsVsMedian: 130, deathRate: 0.4, avgDtps: 5000, fights: 5, avgDps: 7000 }),
        makeBoss({ bossId: 1002, bossName: 'B', dpsVsMedian: 80, deathRate: 0.01, avgDtps: 1000, fights: 5, avgDps: 4000 }),
      ],
      weeklyTrends: [],
      playerLevel: 'advanced',
    });
    const allTips = [...result.primaryTips, ...result.secondaryTips];
    const generatedKeys = allTips.map(t => t.key);
    for (const removed of removedKeys) {
      expect(generatedKeys).not.toContain(removed);
    }
  });
});
