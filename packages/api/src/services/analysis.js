import { db } from '../db/client.js';
import { fightPerformance } from '../db/schema.js';
import { CONSUMABLE_PATTERNS, BUFF_PATTERNS, CONSUMABLE_WEIGHTS, SCORE_WEIGHTS, SCORE_TIERS, LEVEL_DETECTION, TIP_LIMITS, AUTO_ATTACK_PATTERNS } from '@stillnoob/shared';

// ── In-memory analysis cache (TTL: 5 minutes) ──
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function buildCacheKey(characterId, { weeks, bossId, difficulty } = {}) {
  return `${characterId}:${weeks || ''}:${bossId || ''}:${difficulty || ''}`;
}

/**
 * Invalidate all cached analysis results for a character.
 * Call this when new report data is imported for that character.
 */
export function invalidateAnalysisCache(characterId) {
  const prefix = `${characterId}:`;
  for (const [key, entry] of analysisCache) {
    if (key.startsWith(prefix)) {
      clearTimeout(entry.timer);
      analysisCache.delete(key);
    }
  }
}

/**
 * Process extended fight data from WCL and store per-fight performance snapshots.
 * Called during report import for each fight.
 *
 * @param {number} storedFightId - DB fight ID (fights table)
 * @param {number} fightDurationMs - Fight duration in milliseconds
 * @param {object} basicStats - { damage, healing, damageTaken, deaths }
 * @param {object} extendedStats - { casts, buffs, interrupts, dispels }
 * @param {object} charMap - { "lowercaseName": characterId }
 * @returns {number} Number of records inserted
 */
export async function processExtendedFightData(storedFightId, fightDurationMs, basicStats, extendedStats, charMap) {
  const fightDurationSec = fightDurationMs / 1000;
  const playerData = {};

  const ensurePlayer = (name) => {
    if (!playerData[name]) {
      playerData[name] = {
        damageDone: 0, healingDone: 0, damageTaken: 0, deaths: 0,
        activeTime: 0, totalCasts: 0,
        healthPotions: 0, healthstones: 0, combatPotions: 0,
        flaskUptime: 0, foodBuff: false, augmentRune: false,
        interrupts: 0, dispels: 0,
      };
    }
  };

  // Basic stats
  for (const e of basicStats.damage || []) { ensurePlayer(e.name); playerData[e.name].damageDone = e.total || 0; playerData[e.name].activeTime = e.activeTime || 0; }
  for (const e of basicStats.healing || []) { ensurePlayer(e.name); playerData[e.name].healingDone = e.total || 0; }
  for (const e of basicStats.damageTaken || []) { ensurePlayer(e.name); playerData[e.name].damageTaken = e.total || 0; }
  for (const e of basicStats.deaths || []) { ensurePlayer(e.name); playerData[e.name].deaths = e.total || 0; }

  // Casts — scan for consumable usage + CPM tracking
  for (const entry of extendedStats.casts || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    const abilities = entry.abilities || entry.entries || [];
    for (const ability of abilities) {
      const name = ability.name || '';
      const castCount = ability.total || ability.hitCount || 0;

      // CPM: count non-auto-attack casts
      if (!AUTO_ATTACK_PATTERNS.test(name)) {
        playerData[entry.name].totalCasts += castCount;
      }

      if (CONSUMABLE_PATTERNS.healthPotion.test(name)) {
        playerData[entry.name].healthPotions += (castCount || 1);
      }
      if (CONSUMABLE_PATTERNS.healthstone.test(name)) {
        playerData[entry.name].healthstones += (castCount || 1);
      }
      if (CONSUMABLE_PATTERNS.combatPotion.test(name)) {
        playerData[entry.name].combatPotions += (castCount || 1);
      }
    }
  }

  // Buffs — flask, food, augment rune
  for (const entry of extendedStats.buffs || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    const auras = entry.abilities || entry.entries || [];
    for (const aura of auras) {
      const name = aura.name || '';
      const uptime = aura.uptime || 0;
      if (BUFF_PATTERNS.flask.test(name)) {
        playerData[entry.name].flaskUptime = Math.max(playerData[entry.name].flaskUptime, uptime);
      }
      if (BUFF_PATTERNS.food.test(name)) {
        playerData[entry.name].foodBuff = true;
      }
      if (BUFF_PATTERNS.augmentRune.test(name)) {
        playerData[entry.name].augmentRune = true;
      }
    }
  }

  // Interrupts & Dispels
  for (const entry of extendedStats.interrupts || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    playerData[entry.name].interrupts = entry.total || 0;
  }
  for (const entry of extendedStats.dispels || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    playerData[entry.name].dispels = entry.total || 0;
  }

  // Calculate raid medians
  const allDps = [];
  const allDtps = [];
  for (const data of Object.values(playerData)) {
    if (data.damageDone > 0 && fightDurationSec > 0) allDps.push(data.damageDone / fightDurationSec);
    if (data.damageTaken > 0 && fightDurationSec > 0) allDtps.push(data.damageTaken / fightDurationSec);
  }
  allDps.sort((a, b) => a - b);
  allDtps.sort((a, b) => a - b);
  const medianDps = allDps.length > 0 ? allDps[Math.floor(allDps.length / 2)] : 0;
  const medianDtps = allDtps.length > 0 ? allDtps[Math.floor(allDtps.length / 2)] : 0;

  // Insert per-player records (only for registered characters)
  let inserted = 0;
  for (const [playerName, data] of Object.entries(playerData)) {
    const characterId = charMap[playerName.toLowerCase()];
    if (!characterId) continue;

    const dps = fightDurationSec > 0 ? data.damageDone / fightDurationSec : 0;
    const hps = fightDurationSec > 0 ? data.healingDone / fightDurationSec : 0;
    const dtps = fightDurationSec > 0 ? data.damageTaken / fightDurationSec : 0;
    const activeTimePct = fightDurationMs > 0 ? (data.activeTime / fightDurationMs) * 100 : 0;
    const cpm = fightDurationMs > 0 ? data.totalCasts / (fightDurationMs / 60000) : 0;

    try {
      await db.insert(fightPerformance).values({
        fightId: storedFightId,
        characterId,
        damageDone: data.damageDone,
        healingDone: data.healingDone,
        damageTaken: data.damageTaken,
        deaths: data.deaths,
        dps, hps, dtps,
        activeTimePct,
        cpm,
        healthPotions: data.healthPotions,
        healthstones: data.healthstones,
        combatPotions: data.combatPotions,
        flaskUptimePct: data.flaskUptime,
        foodBuffActive: data.foodBuff,
        augmentRuneActive: data.augmentRune,
        interrupts: data.interrupts,
        dispels: data.dispels,
        raidMedianDps: medianDps,
        raidMedianDtps: medianDtps,
      }).onConflictDoNothing();
      inserted++;
    } catch (err) {
      if (!err.message?.includes('UNIQUE')) {
        console.warn(`Failed to insert fight perf for ${playerName}:`, err.message);
      }
    }
  }

  return inserted;
}

/**
 * Get detailed performance analysis for a character.
 * Returns summary, boss breakdown, weekly trends, recent fights, and recommendations.
 */
export async function getCharacterPerformance(characterId, options = {}) {
  const { weeks = 8, bossId, difficulty, visibilityFilter, characterInfo } = options;

  // Check cache first
  const cacheKey = buildCacheKey(characterId, { weeks, bossId, difficulty });
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached.data;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (weeks * 7));

  // Build dynamic WHERE conditions for raw SQL
  // When visibilityFilter is set, JOIN reports to filter by visibility
  const needsReportsJoin = !!visibilityFilter;
  const reportsJoin = needsReportsJoin ? 'JOIN reports r ON r.id = f.report_id' : '';

  let where = 'WHERE fp.character_id = ? AND f.start_time >= ?';
  const params = [characterId, cutoff.getTime()];
  if (bossId) { where += ' AND f.encounter_id = ?'; params.push(bossId); }
  if (difficulty) { where += ' AND f.difficulty = ?'; params.push(difficulty); }
  if (visibilityFilter) { where += ' AND r.visibility = ?'; params.push(visibilityFilter); }

  // Use raw SQL via the libsql client for complex aggregate queries
  const { client } = await import('../db/client.js');

  // Summary stats
  const summaryResult = await client.execute({
    sql: `SELECT
      COUNT(*) as totalFights,
      ROUND(AVG(fp.dps), 1) as avgDps,
      ROUND(AVG(fp.hps), 1) as avgHps,
      ROUND(AVG(fp.dtps), 1) as avgDtps,
      SUM(fp.deaths) as totalDeaths,
      ROUND(CAST(SUM(fp.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as deathRate,
      ROUND(AVG(fp.flask_uptime_pct), 1) as avgFlaskUptime,
      ROUND(AVG(CASE WHEN fp.food_buff_active THEN 1 ELSE 0 END) * 100, 1) as foodRate,
      ROUND(AVG(CASE WHEN fp.augment_rune_active THEN 1 ELSE 0 END) * 100, 1) as augmentRate,
      ROUND(AVG(fp.interrupts), 1) as avgInterrupts,
      ROUND(AVG(fp.dispels), 1) as avgDispels,
      ROUND(AVG(CASE WHEN fp.raid_median_dps > 0 THEN (fp.dps / fp.raid_median_dps) * 100 ELSE 100 END), 1) as dpsVsMedianPct,
      ROUND(CAST(SUM(CASE WHEN fp.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) * 100, 1) as healthPotionRate,
      ROUND(CAST(SUM(CASE WHEN fp.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) * 100, 1) as healthstoneRate,
      ROUND(CAST(SUM(CASE WHEN fp.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) * 100, 1) as combatPotionRate,
      ROUND(AVG(fp.active_time_pct), 1) as avgActiveTime,
      ROUND(AVG(fp.cpm), 1) as avgCpm
    FROM fight_performance fp
    JOIN fights f ON f.id = fp.fight_id
    ${reportsJoin}
    ${where}`,
    args: params,
  });

  const summary = summaryResult.rows[0] || {};
  const totalFights = Number(summary.totalFights) || 0;

  // Calculate consumable score
  const healthPotionRate = Number(summary.healthPotionRate) || 0;
  const healthstoneRate = Number(summary.healthstoneRate) || 0;
  const combatPotionRate = Number(summary.combatPotionRate) || 0;
  const avgFlaskUptime = Number(summary.avgFlaskUptime) || 0;
  const foodRate = Number(summary.foodRate) || 0;
  const augmentRate = Number(summary.augmentRate) || 0;

  const consumableScore = Math.round(
    healthPotionRate * CONSUMABLE_WEIGHTS.healthPotion +
    healthstoneRate * CONSUMABLE_WEIGHTS.healthstone +
    combatPotionRate * CONSUMABLE_WEIGHTS.combatPotion +
    avgFlaskUptime * CONSUMABLE_WEIGHTS.flask +
    foodRate * CONSUMABLE_WEIGHTS.food +
    augmentRate * CONSUMABLE_WEIGHTS.augmentRune
  );

  // Boss breakdown
  const bossResult = await client.execute({
    sql: `SELECT
      f.encounter_id as bossId,
      f.boss_name as bossName,
      f.difficulty,
      COUNT(*) as fights,
      SUM(fp.deaths) as deaths,
      ROUND(CAST(SUM(fp.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as deathRate,
      ROUND(AVG(fp.dps), 1) as avgDps,
      ROUND(MAX(fp.dps), 1) as bestDps,
      ROUND(AVG(fp.dtps), 1) as avgDtps,
      ROUND(CAST(SUM(CASE WHEN fp.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as healthPotionRate,
      ROUND(CAST(SUM(CASE WHEN fp.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as healthstoneRate,
      ROUND(CAST(SUM(CASE WHEN fp.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as combatPotionRate,
      ROUND(AVG(fp.interrupts), 1) as interruptsPerFight,
      ROUND(AVG(fp.dispels), 1) as dispelsPerFight,
      ROUND(AVG(CASE WHEN fp.raid_median_dps > 0 THEN (fp.dps / fp.raid_median_dps) * 100 ELSE 100 END), 1) as dpsVsMedian,
      ROUND(AVG(fp.active_time_pct), 1) as avgActiveTime,
      ROUND(AVG(fp.cpm), 1) as avgCpm
    FROM fight_performance fp
    JOIN fights f ON f.id = fp.fight_id
    ${reportsJoin}
    ${where}
    GROUP BY f.encounter_id, f.difficulty
    ORDER BY f.difficulty DESC, COUNT(*) DESC`,
    args: params,
  });

  const bossBreakdown = bossResult.rows.map(r => ({
    bossId: Number(r.bossId),
    bossName: r.bossName,
    difficulty: r.difficulty,
    fights: Number(r.fights),
    deaths: Number(r.deaths),
    deathRate: Number(r.deathRate),
    avgDps: Number(r.avgDps),
    bestDps: Number(r.bestDps),
    avgDtps: Number(r.avgDtps),
    healthPotionRate: Number(r.healthPotionRate),
    healthstoneRate: Number(r.healthstoneRate),
    combatPotionRate: Number(r.combatPotionRate),
    interruptsPerFight: Number(r.interruptsPerFight),
    dispelsPerFight: Number(r.dispelsPerFight),
    dpsVsMedian: Number(r.dpsVsMedian),
    avgActiveTime: Number(r.avgActiveTime),
    avgCpm: Number(r.avgCpm),
  }));

  // Weekly trends (Thursday-Wednesday weeks)
  const trendsResult = await client.execute({
    sql: `SELECT
      date(datetime(f.start_time / 1000, 'unixepoch'), '-' || ((CAST(strftime('%w', datetime(f.start_time / 1000, 'unixepoch')) AS INTEGER) + 3) % 7) || ' days') as weekStart,
      COUNT(*) as fights,
      ROUND(AVG(fp.dps), 1) as avgDps,
      ROUND(AVG(fp.hps), 1) as avgHps,
      ROUND(CAST(SUM(fp.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as avgDeaths,
      ROUND(AVG(fp.dtps), 1) as avgDtps,
      ROUND(
        CAST(SUM(CASE WHEN fp.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 20 +
        CAST(SUM(CASE WHEN fp.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 15 +
        CAST(SUM(CASE WHEN fp.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 25 +
        AVG(fp.flask_uptime_pct) * 0.25 +
        AVG(CASE WHEN fp.food_buff_active THEN 1 ELSE 0 END) * 10 +
        AVG(CASE WHEN fp.augment_rune_active THEN 1 ELSE 0 END) * 5,
      1) as consumableScore,
      ROUND(AVG(fp.active_time_pct), 1) as avgActiveTime,
      ROUND(AVG(fp.cpm), 1) as avgCpm
    FROM fight_performance fp
    JOIN fights f ON f.id = fp.fight_id
    ${reportsJoin}
    ${where}
    GROUP BY weekStart
    ORDER BY weekStart ASC`,
    args: params,
  });

  const weeklyTrends = trendsResult.rows.map(r => ({
    weekStart: r.weekStart,
    fights: Number(r.fights),
    avgDps: Number(r.avgDps),
    avgHps: Number(r.avgHps),
    avgDeaths: Number(r.avgDeaths),
    avgDtps: Number(r.avgDtps),
    consumableScore: Number(r.consumableScore),
    avgActiveTime: Number(r.avgActiveTime),
    avgCpm: Number(r.avgCpm),
  }));

  // Add week-over-week changes
  for (let i = 1; i < weeklyTrends.length; i++) {
    const prev = weeklyTrends[i - 1];
    const curr = weeklyTrends[i];
    curr.dpsChange = prev.avgDps > 0 ? Math.round((curr.avgDps - prev.avgDps) / prev.avgDps * 100) : 0;
    curr.deathChange = prev.avgDeaths > 0 ? Math.round((curr.avgDeaths - prev.avgDeaths) / prev.avgDeaths * 100) : 0;
  }

  // Recent fights
  const recentResult = await client.execute({
    sql: `SELECT
      datetime(f.start_time / 1000, 'unixepoch') as date,
      f.boss_name as boss,
      f.difficulty,
      ROUND(fp.dps, 1) as dps,
      fp.deaths,
      fp.damage_taken as damageTaken,
      fp.health_potions as potions,
      fp.healthstones,
      fp.combat_potions as combatPotions,
      fp.interrupts,
      fp.dispels,
      ROUND(CASE WHEN fp.raid_median_dps > 0 THEN (fp.dps / fp.raid_median_dps) * 100 ELSE 100 END, 1) as dpsVsMedian,
      ROUND(fp.active_time_pct, 1) as activeTimePct,
      ROUND(fp.cpm, 1) as cpm
    FROM fight_performance fp
    JOIN fights f ON f.id = fp.fight_id
    ${reportsJoin}
    ${where}
    ORDER BY f.start_time DESC, fp.id DESC
    LIMIT 20`,
    args: params,
  });

  const recentFights = recentResult.rows.map(r => ({
    date: r.date,
    boss: r.boss,
    difficulty: r.difficulty,
    dps: Number(r.dps),
    deaths: Number(r.deaths),
    damageTaken: Number(r.damageTaken),
    potions: Number(r.potions),
    healthstones: Number(r.healthstones),
    combatPotions: Number(r.combatPotions),
    interrupts: Number(r.interrupts),
    dispels: Number(r.dispels),
    dpsVsMedian: Number(r.dpsVsMedian),
    activeTimePct: Number(r.activeTimePct),
    cpm: Number(r.cpm),
  }));

  // Generate recommendations
  const summaryData = {
    totalFights,
    avgDps: Number(summary.avgDps) || 0,
    avgHps: Number(summary.avgHps) || 0,
    avgDtps: Number(summary.avgDtps) || 0,
    deathRate: Number(summary.deathRate) || 0,
    consumableScore,
    dpsVsMedianPct: Number(summary.dpsVsMedianPct) || 100,
    healthPotionRate,
    healthstoneRate,
    combatPotionRate,
    avgFlaskUptime,
    foodRate,
    augmentRate,
    avgInterrupts: Number(summary.avgInterrupts) || 0,
    avgDispels: Number(summary.avgDispels) || 0,
    avgActiveTime: Number(summary.avgActiveTime) || 0,
    avgCpm: Number(summary.avgCpm) || 0,
    avgParsePercentile: null,
  };

  // Fetch WCL parse percentiles if character info is available
  if (characterInfo && bossBreakdown.length > 0) {
    try {
      const { getCharacterEncounterRankings } = await import('../services/wcl.js');
      const encounterIds = [...new Set(bossBreakdown.map(b => b.bossId))];
      const topDifficulty = bossBreakdown[0]?.difficulty;

      const rankingsMap = await getCharacterEncounterRankings(
        characterInfo.name, characterInfo.realmSlug, characterInfo.region,
        encounterIds, topDifficulty,
      );

      for (const boss of bossBreakdown) {
        const ranking = rankingsMap.get(boss.bossId);
        if (ranking) {
          boss.parsePercentile = ranking.bestPercent;
          boss.parseKills = ranking.kills;
        }
      }

      const parsesWithData = bossBreakdown.filter(b => b.parsePercentile != null);
      if (parsesWithData.length > 0) {
        summaryData.avgParsePercentile = Math.round(
          parsesWithData.reduce((sum, b) => sum + b.parsePercentile, 0) / parsesWithData.length
        );
      }
    } catch (err) {
      console.warn('Failed to fetch parse percentiles:', err.message);
    }
  }

  const score = calculateStillNoobScore(summaryData, bossBreakdown);
  const playerLevel = detectPlayerLevel(summaryData, bossBreakdown, options.raiderIO);
  const recommendations = generateRecommendations({ summary: summaryData, bossBreakdown, weeklyTrends, playerLevel });

  const result = {
    summary: summaryData,
    score,
    playerLevel,
    bossBreakdown,
    weeklyTrends,
    recentFights,
    recommendations,
  };

  // Store in cache with auto-eviction timer
  const timer = setTimeout(() => analysisCache.delete(cacheKey), CACHE_TTL);
  analysisCache.set(cacheKey, { data: result, timer });

  return result;
}

/**
 * Calculate StillNoob Score — proprietary 0-100 metric.
 * Weighted composite of performance, survival, preparation, utility, consistency.
 */
export function calculateStillNoobScore(summary, bossBreakdown) {
  if (!summary || summary.totalFights === 0) {
    return { total: 0, tier: SCORE_TIERS[0], breakdown: { performance: 0, survival: 0, preparation: 0, utility: 0, consistency: 0 } };
  }

  // Performance (35%): DPS vs raid median — 100% median = 50 points, 130%+ = 100
  const dpsRatio = summary.dpsVsMedianPct || 100;
  const performanceRaw = Math.min(100, Math.max(0, (dpsRatio - 70) * (100 / 60))); // 70%→0, 130%→100

  // Survival (25%): death rate inverted — 0 deaths = 100, 0.5+ = 0
  const survivalRaw = Math.min(100, Math.max(0, (1 - summary.deathRate / 0.5) * 100));

  // Preparation (20%): consumable score (already 0-100)
  const preparationRaw = Math.min(100, summary.consumableScore || 0);

  // Utility (10%): interrupts + dispels normalized
  const avgUtil = (summary.avgInterrupts || 0) + (summary.avgDispels || 0);
  const utilityRaw = Math.min(100, avgUtil * 25); // 4+ combined = 100

  // Consistency (10%): inverse of DPS variance across bosses
  let consistencyRaw = 100;
  if (bossBreakdown.length >= 3) {
    const dpsValues = bossBreakdown.filter(b => b.avgDps > 0).map(b => b.avgDps);
    if (dpsValues.length >= 3) {
      const max = Math.max(...dpsValues);
      const min = Math.min(...dpsValues);
      const variance = max > 0 ? ((max - min) / max) * 100 : 0;
      consistencyRaw = Math.max(0, 100 - variance);
    }
  }

  const breakdown = {
    performance: Math.round(performanceRaw),
    survival: Math.round(survivalRaw),
    preparation: Math.round(preparationRaw),
    utility: Math.round(utilityRaw),
    consistency: Math.round(consistencyRaw),
  };

  const total = Math.round(
    breakdown.performance * SCORE_WEIGHTS.performance +
    breakdown.survival * SCORE_WEIGHTS.survival +
    breakdown.preparation * SCORE_WEIGHTS.preparation +
    breakdown.utility * SCORE_WEIGHTS.utility +
    breakdown.consistency * SCORE_WEIGHTS.consistency
  );

  const tier = SCORE_TIERS.find(t => total >= t.min && total <= t.max) || SCORE_TIERS[0];

  return { total, tier, breakdown };
}

/**
 * Detect player skill level from performance data and external sources.
 * Uses a weighted scoring system to classify as beginner/intermediate/advanced.
 */
export function detectPlayerLevel(summary, bossBreakdown, raiderIO) {
  if (!summary || summary.totalFights === 0) return 'beginner';

  const L = LEVEL_DETECTION;
  let score = 0;

  // DPS vs Median (0-30 points)
  const dps = summary.dpsVsMedianPct || 100;
  if (dps >= L.dpsVsMedian.thresholds[2]) score += L.dpsVsMedian.weight;
  else if (dps >= L.dpsVsMedian.thresholds[1]) score += L.dpsVsMedian.weight * 0.66;
  else if (dps >= L.dpsVsMedian.thresholds[0]) score += L.dpsVsMedian.weight * 0.33;

  // Death Rate (0-20 points) — lower is better
  const dr = summary.deathRate || 0;
  if (dr <= L.deathRate.thresholds[2]) score += L.deathRate.weight;
  else if (dr <= L.deathRate.thresholds[1]) score += L.deathRate.weight * 0.75;
  else if (dr <= L.deathRate.thresholds[0]) score += L.deathRate.weight * 0.4;

  // Consumables (0-15 points)
  const cs = summary.consumableScore || 0;
  if (cs >= L.consumables.thresholds[1]) score += L.consumables.weight;
  else if (cs >= L.consumables.thresholds[0]) score += L.consumables.weight * 0.53;

  // Raider.io M+ Score (0-15 points)
  const mpScore = raiderIO?.mythicPlus?.score || 0;
  if (mpScore >= L.mythicPlus.thresholds[2]) score += L.mythicPlus.weight;
  else if (mpScore >= L.mythicPlus.thresholds[1]) score += L.mythicPlus.weight * 0.66;
  else if (mpScore >= L.mythicPlus.thresholds[0]) score += L.mythicPlus.weight * 0.33;

  // Difficulty raided (0-10 points) — from Raider.io progression
  const progression = raiderIO?.raidProgression?.[0];
  if (progression?.mythic > 0) score += L.difficulty.weight;
  else if (progression?.heroic >= 6) score += L.difficulty.weight * 0.6;
  else if (progression?.heroic > 0) score += L.difficulty.weight * 0.3;

  // Consistency (0-10 points) — low variance across bosses
  if (bossBreakdown.length >= 3) {
    const dpsValues = bossBreakdown.filter(b => b.avgDps > 0).map(b => b.avgDps);
    if (dpsValues.length >= 3) {
      const max = Math.max(...dpsValues);
      const min = Math.min(...dpsValues);
      const variance = max > 0 ? ((max - min) / max) * 100 : 0;
      if (variance <= L.consistency.threshold) score += L.consistency.weight;
      else if (variance <= L.consistency.threshold * 1.5) score += L.consistency.weight * 0.5;
    }
  }

  // Active Time (0-10 points)
  const at = summary.avgActiveTime || 0;
  if (at >= L.activeTime.thresholds[2]) score += L.activeTime.weight;
  else if (at >= L.activeTime.thresholds[1]) score += L.activeTime.weight * 0.66;
  else if (at >= L.activeTime.thresholds[0]) score += L.activeTime.weight * 0.33;

  // Parse Percentile (0-10 points)
  const pp = summary.avgParsePercentile || 0;
  if (pp >= L.parsePercentile.thresholds[2]) score += L.parsePercentile.weight;
  else if (pp >= L.parsePercentile.thresholds[1]) score += L.parsePercentile.weight * 0.66;
  else if (pp >= L.parsePercentile.thresholds[0]) score += L.parsePercentile.weight * 0.33;

  if (score >= L.advancedThreshold) return 'advanced';
  if (score >= L.intermediateThreshold) return 'intermediate';
  return 'beginner';
}

/**
 * Recommendation engine — generates actionable, level-adaptive tips.
 *
 * Returns { primaryTips, secondaryTips } where primaryTips are the top N
 * shown by default and secondaryTips are hidden behind "Show more".
 * Each tip has: { category, key, severity, priority, data }
 * Priority: 1 = most important (shown first). Lower number = higher priority.
 */
export function generateRecommendations({ summary, bossBreakdown, weeklyTrends, playerLevel = 'beginner' }) {
  const tips = [];
  if (!summary || summary.totalFights === 0) {
    return { primaryTips: [], secondaryTips: [], playerLevel };
  }

  // ── Insufficient data warning (all levels) ──
  if (summary.totalFights < 3) {
    tips.push({
      category: 'performance', key: 'insufficient_data', severity: 'info', priority: 1,
      data: { fights: summary.totalFights },
    });
  }

  // ── Survivability ──
  if (summary.deathRate > 0.4) {
    tips.push({
      category: 'survivability', key: 'high_death_rate', severity: 'critical',
      priority: playerLevel === 'beginner' ? 1 : 3,
      data: { rate: summary.deathRate.toFixed(2) },
    });
  } else if (summary.deathRate > 0.2) {
    tips.push({
      category: 'survivability', key: 'moderate_death_rate', severity: 'warning',
      priority: playerLevel === 'beginner' ? 2 : 5,
      data: { rate: summary.deathRate.toFixed(2) },
    });
  } else {
    tips.push({
      category: 'survivability', key: 'good_survival', severity: 'positive',
      priority: 10,
      data: { rate: summary.deathRate.toFixed(2) },
    });
  }

  // Boss-specific high damage (all levels)
  for (const boss of bossBreakdown) {
    if (boss.avgDtps > 0 && boss.fights >= 3) {
      const dtpsRatio = boss.avgDtps / (summary.avgDtps || 1);
      if (dtpsRatio > 1.4) {
        tips.push({
          category: 'survivability', key: 'high_damage_boss', severity: 'warning',
          priority: playerLevel === 'advanced' ? 2 : 4,
          data: { boss: boss.bossName, difficulty: boss.difficulty, dtps: Math.round(boss.avgDtps), avgDtps: Math.round(summary.avgDtps) },
        });
      }
    }
  }

  // Trend-based survival
  if (weeklyTrends.length >= 4) {
    const recent = weeklyTrends.slice(-2);
    const older = weeklyTrends.slice(-4, -2);
    const recentDeaths = recent.reduce((s, w) => s + w.avgDeaths, 0) / recent.length;
    const olderDeaths = older.reduce((s, w) => s + w.avgDeaths, 0) / older.length;
    if (olderDeaths > 0) {
      const change = Math.round(((recentDeaths - olderDeaths) / olderDeaths) * 100);
      if (change <= -20) {
        tips.push({ category: 'survivability', key: 'improving_survival', severity: 'positive', priority: 6, data: { change: Math.abs(change) } });
      } else if (change >= 20) {
        tips.push({ category: 'survivability', key: 'worsening_survival', severity: 'warning', priority: 3, data: { change } });
      }
    }
  }

  // ── Consumables ──
  if (summary.avgFlaskUptime < 90) {
    tips.push({
      category: 'consumables', key: 'low_flask', severity: 'warning',
      priority: playerLevel === 'beginner' ? 2 : 5,
      data: { uptime: Math.round(summary.avgFlaskUptime) },
    });
  }
  if (summary.combatPotionRate < 70) {
    tips.push({
      category: 'consumables', key: 'low_combat_potion', severity: 'warning',
      priority: playerLevel === 'beginner' ? 3 : 4,
      data: { rate: Math.round(summary.combatPotionRate) },
    });
  }
  if (summary.healthPotionRate < 50) {
    tips.push({
      category: 'consumables', key: 'low_health_potion', severity: 'warning',
      priority: 6,
      data: { rate: Math.round(summary.healthPotionRate) },
    });
  }
  if (summary.healthstoneRate < 30) {
    tips.push({
      category: 'consumables', key: 'no_healthstone', severity: 'info',
      priority: 8,
      data: { rate: Math.round(summary.healthstoneRate) },
    });
  }
  if (summary.foodRate < 80) {
    tips.push({
      category: 'consumables', key: 'no_food', severity: 'info',
      priority: playerLevel === 'beginner' ? 3 : 7,
      data: { rate: Math.round(summary.foodRate) },
    });
  }
  if (summary.healthPotionRate >= 60 && summary.combatPotionRate >= 70 && summary.avgFlaskUptime >= 90 && summary.foodRate >= 80) {
    tips.push({ category: 'consumables', key: 'good_consumables', severity: 'positive', priority: 10, data: {} });
  }

  // ── Performance ──

  // DPS vs raid median
  if (summary.dpsVsMedianPct < 80) {
    tips.push({
      category: 'performance', key: 'below_raid_median', severity: 'critical',
      priority: playerLevel === 'beginner' ? 1 : 2,
      data: { pct: Math.round(summary.dpsVsMedianPct) },
    });
  } else if (summary.dpsVsMedianPct > 110) {
    tips.push({
      category: 'performance', key: 'above_raid_median', severity: 'positive',
      priority: 8,
      data: { pct: Math.round(summary.dpsVsMedianPct - 100) },
    });
  }

  // DPS trends
  let dpsChange = null;
  if (weeklyTrends.length >= 4) {
    const recent = weeklyTrends.slice(-2);
    const older = weeklyTrends.slice(-4, -2);
    const recentDps = recent.reduce((s, w) => s + w.avgDps, 0) / recent.length;
    const olderDps = older.reduce((s, w) => s + w.avgDps, 0) / older.length;
    if (olderDps > 0) {
      dpsChange = Math.round(((recentDps - olderDps) / olderDps) * 100);
      if (dpsChange >= 10) {
        tips.push({ category: 'performance', key: 'dps_improving', severity: 'positive', priority: 5, data: { change: dpsChange } });
      } else if (dpsChange <= -10) {
        tips.push({ category: 'performance', key: 'dps_declining', severity: 'warning', priority: 2, data: { change: Math.abs(dpsChange) } });
      }
    }
  }

  // Stagnation detection — DPS flat for 4+ weeks (intermediate/advanced)
  if (playerLevel !== 'beginner' && weeklyTrends.length >= 4 && dpsChange !== null) {
    if (Math.abs(dpsChange) < 5) {
      tips.push({
        category: 'performance', key: 'dps_stagnating', severity: 'info',
        priority: playerLevel === 'advanced' ? 2 : 3,
        data: { weeks: weeklyTrends.length, change: dpsChange },
      });
    }
  }

  // DPS consistency
  if (bossBreakdown.length >= 3) {
    const dpsValues = bossBreakdown.filter(b => b.avgDps > 0).map(b => b.avgDps);
    if (dpsValues.length >= 3) {
      const min = Math.min(...dpsValues);
      const max = Math.max(...dpsValues);
      const variance = max > 0 ? ((max - min) / max) * 100 : 0;
      if (variance > 40) {
        tips.push({
          category: 'performance', key: 'inconsistent_dps', severity: 'info',
          priority: playerLevel === 'beginner' ? 7 : 4,
          data: { variance: Math.round(variance) },
        });
      } else if (variance <= 25 && playerLevel !== 'beginner') {
        tips.push({
          category: 'performance', key: 'good_consistency', severity: 'positive',
          priority: 9,
          data: { variance: Math.round(variance) },
        });
      }
    }
  }

  // ── Weakest boss (intermediate/advanced) ──
  if (playerLevel !== 'beginner' && bossBreakdown.length >= 2) {
    const bossesWithDps = bossBreakdown.filter(b => b.avgDps > 0 && b.fights >= 2);
    if (bossesWithDps.length >= 2) {
      const weakest = bossesWithDps.reduce((w, b) => b.dpsVsMedian < w.dpsVsMedian ? b : w);
      const strongest = bossesWithDps.reduce((s, b) => b.dpsVsMedian > s.dpsVsMedian ? b : s);
      const gap = strongest.dpsVsMedian - weakest.dpsVsMedian;

      if (gap > 15) {
        tips.push({
          category: 'performance', key: 'weakest_boss', severity: 'info',
          priority: playerLevel === 'advanced' ? 1 : 3,
          data: {
            weakBoss: weakest.bossName,
            weakDifficulty: weakest.difficulty,
            weakDpsVsMedian: Math.round(weakest.dpsVsMedian),
            strongBoss: strongest.bossName,
            strongDpsVsMedian: Math.round(strongest.dpsVsMedian),
            gap: Math.round(gap),
          },
        });
      }
    }
  }

  // ── Boss with highest death rate (intermediate/advanced) ──
  if (playerLevel !== 'beginner' && bossBreakdown.length >= 2) {
    const bossesWithDeaths = bossBreakdown.filter(b => b.fights >= 3 && b.deathRate > 0.15);
    if (bossesWithDeaths.length > 0) {
      const deadliest = bossesWithDeaths.reduce((d, b) => b.deathRate > d.deathRate ? b : d);
      tips.push({
        category: 'survivability', key: 'deadliest_boss', severity: 'warning',
        priority: 3,
        data: { boss: deadliest.bossName, difficulty: deadliest.difficulty, deathRate: deadliest.deathRate.toFixed(2), fights: deadliest.fights },
      });
    }
  }

  // ── Utility ──
  if (summary.avgInterrupts < 1 && summary.totalFights >= 5) {
    tips.push({
      category: 'utility', key: 'low_interrupts', severity: 'info',
      priority: playerLevel === 'beginner' ? 8 : 6,
      data: { avg: summary.avgInterrupts.toFixed(1) },
    });
  } else if (summary.avgInterrupts >= 3) {
    tips.push({
      category: 'utility', key: 'good_interrupts', severity: 'positive',
      priority: 10,
      data: { avg: summary.avgInterrupts.toFixed(1) },
    });
  }

  if (summary.avgDispels >= 2) {
    tips.push({
      category: 'utility', key: 'good_dispels', severity: 'positive',
      priority: 10,
      data: { avg: summary.avgDispels.toFixed(1) },
    });
  }

  // ── Active Time ──
  if (summary.avgActiveTime > 0 && summary.avgActiveTime < 85) {
    tips.push({
      category: 'performance', key: 'low_active_time',
      severity: summary.avgActiveTime < 70 ? 'critical' : 'warning',
      priority: playerLevel === 'beginner' ? 2 : 3,
      data: { pct: Math.round(summary.avgActiveTime) },
    });
  } else if (summary.avgActiveTime >= 92) {
    tips.push({
      category: 'performance', key: 'good_active_time',
      severity: 'positive', priority: 9,
      data: { pct: Math.round(summary.avgActiveTime) },
    });
  }

  // ── CPM / Rotation Quality ──
  if (summary.avgCpm > 0 && summary.avgCpm < 30) {
    tips.push({
      category: 'performance', key: 'low_cpm',
      severity: summary.avgCpm < 20 ? 'critical' : 'warning',
      priority: playerLevel === 'beginner' ? 3 : 4,
      data: { cpm: summary.avgCpm.toFixed(1) },
    });
  } else if (summary.avgCpm >= 40) {
    tips.push({
      category: 'performance', key: 'good_cpm',
      severity: 'positive', priority: 9,
      data: { cpm: summary.avgCpm.toFixed(1) },
    });
  }

  // ── Parse Percentile ──
  if (summary.avgParsePercentile != null) {
    if (summary.avgParsePercentile < 25) {
      tips.push({
        category: 'performance', key: 'low_parse', severity: 'critical',
        priority: 2,
        data: { pct: summary.avgParsePercentile },
      });
    } else if (summary.avgParsePercentile < 50) {
      tips.push({
        category: 'performance', key: 'below_avg_parse', severity: 'warning',
        priority: 4,
        data: { pct: summary.avgParsePercentile },
      });
    } else if (summary.avgParsePercentile >= 75) {
      tips.push({
        category: 'performance', key: 'high_parse', severity: 'positive',
        priority: 8,
        data: { pct: summary.avgParsePercentile },
      });
    }
  }

  // ── Sort by priority and split into primary/secondary ──
  tips.sort((a, b) => a.priority - b.priority);
  const limit = TIP_LIMITS[playerLevel] || 3;
  const primaryTips = tips.slice(0, limit);
  const secondaryTips = tips.slice(limit);

  return { primaryTips, secondaryTips, playerLevel };
}
