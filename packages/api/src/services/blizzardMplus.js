/**
 * Blizzard M+ Leaderboard Crawler
 *
 * Discovers top M+ players per spec by crawling regional leaderboards
 * from the Blizzard Game Data API. Deduplicates across connected realms
 * and ranks players by highest keystone level completed.
 */

import axios from 'axios';
import { getAccessToken, BLIZZARD_SPEC_MAP, BLIZZARD_CLASS_MAP } from './blizzard.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('BlizzardMplus');

// --- Configuration ---

const RATE_LIMIT_DELAY_MS = 20; // ~50 req/s (conservative)
const CIRCUIT_BREAKER_THRESHOLD = 10;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

// --- In-memory caches ---

const connectedRealmCache = new Map(); // region → { data, timestamp }
const CONNECTED_REALM_TTL = 24 * 60 * 60 * 1000; // 24h

const seasonCache = { id: null, timestamp: 0 };
const SEASON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const periodCache = { id: null, timestamp: 0 };
const PERIOD_CACHE_TTL = 60 * 60 * 1000; // 1h

const dungeonCache = { dungeons: null, timestamp: 0, seasonId: null };
const DUNGEON_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/** Last full crawl results — kept in memory for on-demand per-spec queries. */
let lastCrawlResults = null; // { data: Map<specId, player[]>, timestamp, regions }

// --- Helpers ---

const getApiUrl = (region) => `https://${region}.api.blizzard.com`;

function isTransientError(err) {
  if (err.response) {
    const status = err.response.status;
    return status === 429 || status >= 500;
  }
  return (
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND' ||
    err.message?.includes('timeout')
  );
}

async function retryWithBackoff(fn, label) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        log.warn(`${label} failed (${err.response?.status || err.code}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Build reverse map: specId → { className, spec } using our BLIZZARD_SPEC_MAP. */
function buildSpecIdToInfoMap() {
  const map = {};
  // Build reverse class map: classId → className
  const classIdToName = {};
  for (const [id, name] of Object.entries(BLIZZARD_CLASS_MAP)) {
    classIdToName[Number(id)] = name;
  }

  for (const [specId, info] of Object.entries(BLIZZARD_SPEC_MAP)) {
    // Find the classId for this spec by matching class name
    let classId = null;
    for (const [cId, cName] of Object.entries(BLIZZARD_CLASS_MAP)) {
      // Check if this spec belongs to this class by looking at SPEC_DATA structure
      // We use a heuristic: spec IDs follow class groupings in Blizzard's system
      const sid = Number(specId);
      if (
        (cName === 'Warrior' && sid >= 71 && sid <= 73) ||
        (cName === 'Paladin' && [65, 66, 70].includes(sid)) ||
        (cName === 'Hunter' && sid >= 253 && sid <= 255) ||
        (cName === 'Rogue' && sid >= 259 && sid <= 261) ||
        (cName === 'Priest' && sid >= 256 && sid <= 258) ||
        (cName === 'Death Knight' && sid >= 250 && sid <= 252) ||
        (cName === 'Shaman' && sid >= 262 && sid <= 264) ||
        (cName === 'Mage' && sid >= 62 && sid <= 64) ||
        (cName === 'Warlock' && sid >= 265 && sid <= 267) ||
        (cName === 'Monk' && sid >= 268 && sid <= 270) ||
        (cName === 'Druid' && sid >= 102 && sid <= 105) ||
        (cName === 'Demon Hunter' && [577, 581].includes(sid)) ||
        (cName === 'Evoker' && [1467, 1468, 1473].includes(sid))
      ) {
        classId = Number(cId);
        break;
      }
    }

    map[Number(specId)] = {
      className: classId ? classIdToName[classId] : 'Unknown',
      spec: info.spec,
      role: info.role,
    };
  }

  return map;
}

const SPEC_ID_INFO = buildSpecIdToInfoMap();

// --- Public API ---

/**
 * Get connected realms for a region. Cached 24h.
 * @param {string} region - 'eu' or 'us'
 * @returns {Promise<number[]>} Array of connected realm IDs
 */
export async function getConnectedRealms(region) {
  const r = region.toLowerCase();
  const cached = connectedRealmCache.get(r);
  if (cached && Date.now() - cached.timestamp < CONNECTED_REALM_TTL) {
    return cached.data;
  }

  const token = await getAccessToken();
  const response = await axios.get(`${getApiUrl(r)}/data/wow/connected-realm/index`, {
    params: { namespace: `dynamic-${r}`, locale: 'en_US' },
    headers: { Authorization: `Bearer ${token}` },
    timeout: REQUEST_TIMEOUT_MS,
  });

  // Extract connected realm IDs from href links
  const realmIds = (response.data.connected_realms || []).map((cr) => {
    const match = cr.href?.match(/connected-realm\/(\d+)/);
    return match ? Number(match[1]) : null;
  }).filter(Boolean);

  connectedRealmCache.set(r, { data: realmIds, timestamp: Date.now() });
  log.info(`Fetched ${realmIds.length} connected realms for ${r.toUpperCase()}`);
  return realmIds;
}

/**
 * Get current M+ season ID. Cached 24h.
 * @returns {Promise<number>}
 */
export async function getCurrentMplusSeason() {
  if (seasonCache.id && Date.now() - seasonCache.timestamp < SEASON_CACHE_TTL) {
    return seasonCache.id;
  }

  const region = process.env.BLIZZARD_REGION || 'eu';
  const token = await getAccessToken();
  const response = await axios.get(
    `${getApiUrl(region)}/data/wow/mythic-keystone/season/index`,
    {
      params: { namespace: `dynamic-${region}`, locale: 'en_US' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  const seasons = response.data.seasons || [];
  const latest = seasons[seasons.length - 1];
  if (!latest?.id) throw new Error('No M+ seasons found');

  seasonCache.id = latest.id;
  seasonCache.timestamp = Date.now();
  log.info(`Current M+ season: ${latest.id}`);
  return latest.id;
}

/**
 * Get current M+ period (weekly reset cycle). Cached 1h.
 * @returns {Promise<number>}
 */
export async function getCurrentPeriod() {
  if (periodCache.id && Date.now() - periodCache.timestamp < PERIOD_CACHE_TTL) {
    return periodCache.id;
  }

  const region = process.env.BLIZZARD_REGION || 'eu';
  const token = await getAccessToken();
  const response = await axios.get(
    `${getApiUrl(region)}/data/wow/mythic-keystone/period/index`,
    {
      params: { namespace: `dynamic-${region}`, locale: 'en_US' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  const periods = response.data.periods || [];
  const latest = periods[periods.length - 1];
  if (!latest?.id) throw new Error('No M+ periods found');

  periodCache.id = latest.id;
  periodCache.timestamp = Date.now();
  return latest.id;
}

/**
 * Get current M+ dungeon rotation for a season. Cached 24h.
 * @param {number} seasonId
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getMplusDungeons(seasonId) {
  if (
    dungeonCache.dungeons &&
    dungeonCache.seasonId === seasonId &&
    Date.now() - dungeonCache.timestamp < DUNGEON_CACHE_TTL
  ) {
    return dungeonCache.dungeons;
  }

  const region = process.env.BLIZZARD_REGION || 'eu';
  const token = await getAccessToken();
  const response = await axios.get(
    `${getApiUrl(region)}/data/wow/mythic-keystone/season/${seasonId}`,
    {
      params: { namespace: `dynamic-${region}`, locale: 'en_US' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  // Season detail includes periods and key_stones_per_season_upgrade (not dungeons directly).
  // Dungeons come from the dungeon index — but the season detail may not list them.
  // Fall back to dungeon index if needed.
  let dungeons = (response.data.periods || []).length > 0
    ? await fetchDungeonIndex(region, token)
    : [];

  if (dungeons.length === 0) {
    dungeons = await fetchDungeonIndex(region, token);
  }

  dungeonCache.dungeons = dungeons;
  dungeonCache.seasonId = seasonId;
  dungeonCache.timestamp = Date.now();
  log.info(`Current M+ dungeons: ${dungeons.map((d) => d.name).join(', ')}`);
  return dungeons;
}

async function fetchDungeonIndex(region, token) {
  const response = await axios.get(
    `${getApiUrl(region)}/data/wow/mythic-keystone/dungeon/index`,
    {
      params: { namespace: `dynamic-${region}`, locale: 'en_US' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  return (response.data.dungeons || []).map((d) => ({
    id: d.id,
    name: d.name,
  }));
}

/**
 * Crawl a single leaderboard (one connected realm × one dungeon × current period).
 * @param {string} region
 * @param {number} connectedRealmId
 * @param {number} dungeonId
 * @param {number} periodId
 * @returns {Promise<Array>} Leading groups with members
 */
async function crawlLeaderboard(region, connectedRealmId, dungeonId, periodId) {
  const token = await getAccessToken();

  const response = await axios.get(
    `${getApiUrl(region)}/data/wow/connected-realm/${connectedRealmId}/mythic-leaderboard/${dungeonId}/period/${periodId}`,
    {
      params: { namespace: `dynamic-${region}`, locale: 'en_US' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    },
  );

  return response.data.leading_groups || [];
}

/**
 * Crawl all M+ leaderboards for a region and extract unique players per spec.
 *
 * @param {string} region - 'eu' or 'us'
 * @returns {Promise<Map<number, Array>>} Map of specId → player entries
 *   Each player: { name, realmSlug, region, maxKeyLevel, dungeonId, duration, className, spec, role }
 */
export async function crawlRegionalLeaderboards(region) {
  const r = region.toLowerCase();
  log.info(`Starting M+ leaderboard crawl for ${r.toUpperCase()}...`);

  const [connectedRealmIds, periodId, seasonId] = await Promise.all([
    getConnectedRealms(r),
    getCurrentPeriod(),
    getCurrentMplusSeason(),
  ]);

  const dungeons = await getMplusDungeons(seasonId);
  if (dungeons.length === 0) {
    log.warn('No dungeons found for current season');
    return new Map();
  }

  // Per-spec player map: specId → Map<playerKey, playerData>
  const specPlayers = new Map();

  let totalCalls = 0;
  let totalFailures = 0;
  let consecutiveFailures = 0;
  const totalExpected = connectedRealmIds.length * dungeons.length;

  for (const realmId of connectedRealmIds) {
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      log.error(`Circuit breaker triggered after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures — aborting crawl for ${r.toUpperCase()}`);
      break;
    }

    for (const dungeon of dungeons) {
      try {
        const groups = await retryWithBackoff(
          () => crawlLeaderboard(r, realmId, dungeon.id, periodId),
          `leaderboard(${r}/${realmId}/${dungeon.id})`,
        );

        consecutiveFailures = 0;
        totalCalls++;

        // Extract players from groups
        for (const group of groups) {
          const keystoneLevel = group.keystone_level;
          const duration = group.duration;

          for (const member of group.members || []) {
            const specId = member.specialization?.id;
            if (!specId || !SPEC_ID_INFO[specId]) continue;

            const playerName = member.profile?.name;
            const realmSlug = member.profile?.realm?.slug;
            if (!playerName || !realmSlug) continue;

            // Dedup key: name + realm + region (normalized)
            const playerKey = `${playerName}:${realmSlug}:${r}`.normalize('NFC').toLowerCase();

            if (!specPlayers.has(specId)) {
              specPlayers.set(specId, new Map());
            }

            const specMap = specPlayers.get(specId);
            const existing = specMap.get(playerKey);

            // Keep highest key per player
            if (!existing || keystoneLevel > existing.maxKeyLevel) {
              const info = SPEC_ID_INFO[specId];
              specMap.set(playerKey, {
                name: playerName,
                realmSlug,
                region: r,
                maxKeyLevel: keystoneLevel,
                dungeonId: dungeon.id,
                duration,
                className: info.className,
                spec: info.spec,
                role: info.role,
              });
            }
          }
        }
      } catch (err) {
        totalFailures++;
        consecutiveFailures++;
        // 404 is expected for realm/dungeon combos with no data
        if (err.response?.status !== 404) {
          log.warn(`Leaderboard fetch failed: ${r}/${realmId}/${dungeon.id} — ${err.message}`);
        }
      }

      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  // Convert inner Maps to sorted arrays
  const result = new Map();
  for (const [specId, playerMap] of specPlayers) {
    const players = [...playerMap.values()].sort((a, b) => b.maxKeyLevel - a.maxKeyLevel);
    result.set(specId, players);
  }

  const totalPlayers = [...result.values()].reduce((sum, arr) => sum + arr.length, 0);
  log.info(
    `Crawl ${r.toUpperCase()} complete: ${totalCalls}/${totalExpected} calls, ${totalFailures} failures, ${totalPlayers} unique players across ${result.size} specs`,
  );

  return result;
}

/**
 * Get top M+ players for a specific spec from cached crawl results.
 *
 * @param {number} specId - Blizzard specialization ID
 * @param {number} limit - Max players to return (default 500)
 * @returns {Array} Top players sorted by maxKeyLevel desc
 */
export function getTopMplusPlayersForSpec(specId, limit = 500) {
  if (!lastCrawlResults?.data) {
    return [];
  }

  const players = lastCrawlResults.data.get(specId) || [];
  return players.slice(0, limit);
}

/**
 * Get the age of the last crawl in milliseconds.
 * Returns Infinity if no crawl has been done.
 */
export function getCrawlAge() {
  if (!lastCrawlResults?.timestamp) return Infinity;
  return Date.now() - lastCrawlResults.timestamp;
}

/**
 * Run a full multi-region crawl and store results.
 * This is the main entry point called by the job scheduler.
 *
 * @param {string[]} regions - Regions to crawl (default ['eu', 'us'])
 * @returns {Promise<{totalPlayers: number, specCount: number, regions: string[]}>}
 */
export async function runFullCrawl(regions = ['eu', 'us']) {
  log.info(`Starting full M+ crawl for regions: ${regions.join(', ')}`);

  const mergedPlayers = new Map(); // specId → Map<playerKey, playerData>

  for (const region of regions) {
    try {
      const regionData = await crawlRegionalLeaderboards(region);

      // Merge into combined results
      for (const [specId, players] of regionData) {
        if (!mergedPlayers.has(specId)) {
          mergedPlayers.set(specId, new Map());
        }
        const mergedMap = mergedPlayers.get(specId);

        for (const player of players) {
          const key = `${player.name}:${player.realmSlug}:${player.region}`
            .normalize('NFC')
            .toLowerCase();
          const existing = mergedMap.get(key);
          if (!existing || player.maxKeyLevel > existing.maxKeyLevel) {
            mergedMap.set(key, player);
          }
        }
      }
    } catch (err) {
      log.error(`Regional crawl failed for ${region}: ${err.message}`);
    }
  }

  // Convert to sorted arrays and store
  const result = new Map();
  for (const [specId, playerMap] of mergedPlayers) {
    result.set(
      specId,
      [...playerMap.values()].sort((a, b) => b.maxKeyLevel - a.maxKeyLevel),
    );
  }

  lastCrawlResults = {
    data: result,
    timestamp: Date.now(),
    regions,
  };

  const totalPlayers = [...result.values()].reduce((sum, arr) => sum + arr.length, 0);
  log.info(
    `Full crawl complete: ${totalPlayers} unique players across ${result.size} specs from ${regions.join('+')}`,
  );

  return { totalPlayers, specCount: result.size, regions };
}

export { SPEC_ID_INFO };
