import { db } from '../db/client.js';
import { fightPerformance } from '../db/schema.js';
import {
  BUFF_PATTERNS,
  CONSUMABLE_WEIGHTS,
  SCORE_WEIGHTS,
  SCORE_TIERS,
  LEVEL_DETECTION,
  TIP_LIMITS,
  getSpecData,
  getSpecCoaching,
} from '@stillnoob/shared';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Analysis');

// ── In-memory analysis cache (TTL: 5 minutes, max 200 entries) ──
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 200;

function buildCacheKey(characterId, { weeks, bossId, difficulty, visibilityFilter } = {}) {
  return `${characterId}:${weeks || ''}:${bossId || ''}:${difficulty || ''}:${visibilityFilter || ''}`;
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
 * Data sources:
 *   - basicStats: { damage, healing, damageTaken, deaths } (per-player arrays)
 *   - extendedStats.casts: Casts table → entry.total for CPM (top-level total includes all casts)
 *   - extendedStats.summary: Summary playerDetails → potionUse, healthstoneUse per player
 *   - extendedStats.combatantInfo: CombatantInfo events → pre-fight auras (flask/food/augment)
 *   - extendedStats.interrupts: Interrupts table → nested details with per-player totals
 *   - extendedStats.dispels: Dispels table → same nested structure
 *
 * @param {number} storedFightId - DB fight ID (fights table)
 * @param {number} fightDurationMs - Fight duration in milliseconds
 * @param {object} basicStats - { damage, healing, damageTaken, deaths }
 * @param {object} extendedStats - { casts, summary, combatantInfo, interrupts, dispels }
 * @param {object} charMap - { "lowercaseName": characterId }
 * @returns {number} Number of records inserted
 */
export async function processExtendedFightData(
  storedFightId,
  fightDurationMs,
  basicStats,
  extendedStats,
  charMap,
) {
  const fightDurationSec = fightDurationMs / 1000;
  const playerData = {};

  const ensurePlayer = (name) => {
    if (!playerData[name]) {
      playerData[name] = {
        damageDone: 0,
        healingDone: 0,
        damageTaken: 0,
        deaths: 0,
        activeTime: 0,
        totalCasts: 0,
        healthstones: 0,
        combatPotions: 0,
        flaskUptime: 0,
        foodBuff: false,
        augmentRune: false,
        interrupts: 0,
        dispels: 0,
        specId: null,
        talents: null,
      };
    }
  };

  // Basic stats
  for (const e of basicStats.damage || []) {
    ensurePlayer(e.name);
    playerData[e.name].damageDone = e.total || 0;
    playerData[e.name].activeTime = e.activeTime || 0;
  }
  for (const e of basicStats.healing || []) {
    ensurePlayer(e.name);
    playerData[e.name].healingDone = e.total || 0;
  }
  for (const e of basicStats.damageTaken || []) {
    ensurePlayer(e.name);
    playerData[e.name].damageTaken = e.total || 0;
  }
  for (const e of basicStats.deaths || []) {
    ensurePlayer(e.name);
    playerData[e.name].deaths = e.total || 0;
  }

  // Casts — use entry.total for CPM (the WCL Casts table truncates abilities to top 5,
  // but entry.total includes ALL casts for that player)
  const sourceIdToName = {};
  for (const entry of extendedStats.casts || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    playerData[entry.name].totalCasts = entry.total || 0;
    // Build sourceID → name mapping for CombatantInfo lookup
    if (entry.id != null) sourceIdToName[entry.id] = entry.name;
  }

  // Summary playerDetails — potion and healthstone usage per player
  if (extendedStats.summary) {
    for (const role of ['dps', 'tanks', 'healers']) {
      for (const p of extendedStats.summary[role] || []) {
        if (!p.name) continue;
        ensurePlayer(p.name);
        playerData[p.name].combatPotions = p.potionUse || 0;
        playerData[p.name].healthstones = p.healthstoneUse || 0;
        // Also build sourceID → name from summary (has id field too)
        if (p.id != null) sourceIdToName[p.id] = p.name;
      }
    }
  }

  // CombatantInfo events — pre-fight auras (flask, food, augment rune) + spec/talents
  for (const event of extendedStats.combatantInfo || []) {
    const playerName = sourceIdToName[event.sourceID];
    if (!playerName) continue;
    ensurePlayer(playerName);

    // Extract spec ID and talent tree
    if (event.specID != null) {
      playerData[playerName].specId = event.specID;
    }
    if (event.talentTree && Array.isArray(event.talentTree) && event.talentTree.length > 0) {
      playerData[playerName].talents = event.talentTree;
    }

    for (const aura of event.auras || []) {
      const name = aura.name || '';
      if (BUFF_PATTERNS.flask.test(name)) {
        playerData[playerName].flaskUptime = 100; // present at pull = 100% uptime
      }
      if (BUFF_PATTERNS.food.test(name)) {
        playerData[playerName].foodBuff = true;
      }
      if (BUFF_PATTERNS.augmentRune.test(name)) {
        playerData[playerName].augmentRune = true;
      }
    }
  }

  // Interrupts — nested structure: entries[0].entries[].details[].{name, total}
  for (const wrapper of extendedStats.interrupts || []) {
    for (const ability of wrapper.entries || []) {
      for (const player of ability.details || []) {
        if (!player.name) continue;
        ensurePlayer(player.name);
        playerData[player.name].interrupts += player.total || 0;
      }
    }
  }

  // Dispels — same nested structure as interrupts
  for (const wrapper of extendedStats.dispels || []) {
    for (const ability of wrapper.entries || []) {
      for (const player of ability.details || []) {
        if (!player.name) continue;
        ensurePlayer(player.name);
        playerData[player.name].dispels += player.total || 0;
      }
    }
  }

  // Calculate raid medians (exclude tanks/healers by filtering low DPS)
  const allRawDps = [];
  const allDtps = [];
  for (const data of Object.values(playerData)) {
    if (data.damageDone > 0 && fightDurationSec > 0)
      allRawDps.push(data.damageDone / fightDurationSec);
    if (data.damageTaken > 0 && fightDurationSec > 0)
      allDtps.push(data.damageTaken / fightDurationSec);
  }
  // Filter: only include players with DPS >= 40% of max (auto-excludes tanks ~30% and healers ~10-20%)
  const maxDps = allRawDps.length > 0 ? Math.max(...allRawDps) : 0;
  const allDps = allRawDps.filter((d) => d >= maxDps * 0.4);
  allDps.sort((a, b) => a - b);
  allDtps.sort((a, b) => a - b);
  const medianDps = allDps.length > 0 ? allDps[Math.floor(allDps.length / 2)] : 0;
  const medianDtps = allDtps.length > 0 ? allDtps[Math.floor(allDtps.length / 2)] : 0;

  // Insert per-player records (only for registered characters)
  let inserted = 0;
  for (const [playerName, data] of Object.entries(playerData)) {
    const characterId = charMap[playerName.normalize('NFC').toLowerCase()];
    if (!characterId) {
      log.debug(`Player "${playerName}" not found in charMap, skipping`);
      continue;
    }

    const dps = fightDurationSec > 0 ? data.damageDone / fightDurationSec : 0;
    const hps = fightDurationSec > 0 ? data.healingDone / fightDurationSec : 0;
    const dtps = fightDurationSec > 0 ? data.damageTaken / fightDurationSec : 0;
    const activeTimePct = fightDurationMs > 0 ? (data.activeTime / fightDurationMs) * 100 : 0;
    const cpm = fightDurationMs > 0 ? data.totalCasts / (fightDurationMs / 60000) : 0;

    try {
      await db
        .insert(fightPerformance)
        .values({
          fightId: storedFightId,
          characterId,
          damageDone: data.damageDone,
          healingDone: data.healingDone,
          damageTaken: data.damageTaken,
          deaths: data.deaths,
          dps,
          hps,
          dtps,
          activeTimePct,
          cpm,
          healthstones: data.healthstones,
          combatPotions: data.combatPotions,
          flaskUptimePct: data.flaskUptime,
          foodBuffActive: data.foodBuff,
          augmentRuneActive: data.augmentRune,
          interrupts: data.interrupts,
          dispels: data.dispels,
          raidMedianDps: medianDps,
          raidMedianDtps: medianDtps,
          specId: data.specId,
          talentData: data.talents ? JSON.stringify(data.talents) : null,
        })
        .onConflictDoNothing();
      inserted++;
    } catch (err) {
      if (!err.message?.includes('UNIQUE')) {
        log.warn(`Failed to insert fight perf for ${playerName}`, err.message);
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
  const {
    weeks = 8,
    bossId,
    difficulty,
    visibilityFilter,
    characterInfo,
    className,
    spec,
  } = options;

  // Check cache first
  const cacheKey = buildCacheKey(characterId, { weeks, bossId, difficulty, visibilityFilter });
  const cached = analysisCache.get(cacheKey);
  if (cached) return cached.data;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  // Build dynamic WHERE conditions for raw SQL
  // When visibilityFilter is set, JOIN reports to filter by visibility
  const needsReportsJoin = !!visibilityFilter;
  const reportsJoin = needsReportsJoin ? 'JOIN reports r ON r.id = f.report_id' : '';

  let where = "WHERE fp.character_id = ? AND f.start_time >= ? AND f.difficulty != 'Mythic+'";
  const params = [characterId, cutoff.getTime()];
  if (bossId) {
    where += ' AND f.encounter_id = ?';
    params.push(bossId);
  }
  if (difficulty) {
    where += ' AND f.difficulty = ?';
    params.push(difficulty);
  }
  if (visibilityFilter) {
    where += ' AND r.visibility = ?';
    params.push(visibilityFilter);
  }

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
  const healthstoneRate = Number(summary.healthstoneRate) || 0;
  const combatPotionRate = Number(summary.combatPotionRate) || 0;
  const avgFlaskUptime = Number(summary.avgFlaskUptime) || 0;
  const foodRate = Number(summary.foodRate) || 0;
  const augmentRate = Number(summary.augmentRate) || 0;

  const consumableScore = Math.round(
    healthstoneRate * CONSUMABLE_WEIGHTS.healthstone +
      combatPotionRate * CONSUMABLE_WEIGHTS.combatPotion +
      avgFlaskUptime * CONSUMABLE_WEIGHTS.flask +
      foodRate * CONSUMABLE_WEIGHTS.food +
      augmentRate * CONSUMABLE_WEIGHTS.augmentRune,
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

  const bossBreakdown = bossResult.rows.map((r) => ({
    bossId: Number(r.bossId),
    bossName: r.bossName,
    difficulty: r.difficulty,
    fights: Number(r.fights),
    deaths: Number(r.deaths),
    deathRate: Number(r.deathRate),
    avgDps: Number(r.avgDps),
    bestDps: Number(r.bestDps),
    avgDtps: Number(r.avgDtps),
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
        CAST(SUM(CASE WHEN fp.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 20 +
        CAST(SUM(CASE WHEN fp.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 30 +
        AVG(fp.flask_uptime_pct) * 0.30 +
        AVG(CASE WHEN fp.food_buff_active THEN 1 ELSE 0 END) * 13 +
        AVG(CASE WHEN fp.augment_rune_active THEN 1 ELSE 0 END) * 7,
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

  const weeklyTrends = trendsResult.rows.map((r) => ({
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
    curr.dpsChange =
      prev.avgDps > 0 ? Math.round(((curr.avgDps - prev.avgDps) / prev.avgDps) * 100) : 0;
    curr.deathChange =
      prev.avgDeaths > 0
        ? Math.round(((curr.avgDeaths - prev.avgDeaths) / prev.avgDeaths) * 100)
        : 0;
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

  const recentFights = recentResult.rows.map((r) => ({
    date: r.date,
    boss: r.boss,
    difficulty: r.difficulty,
    dps: Number(r.dps),
    deaths: Number(r.deaths),
    damageTaken: Number(r.damageTaken),
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
      const encounterIds = [...new Set(bossBreakdown.map((b) => b.bossId))];
      const topDifficulty = bossBreakdown[0]?.difficulty;

      const rankingsMap = await getCharacterEncounterRankings(
        characterInfo.name,
        characterInfo.realmSlug,
        characterInfo.region,
        encounterIds,
        topDifficulty,
      );

      for (const boss of bossBreakdown) {
        const ranking = rankingsMap.get(boss.bossId);
        if (ranking) {
          boss.parsePercentile = ranking.bestPercent;
          boss.parseKills = ranking.kills;
        }
      }

      const parsesWithData = bossBreakdown.filter((b) => b.parsePercentile != null);
      if (parsesWithData.length > 0) {
        summaryData.avgParsePercentile = Math.round(
          parsesWithData.reduce((sum, b) => sum + b.parsePercentile, 0) / parsesWithData.length,
        );
      }
    } catch (err) {
      log.warn('Failed to fetch parse percentiles', err.message);
    }
  }

  // Fetch latest talent data for this character (for talent comparison tips)
  let latestTalentData = null;
  if (totalFights > 0) {
    const talentResult = await client.execute({
      sql: `SELECT fp.talent_data FROM fight_performance fp
        JOIN fights f ON f.id = fp.fight_id
        WHERE fp.character_id = ? AND fp.talent_data IS NOT NULL
        ORDER BY f.start_time DESC LIMIT 1`,
      args: [characterId],
    });
    if (talentResult.rows[0]?.talent_data) {
      try {
        latestTalentData = JSON.parse(talentResult.rows[0].talent_data);
      } catch {
        /* ignore */
      }
    }
  }

  const score = calculateStillNoobScore(summaryData, bossBreakdown);
  const playerLevel = detectPlayerLevel(summaryData, bossBreakdown, options.raiderIO);
  const specData = className && spec ? getSpecData(className, spec) : null;
  const role = specData?.role || 'DPS';
  const recommendations = generateRecommendations({
    summary: summaryData,
    bossBreakdown,
    weeklyTrends,
    playerLevel,
    raiderIO: options.raiderIO,
    specCpmBaseline: options.specCpmBaseline,
    className,
    spec,
    role,
    talentData: latestTalentData,
    specMeta: options.specMeta,
  });

  const result = {
    summary: summaryData,
    score,
    playerLevel,
    bossBreakdown,
    weeklyTrends,
    recentFights,
    recommendations,
  };

  // Evict oldest entries if cache is full
  if (analysisCache.size >= MAX_CACHE_SIZE) {
    const oldest = analysisCache.keys().next().value;
    const entry = analysisCache.get(oldest);
    if (entry) clearTimeout(entry.timer);
    analysisCache.delete(oldest);
  }

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
    return {
      total: 0,
      tier: SCORE_TIERS[0],
      breakdown: { performance: 0, survival: 0, preparation: 0, utility: 0, consistency: 0 },
    };
  }

  // Performance (35%): DPS vs raid median — 100% median = 50 points, 130%+ = 100
  const dpsRatio = summary.dpsVsMedianPct || 100;
  const performanceRaw = Math.min(100, Math.max(0, (dpsRatio - 70) * (100 / 60))); // 70%→0, 130%→100

  // Survival (25%): death rate inverted — 0 deaths = 100, threshold+ = 0
  // More lenient for Mythic progression where deaths are expected
  const hasMythicKills = bossBreakdown.some((b) => b.difficulty === 'Mythic' && b.fights > 0);
  const deathCeiling = hasMythicKills ? 0.7 : 0.5;
  const survivalRaw = Math.min(100, Math.max(0, (1 - summary.deathRate / deathCeiling) * 100));

  // Preparation (20%): consumable score (already 0-100)
  const preparationRaw = Math.min(100, summary.consumableScore || 0);

  // Utility (10%): interrupts + dispels normalized
  const avgUtil = (summary.avgInterrupts || 0) + (summary.avgDispels || 0);
  const utilityRaw = Math.min(100, avgUtil * 25); // 4+ combined = 100

  // Consistency (10%): inverse of DPS variance across bosses
  let consistencyRaw = 100;
  if (bossBreakdown.length >= 3) {
    const dpsValues = bossBreakdown.filter((b) => b.avgDps > 0).map((b) => b.avgDps);
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
      breakdown.consistency * SCORE_WEIGHTS.consistency,
  );

  const tier = SCORE_TIERS.find((t) => total >= t.min && total <= t.max) || SCORE_TIERS[0];

  return { total, tier, breakdown };
}

/**
 * Detect player skill level from performance data and external sources.
 * Uses a weighted scoring system to classify as beginner/intermediate/advanced.
 */
export function detectPlayerLevel(summary, bossBreakdown, raiderIO) {
  if (!summary || summary.totalFights === 0) {
    // With 0 fights, infer level from raiderIO profile
    if (raiderIO) {
      const mpScore = raiderIO?.mythicPlus?.score || 0;
      const progression = raiderIO?.raidProgression?.[0];
      const hasMythicKills = progression?.mythic > 0;

      if (
        mpScore >= LEVEL_DETECTION.mythicPlus.thresholds[2] ||
        (hasMythicKills && mpScore >= LEVEL_DETECTION.mythicPlus.thresholds[1])
      ) {
        return 'advanced';
      }
      if (mpScore >= LEVEL_DETECTION.mythicPlus.thresholds[0] || progression?.heroic > 0) {
        return 'intermediate';
      }
    }
    return 'beginner';
  }

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
    const dpsValues = bossBreakdown.filter((b) => b.avgDps > 0).map((b) => b.avgDps);
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
 * Recommendation engine v2 — pro-level, data-driven coaching.
 *
 * 3-tier architecture:
 *   Tier 1: Boss-specific insights (highest value — tells you WHERE to improve)
 *   Tier 2: Cross-pattern analysis (correlates data across bosses for root causes)
 *   Tier 3: General performance (essential baseline checks)
 *
 * Dynamic priority: bigger gaps = lower priority number = shown first.
 * Returns { primaryTips, secondaryTips, playerLevel }.
 */
export function generateRecommendations({
  summary,
  bossBreakdown,
  weeklyTrends: _weeklyTrends,
  playerLevel = 'beginner',
  raiderIO,
  specCpmBaseline,
  className,
  spec,
  role,
  talentData,
  specMeta,
}) {
  if (!summary) {
    return { primaryTips: [], secondaryTips: [], playerLevel };
  }

  if (summary.totalFights === 0) {
    const tips = [
      { category: 'performance', key: 'no_recent_data', severity: 'info', priority: 30, data: {} },
    ];
    return { primaryTips: tips, secondaryTips: [], playerLevel };
  }

  const tips = [
    ...generateTalentTips(talentData, specMeta, spec),
    ...generateBossSpecificTips(summary, bossBreakdown, playerLevel),
    ...generateCrossPatternTips(summary, bossBreakdown),
    ...generateRoleSpecificTips(summary, bossBreakdown, role, spec, specCpmBaseline),
    ...generateGeneralTips(summary, bossBreakdown, playerLevel, specCpmBaseline, className, spec),
  ];

  // M+ vault nudge: has raid data but no M+ activity this season
  if (raiderIO && (raiderIO.mythicPlus?.score || 0) === 0) {
    tips.push({
      category: 'mythicPlus',
      key: 'no_mplus_activity',
      severity: 'info',
      priority: 35,
      data: {},
    });
  }

  // Sort by priority (lowest first = most important)
  tips.sort((a, b) => a.priority - b.priority);
  const limit = TIP_LIMITS[playerLevel] || 3;

  return {
    primaryTips: tips.slice(0, limit),
    secondaryTips: tips.slice(limit),
    playerLevel,
  };
}

// ── Tier 1.5: Talent Comparison Tips ──────────────────────────
// Compare player's talents vs meta builds. High priority when data is available.

function generateTalentTips(talentData, specMeta, spec) {
  const tips = [];
  if (!talentData || !Array.isArray(talentData) || talentData.length === 0) return tips;
  if (!specMeta?.commonTalents) return tips;

  let commonTalents;
  try {
    commonTalents =
      typeof specMeta.commonTalents === 'string'
        ? JSON.parse(specMeta.commonTalents)
        : specMeta.commonTalents;
  } catch {
    return tips;
  }

  if (!Array.isArray(commonTalents) || commonTalents.length === 0) return tips;

  // Build a set of the player's talent node IDs
  const playerTalentIds = new Set(talentData.map((t) => t.id || t.nodeId).filter(Boolean));

  // talent_missing_key — meta talent the player doesn't have (>80% popularity)
  for (const meta of commonTalents) {
    const metaId = meta.id || meta.nodeId;
    if (!metaId) continue;
    if (meta.popularity >= 80 && !playerTalentIds.has(metaId)) {
      tips.push({
        category: 'gear',
        key: 'talent_missing_key',
        severity: 'warning',
        priority: 7,
        data: {
          talentName: meta.name || `Node ${metaId}`,
          metaPct: Math.round(meta.popularity),
          spec: spec || '',
        },
      });
      break; // only report the most popular missing talent
    }
  }

  // talent_off_meta — player uses a talent that <20% of top players use
  for (const playerTalent of talentData) {
    const id = playerTalent.id || playerTalent.nodeId;
    if (!id) continue;
    const metaEntry = commonTalents.find((m) => (m.id || m.nodeId) === id);
    if (metaEntry && metaEntry.popularity < 20) {
      // Find the most popular alternative the player doesn't already have
      const alternative = commonTalents.find(
        (m) => !playerTalentIds.has(m.id || m.nodeId) && m.popularity >= 60,
      );
      tips.push({
        category: 'gear',
        key: 'talent_off_meta',
        severity: 'info',
        priority: 9,
        data: {
          talentName: playerTalent.name || metaEntry.name || `Node ${id}`,
          metaPct: Math.round(metaEntry.popularity),
          metaAlternative: alternative?.name || 'the popular alternative',
          spec: spec || '',
        },
      });
      break; // only report the most off-meta talent
    }
  }

  return tips;
}

// ── Tier 1: Boss-Specific Tips ────────────────────────────────
// These are the most valuable — they tell the player exactly WHICH boss
// to focus on and WHAT aspect to improve.

function generateBossSpecificTips(summary, bossBreakdown, _playerLevel) {
  const tips = [];
  const eligibleBosses = bossBreakdown.filter((b) => b.fights >= 1);

  // boss_uptime_drop — active time drops significantly on a specific boss
  for (const boss of eligibleBosses) {
    if (summary.avgActiveTime > 0 && boss.avgActiveTime > 0) {
      const drop = summary.avgActiveTime - boss.avgActiveTime;
      if (drop >= 8) {
        tips.push({
          category: 'performance',
          key: 'boss_uptime_drop',
          severity: drop >= 15 ? 'critical' : 'warning',
          priority: 10 - Math.min(8, Math.round(drop / 2)),
          data: {
            boss: boss.bossName,
            difficulty: boss.difficulty,
            pct: Math.round(boss.avgActiveTime),
            avg: Math.round(summary.avgActiveTime),
            drop: Math.round(drop),
          },
        });
      }
    }
  }

  // boss_cpm_drop — CPM drops significantly (rotation slows down)
  for (const boss of eligibleBosses) {
    if (summary.avgCpm > 0 && boss.avgCpm > 0) {
      const ratio = boss.avgCpm / summary.avgCpm;
      if (ratio < 0.85) {
        const dropPct = Math.round((1 - ratio) * 100);
        tips.push({
          category: 'performance',
          key: 'boss_cpm_drop',
          severity: 'warning',
          priority: 12 - Math.min(6, Math.round(dropPct / 5)),
          data: {
            boss: boss.bossName,
            difficulty: boss.difficulty,
            cpm: boss.avgCpm.toFixed(1),
            avg: summary.avgCpm.toFixed(1),
            dropPct,
          },
        });
      }
    }
  }

  // boss_excess_damage — taking much more damage than average on a boss
  for (const boss of eligibleBosses) {
    if (summary.avgDtps > 0 && boss.avgDtps > 0) {
      const ratio = boss.avgDtps / summary.avgDtps;
      if (ratio > 1.3) {
        const excessPct = Math.round((ratio - 1) * 100);
        tips.push({
          category: 'survivability',
          key: 'boss_excess_damage',
          severity: ratio > 1.6 ? 'critical' : 'warning',
          priority: 10 - Math.min(7, Math.round(excessPct / 10)),
          data: {
            boss: boss.bossName,
            difficulty: boss.difficulty,
            dtps: Math.round(boss.avgDtps),
            avg: Math.round(summary.avgDtps),
            excessPct,
          },
        });
      }
    }
  }

  // boss_death_spike — death rate on a boss is way above average
  for (const boss of eligibleBosses) {
    const threshold = Math.max(summary.deathRate * 2, 0.2);
    if (boss.deathRate > threshold) {
      const spikeMultiple =
        summary.deathRate > 0 ? (boss.deathRate / summary.deathRate).toFixed(1) : 'N/A';
      tips.push({
        category: 'survivability',
        key: 'boss_death_spike',
        severity: boss.deathRate > 0.4 ? 'critical' : 'warning',
        priority: 8 - Math.min(6, Math.round(boss.deathRate * 10)),
        data: {
          boss: boss.bossName,
          difficulty: boss.difficulty,
          rate: boss.deathRate.toFixed(2),
          avg: summary.deathRate.toFixed(2),
          multiple: spikeMultiple,
          fights: boss.fights,
        },
      });
    }
  }

  // boss_potion_neglect — low potion usage specifically on the worst-performing boss
  const bossesWithEnoughFights = bossBreakdown.filter((b) => b.fights >= 1 && b.dpsVsMedian > 0);
  if (bossesWithEnoughFights.length >= 2) {
    const weakest = bossesWithEnoughFights.reduce((w, b) =>
      b.dpsVsMedian < w.dpsVsMedian ? b : w,
    );
    if (weakest.combatPotionRate < 50) {
      const bestPotRate = Math.max(...bossesWithEnoughFights.map((b) => b.combatPotionRate));
      if (bestPotRate - weakest.combatPotionRate > 20) {
        tips.push({
          category: 'consumables',
          key: 'boss_potion_neglect',
          severity: 'warning',
          priority: 14 - Math.min(5, Math.round((bestPotRate - weakest.combatPotionRate) / 10)),
          data: {
            boss: weakest.bossName,
            difficulty: weakest.difficulty,
            rate: Math.round(weakest.combatPotionRate),
            bestRate: Math.round(bestPotRate),
          },
        });
      }
    }
  }

  // boss_weakest_dps — biggest DPS gap across bosses (all levels)
  if (bossBreakdown.length >= 2) {
    const bossesWithDps = bossBreakdown.filter((b) => b.avgDps > 0 && b.fights >= 1);
    if (bossesWithDps.length >= 2) {
      const weakest = bossesWithDps.reduce((w, b) => (b.dpsVsMedian < w.dpsVsMedian ? b : w));
      const strongest = bossesWithDps.reduce((s, b) => (b.dpsVsMedian > s.dpsVsMedian ? b : s));
      const gap = strongest.dpsVsMedian - weakest.dpsVsMedian;
      if (gap > 10) {
        tips.push({
          category: 'performance',
          key: 'boss_weakest_dps',
          severity: gap > 25 ? 'warning' : 'info',
          priority: 8 - Math.min(6, Math.round(gap / 5)),
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

  return tips;
}

// ── Tier 2: Cross-Pattern Analysis ────────────────────────────
// These correlate data across bosses to find root causes.

function generateCrossPatternTips(summary, bossBreakdown) {
  const tips = [];
  const eligible = bossBreakdown.filter((b) => b.fights >= 1);

  // deaths_from_damage — bosses with highest deaths also have highest DTPS
  if (eligible.length >= 2) {
    const deathBosses = eligible.filter((b) => b.deathRate > 0.15);
    const highDtpsBosses = eligible.filter(
      (b) => summary.avgDtps > 0 && b.avgDtps > summary.avgDtps * 1.2,
    );
    const overlap = deathBosses.filter((db) =>
      highDtpsBosses.some((hb) => hb.bossId === db.bossId),
    );
    if (overlap.length > 0) {
      const worst = overlap.reduce((w, b) => (b.deathRate > w.deathRate ? b : w));
      tips.push({
        category: 'survivability',
        key: 'deaths_from_damage',
        severity: 'warning',
        priority: 15,
        data: {
          boss: worst.bossName,
          difficulty: worst.difficulty,
          deathRate: worst.deathRate.toFixed(2),
          dtps: Math.round(worst.avgDtps),
          avgDtps: Math.round(summary.avgDtps),
          count: overlap.length,
        },
      });
    }
  }

  // uptime_drives_dps — bosses with low active time also have low DPS vs median
  if (eligible.length >= 2 && summary.avgActiveTime > 0) {
    const lowUptimeBosses = eligible.filter(
      (b) => b.avgActiveTime > 0 && b.avgActiveTime < summary.avgActiveTime - 5,
    );
    const lowDpsBosses = lowUptimeBosses.filter((b) => b.dpsVsMedian < 100);
    if (lowDpsBosses.length > 0) {
      const worst = lowDpsBosses.reduce((w, b) => (b.dpsVsMedian < w.dpsVsMedian ? b : w));
      tips.push({
        category: 'performance',
        key: 'uptime_drives_dps',
        severity: 'info',
        priority: 16,
        data: {
          boss: worst.bossName,
          difficulty: worst.difficulty,
          activeTime: Math.round(worst.avgActiveTime),
          avgActiveTime: Math.round(summary.avgActiveTime),
          dpsVsMedian: Math.round(worst.dpsVsMedian),
          count: lowDpsBosses.length,
        },
      });
    }
  }

  // parse_vs_raid — parse and DPS-vs-median tell different stories
  if (summary.avgParsePercentile != null && summary.dpsVsMedianPct > 0) {
    const parse = summary.avgParsePercentile;
    const median = summary.dpsVsMedianPct;
    // Low parse but beating raid median = raid is underperforming
    if (parse < 50 && median > 100) {
      tips.push({
        category: 'performance',
        key: 'parse_vs_raid',
        severity: 'info',
        priority: 18,
        data: { parse, median: Math.round(median), context: 'raid_low' },
      });
    }
    // High parse but not beating raid median = raid is very strong
    if (parse >= 75 && median < 105) {
      tips.push({
        category: 'performance',
        key: 'parse_vs_raid',
        severity: 'info',
        priority: 18,
        data: { parse, median: Math.round(median), context: 'raid_strong' },
      });
    }
  }

  // defensive_gap — dying but not using healthstones
  if (summary.deathRate > 0.15 && summary.healthstoneRate < 30) {
    tips.push({
      category: 'survivability',
      key: 'defensive_gap',
      severity: 'warning',
      priority: 17,
      data: {
        deathRate: summary.deathRate.toFixed(2),
        healthstoneRate: Math.round(summary.healthstoneRate),
      },
    });
  }

  return tips;
}

// ── Tier 2.5: Role-Specific Tips ──────────────────────────────
// Tank and Healer specific checks using existing metrics with role-appropriate thresholds.

function generateRoleSpecificTips(summary, bossBreakdown, role, spec, specCpmBaseline) {
  const tips = [];
  if (!role || role === 'DPS') return tips;

  if (role === 'Tank') {
    // tank_death_impact — tank deaths cause wipes, amplified severity
    if (summary.deathRate > 0.2) {
      tips.push({
        category: 'survivability',
        key: 'tank_death_impact',
        severity: summary.deathRate > 0.35 ? 'critical' : 'warning',
        priority: 14 - Math.min(5, Math.round(summary.deathRate * 10)),
        data: { rate: summary.deathRate.toFixed(2) },
      });
    }

    // tank_low_cpm_mitigation — low CPM means gaps in active mitigation
    const tankCpmBaseline = specCpmBaseline || 28;
    if (summary.avgCpm > 0 && summary.avgCpm < tankCpmBaseline * 0.75) {
      const pct = Math.round((summary.avgCpm / tankCpmBaseline) * 100);
      tips.push({
        category: 'performance',
        key: 'tank_low_cpm_mitigation',
        severity: 'warning',
        priority: 16,
        data: {
          cpm: summary.avgCpm.toFixed(1),
          expected: tankCpmBaseline,
          pct,
          spec: spec || 'Tank',
        },
      });
    }

    // tank_dtps_outlier — specific boss where tank takes way more damage than their average
    const eligible = bossBreakdown.filter((b) => b.fights >= 1);
    for (const boss of eligible) {
      if (summary.avgDtps > 0 && boss.avgDtps > 0) {
        const ratio = boss.avgDtps / summary.avgDtps;
        if (ratio > 1.4) {
          const excessPct = Math.round((ratio - 1) * 100);
          tips.push({
            category: 'survivability',
            key: 'tank_dtps_outlier',
            severity: ratio > 1.7 ? 'critical' : 'warning',
            priority: 15,
            data: {
              boss: boss.bossName,
              difficulty: boss.difficulty,
              dtps: Math.round(boss.avgDtps),
              excessPct,
            },
          });
          break; // only report the worst outlier
        }
      }
    }

    // tank_low_interrupts — tanks should interrupt more (higher threshold than DPS)
    if (summary.avgInterrupts < 2 && summary.totalFights >= 2) {
      tips.push({
        category: 'utility',
        key: 'tank_low_interrupts',
        severity: 'info',
        priority: 19,
        data: { avg: summary.avgInterrupts.toFixed(1), target: 3 },
      });
    }
  }

  if (role === 'Healer') {
    // healer_low_dispels — healers should dispel proactively
    if (summary.avgDispels < 1.5 && summary.totalFights >= 3) {
      tips.push({
        category: 'utility',
        key: 'healer_low_dispels',
        severity: 'warning',
        priority: 16,
        data: { avg: summary.avgDispels.toFixed(1), fights: summary.totalFights },
      });
    }

    // healer_death_impact — healer deaths are extra costly
    if (summary.deathRate > 0.15) {
      tips.push({
        category: 'survivability',
        key: 'healer_death_impact',
        severity: summary.deathRate > 0.3 ? 'critical' : 'warning',
        priority: 14 - Math.min(5, Math.round(summary.deathRate * 10)),
        data: { rate: summary.deathRate.toFixed(2) },
      });
    }
  }

  return tips;
}

// ── Tier 3: General Performance ───────────────────────────────
// Essential baseline checks — only show when there's a real issue.

function generateGeneralTips(
  summary,
  bossBreakdown,
  _playerLevel,
  specCpmBaseline,
  className,
  spec,
) {
  const tips = [];
  const coaching = className && spec ? getSpecCoaching(className, spec) : null;

  // High death rate (critical survivability issue)
  // When spec coaching is available, use contextualized version with defensive CD advice
  if (summary.deathRate > 0.4) {
    if (coaching) {
      tips.push({
        category: 'survivability',
        key: 'spec_deaths_context',
        severity: 'critical',
        priority: 20,
        data: {
          rate: summary.deathRate.toFixed(2),
          spec: spec || '',
          defensiveCd: coaching.defensiveCd,
        },
      });
    } else {
      tips.push({
        category: 'survivability',
        key: 'high_death_rate',
        severity: 'critical',
        priority: 20,
        data: { rate: summary.deathRate.toFixed(2) },
      });
    }
  }

  // Low active time
  // When spec coaching is available, use contextualized version with movement advice
  if (summary.avgActiveTime > 0 && summary.avgActiveTime < 85) {
    if (coaching) {
      tips.push({
        category: 'performance',
        key: 'spec_uptime_context',
        severity: summary.avgActiveTime < 70 ? 'critical' : 'warning',
        priority: 22,
        data: {
          pct: Math.round(summary.avgActiveTime),
          spec: spec || '',
          context: coaching.lowUptime,
        },
      });
    } else {
      tips.push({
        category: 'performance',
        key: 'low_active_time',
        severity: summary.avgActiveTime < 70 ? 'critical' : 'warning',
        priority: 22,
        data: { pct: Math.round(summary.avgActiveTime) },
      });
    }
  }

  // Low CPM (spec-aware thresholds)
  // When spec coaching is available, use contextualized version with rotation advice
  const cpmBaseline = specCpmBaseline || 30;
  const cpmWarningThreshold = cpmBaseline * 0.75;
  const cpmCriticalThreshold = cpmBaseline * 0.55;
  if (summary.avgCpm > 0 && summary.avgCpm < cpmWarningThreshold) {
    if (coaching) {
      tips.push({
        category: 'performance',
        key: 'spec_cpm_context',
        severity: summary.avgCpm < cpmCriticalThreshold ? 'critical' : 'warning',
        priority: 23,
        data: {
          cpm: summary.avgCpm.toFixed(1),
          spec: spec || '',
          expected: cpmBaseline,
          context: coaching.lowCpm,
        },
      });
    } else {
      tips.push({
        category: 'performance',
        key: 'low_cpm',
        severity: summary.avgCpm < cpmCriticalThreshold ? 'critical' : 'warning',
        priority: 23,
        data: { cpm: summary.avgCpm.toFixed(1) },
      });
    }
  }

  // Low flask uptime
  if (summary.avgFlaskUptime < 90) {
    tips.push({
      category: 'consumables',
      key: 'low_flask',
      severity: 'warning',
      priority: 25,
      data: { uptime: Math.round(summary.avgFlaskUptime) },
    });
  }

  // No food buff
  if (summary.foodRate < 80) {
    tips.push({
      category: 'consumables',
      key: 'no_food',
      severity: 'info',
      priority: 27,
      data: { rate: Math.round(summary.foodRate) },
    });
  }

  // Low combat potion usage
  if (summary.combatPotionRate < 60) {
    tips.push({
      category: 'consumables',
      key: 'low_combat_potion',
      severity: 'warning',
      priority: 26,
      data: { rate: Math.round(summary.combatPotionRate) },
    });
  }

  // Low interrupts
  if (summary.avgInterrupts < 1 && summary.totalFights >= 2) {
    tips.push({
      category: 'utility',
      key: 'low_interrupts',
      severity: 'info',
      priority: 28,
      data: { avg: summary.avgInterrupts.toFixed(1) },
    });
  }

  // Low parse — when spec is known, use spec_parse_standing for context
  if (summary.avgParsePercentile != null) {
    if (spec && summary.avgParsePercentile < 25) {
      tips.push({
        category: 'performance',
        key: 'spec_parse_standing',
        severity: 'critical',
        priority: 21,
        data: {
          parse: summary.avgParsePercentile,
          spec,
          context: 'Focus on rotation fundamentals and uptime to climb out of the bottom quartile.',
        },
      });
    } else if (spec && summary.avgParsePercentile >= 25 && summary.avgParsePercentile < 50) {
      tips.push({
        category: 'performance',
        key: 'spec_parse_standing',
        severity: 'warning',
        priority: 24,
        data: {
          parse: summary.avgParsePercentile,
          spec,
          context: 'Small rotation and uptime improvements can push you above the median.',
        },
      });
    } else if (summary.avgParsePercentile < 25) {
      tips.push({
        category: 'performance',
        key: 'low_parse',
        severity: 'critical',
        priority: 21,
        data: { pct: summary.avgParsePercentile },
      });
    } else if (summary.avgParsePercentile < 50) {
      tips.push({
        category: 'performance',
        key: 'below_avg_parse',
        severity: 'warning',
        priority: 24,
        data: { pct: summary.avgParsePercentile },
      });
    }
  }

  // Good preparation (positive benchmark — max 1)
  if (summary.combatPotionRate >= 70 && summary.avgFlaskUptime >= 90 && summary.foodRate >= 80) {
    tips.push({
      category: 'consumables',
      key: 'good_preparation',
      severity: 'positive',
      priority: 50,
      data: {},
    });
  }

  // Strong boss (positive benchmark — shows best performance as reference)
  if (bossBreakdown.length >= 2) {
    const bossesWithDps = bossBreakdown.filter((b) => b.avgDps > 0 && b.fights >= 1);
    if (bossesWithDps.length >= 2) {
      const strongest = bossesWithDps.reduce((s, b) => (b.dpsVsMedian > s.dpsVsMedian ? b : s));
      if (strongest.dpsVsMedian > 110) {
        tips.push({
          category: 'performance',
          key: 'strong_boss',
          severity: 'positive',
          priority: 50,
          data: {
            boss: strongest.bossName,
            difficulty: strongest.difficulty,
            dpsVsMedian: Math.round(strongest.dpsVsMedian),
          },
        });
      }
    }
  }

  return tips;
}
