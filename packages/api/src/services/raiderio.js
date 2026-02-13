/**
 * Raider.io API integration — free, public, no auth needed.
 * https://raider.io/api
 */

const BASE_URL = 'https://raider.io/api/v1';

import { db } from '../db/client.js';
import { mplusSnapshots } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { createLogger } from '../utils/logger.js';
const log = createLogger('RaiderIO');

// In-memory cache: key → { data, timestamp }
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCacheKey(region, realm, name) {
  return `${region}:${realm}:${name}`.normalize('NFC').toLowerCase();
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 100; i++) cache.delete(oldest[i][0]);
  }
}

/**
 * Fetch character M+ and raid data from Raider.io
 * @param {string} region - us, eu, kr, tw
 * @param {string} realm - realm slug (e.g. "tarren-mill")
 * @param {string} name - character name
 * @returns {object|null} Raider.io profile data, or null if not found
 */
export async function getCharacterRaiderIO(region, realm, name) {
  const cacheKey = getCacheKey(region, realm, name);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fields = [
    'mythic_plus_scores_by_season:current',
    'mythic_plus_recent_runs',
    'mythic_plus_best_runs:all',
    'raid_progression',
    'gear',
  ].join(',');

  const url = `${BASE_URL}/characters/profile?region=${encodeURIComponent(region)}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=${fields}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 400) {
      // Character not found on Raider.io — cache null to avoid repeated lookups
      setCache(cacheKey, null);
      return null;
    }

    if (!response.ok) {
      log.error(`API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = transformRaiderIOData(data);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    log.error('Fetch failed', err.message);
    return null;
  }
}

/**
 * Save M+ score snapshot if score has changed since last snapshot.
 * @param {number} characterId - DB character ID
 * @param {object} raiderIO - Transformed Raider.IO data
 * @returns {boolean} true if a new snapshot was saved
 */
export async function saveScoreSnapshot(characterId, raiderIO) {
  if (!raiderIO?.mythicPlus?.score) return false;

  try {
    // Get the most recent snapshot
    const [lastSnapshot] = await db.select()
      .from(mplusSnapshots)
      .where(eq(mplusSnapshots.characterId, characterId))
      .orderBy(desc(mplusSnapshots.snapshotAt))
      .limit(1)
      .all();

    const currentScore = raiderIO.mythicPlus.score;

    // Only snapshot if score changed (or first snapshot)
    if (lastSnapshot && lastSnapshot.score === currentScore) return false;

    const bestRunLevel = raiderIO.bestRuns?.length
      ? Math.max(...raiderIO.bestRuns.map(r => r.level))
      : null;

    // Count unique dungeons with timed runs
    const timedDungeons = new Set(
      (raiderIO.bestRuns || []).filter(r => r.upgrades > 0).map(r => r.dungeon)
    );

    await db.insert(mplusSnapshots).values({
      characterId,
      score: currentScore,
      scoreDps: raiderIO.mythicPlus.scoreDps || 0,
      scoreHealer: raiderIO.mythicPlus.scoreHealer || 0,
      scoreTank: raiderIO.mythicPlus.scoreTank || 0,
      itemLevel: raiderIO.gear?.itemLevel || null,
      bestRunLevel,
      totalDungeons: timedDungeons.size || null,
    });

    return true;
  } catch (err) {
    log.error('Failed to save M+ snapshot', err.message);
    return false;
  }
}

/**
 * Transform raw Raider.io response into our standardized format
 */
function transformRaiderIOData(raw) {
  const currentSeason = raw.mythic_plus_scores_by_season?.[0];

  return {
    // M+ Score
    mythicPlus: {
      score: currentSeason?.scores?.all ?? 0,
      scoreColor: currentSeason?.segments?.all?.color ?? '#ffffff',
      scoreDps: currentSeason?.scores?.dps ?? 0,
      scoreHealer: currentSeason?.scores?.healer ?? 0,
      scoreTank: currentSeason?.scores?.tank ?? 0,
    },

    // Best runs (top 8 by score)
    bestRuns: (raw.mythic_plus_best_runs || []).slice(0, 8).map(run => ({
      dungeon: run.dungeon,
      shortName: run.short_name,
      level: run.mythic_level,
      upgrades: run.num_keystone_upgrades,
      score: run.score,
      url: run.url,
      completedAt: run.completed_at,
      clearTimeMs: run.clear_time_ms,
      parTimeMs: run.par_time_ms,
    })),

    // Recent runs (last 5)
    recentRuns: (raw.mythic_plus_recent_runs || []).slice(0, 5).map(run => ({
      dungeon: run.dungeon,
      shortName: run.short_name,
      level: run.mythic_level,
      upgrades: run.num_keystone_upgrades,
      score: run.score,
      url: run.url,
      completedAt: run.completed_at,
    })),

    // Raid progression
    raidProgression: Object.entries(raw.raid_progression || {}).map(([raidSlug, prog]) => ({
      raid: prog.summary, // e.g. "8/8 H"
      slug: raidSlug,
      normal: prog.normal_bosses_killed ?? 0,
      heroic: prog.heroic_bosses_killed ?? 0,
      mythic: prog.mythic_bosses_killed ?? 0,
      totalBosses: prog.total_bosses ?? 0,
    })),

    // Gear
    gear: raw.gear ? {
      itemLevel: raw.gear.item_level_equipped,
      itemLevelTotal: raw.gear.item_level_total,
    } : null,

    // Profile info
    profile: {
      name: raw.name,
      realm: raw.realm,
      region: raw.region,
      class: raw.class,
      spec: raw.active_spec_name,
      role: raw.active_spec_role,
      race: raw.race,
      faction: raw.faction,
      thumbnailUrl: raw.thumbnail_url,
      profileUrl: raw.profile_url,
    },
  };
}
