/**
 * Unified Character Profile service — replaces Raider.IO for character M+ data.
 *
 * Fetches M+ profile, gear, and basic character info directly from Blizzard API.
 * Returns data in the same format as the raiderio.js transform so all consumers
 * can switch without changes to their data handling.
 */

import {
  getCharacterProfile,
  getCharacterMythicProfile,
  BLIZZARD_SPEC_MAP,
} from './blizzard.js';
import { getCurrentMplusSeason } from './blizzardMplus.js';
import { getScoreColor, calculateUpgrades, getDungeonShortName, getDungeonTimer } from '@stillnoob/shared';
import { db } from '../db/client.js';
import { mplusSnapshots } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { createLogger } from '../utils/logger.js';

const log = createLogger('CharacterProfile');

// In-memory cache (same strategy as raiderio.js)
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCacheKey(region, realmSlug, name) {
  return `profile:${region}:${realmSlug}:${name}`.normalize('NFC').toLowerCase();
}

/**
 * Get unified character profile from Blizzard API.
 * Returns data in the same format as getCharacterRaiderIO() for drop-in replacement.
 *
 * @param {string} region
 * @param {string} realmSlug
 * @param {string} name
 * @returns {Promise<object|null>} Profile in raiderIO-compatible format, or null
 */
export async function getCharacterBlizzardProfile(region, realmSlug, name) {
  const cacheKey = getCacheKey(region, realmSlug, name);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch basic profile and M+ data in parallel
    const seasonId = await getCurrentMplusSeason();
    const [profile, mplusProfile] = await Promise.all([
      getCharacterProfile(name, realmSlug, region).catch(() => null),
      getCharacterMythicProfile(name, realmSlug, region, seasonId).catch(() => null),
    ]);

    if (!profile) {
      cache.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    }

    const specInfo = profile.spec
      ? Object.values(BLIZZARD_SPEC_MAP).find((s) => s.spec === profile.spec)
      : null;

    // Build M+ data
    const rating = mplusProfile?.mythicRating;
    const score = rating?.rating || 0;
    const bestRuns = (mplusProfile?.bestRuns || []).map((run) => {
      const dungeonName = run.dungeon?.name || 'Unknown';
      const dungeonId = run.dungeon?.id || null;
      const parTimeMs = getDungeonTimer(dungeonId, dungeonName);

      return {
        dungeon: dungeonName,
        shortName: getDungeonShortName(dungeonId, dungeonName),
        level: run.keystoneLevel,
        upgrades: run.isCompleted
          ? (parTimeMs ? calculateUpgrades(run.duration, parTimeMs) : 0) || 1
          : 0,
        score: 0, // Blizzard doesn't provide per-run scores
        url: null,
        completedAt: run.completedTimestamp
          ? new Date(run.completedTimestamp).toISOString()
          : null,
        clearTimeMs: run.duration,
        parTimeMs,
      };
    });

    // Build the response in the exact same format as raiderio.js transformRaiderIOData
    const data = {
      mythicPlus: {
        score,
        scoreColor: getScoreColor(score),
        scoreDps: rating?.rating_dps || 0,
        scoreHealer: rating?.rating_healer || 0,
        scoreTank: rating?.rating_tank || 0,
      },
      bestRuns: bestRuns.slice(0, 8),
      recentRuns: [], // Blizzard API doesn't provide recent runs
      raidProgression: [], // Can be added via encounters API if needed
      gear: {
        itemLevel: profile.equippedItemLevel || profile.averageItemLevel || null,
      },
      profile: {
        name: profile.name,
        realm: profile.realmSlug || realmSlug,
        region,
        class: profile.className,
        spec: profile.spec,
        role: specInfo?.role || profile.raidRole,
      },
    };

    cache.set(cacheKey, { data, timestamp: Date.now() });

    // Evict old entries
    if (cache.size > 500) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 100; i++) cache.delete(oldest[i][0]);
    }

    return data;
  } catch (err) {
    log.error(`Failed to fetch Blizzard profile: ${name}-${realmSlug}`, err.message);

    // Cache null to avoid repeated failures
    cache.set(cacheKey, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Save M+ score snapshot (same as raiderio.js saveScoreSnapshot).
 * Only snapshots when score changes from the last recorded value.
 *
 * @param {number} characterId - DB character ID
 * @param {object} profileData - Profile data from getCharacterBlizzardProfile()
 * @returns {Promise<boolean>} Whether a new snapshot was created
 */
export async function saveScoreSnapshot(characterId, profileData) {
  if (!profileData?.mythicPlus?.score) return false;

  const currentScore = profileData.mythicPlus.score;

  // Check last snapshot
  const [lastSnapshot] = await db
    .select()
    .from(mplusSnapshots)
    .where(eq(mplusSnapshots.characterId, characterId))
    .orderBy(desc(mplusSnapshots.snapshotAt))
    .limit(1)
    .all();

  if (lastSnapshot && lastSnapshot.score === currentScore) return false;

  const bestRunLevel = profileData.bestRuns?.length
    ? Math.max(...profileData.bestRuns.map((r) => r.level))
    : null;

  const timedDungeons = new Set(
    (profileData.bestRuns || []).filter((r) => r.upgrades > 0).map((r) => r.dungeon),
  );

  await db.insert(mplusSnapshots).values({
    characterId,
    score: currentScore,
    scoreDps: profileData.mythicPlus.scoreDps || 0,
    scoreHealer: profileData.mythicPlus.scoreHealer || 0,
    scoreTank: profileData.mythicPlus.scoreTank || 0,
    itemLevel: profileData.gear?.itemLevel || null,
    bestRunLevel,
    totalDungeons: timedDungeons.size || null,
  });

  return true;
}
