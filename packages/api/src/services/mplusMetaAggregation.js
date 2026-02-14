/**
 * M+ Meta Aggregation service — collects gear, stat, and talent data
 * from the top M+ players per spec (discovered via Blizzard leaderboards)
 * and stores aggregated "M+ meta" builds in the DB.
 *
 * Unlike the raid-based metaAggregation.js, this uses M+ leaderboard data
 * for a larger sample (500 players/spec) and includes talent aggregation.
 */

import { getCharacterEquipment, transformEquipment, getCharacterTalents } from './blizzard.js';
import {
  aggregateEquipmentStats,
  aggregateEnchants,
  aggregateGems,
  upsertSpecMeta,
  CURRENT_SEASON,
} from './metaAggregation.js';
import { getTopMplusPlayersForSpec, SPEC_ID_INFO } from './blizzardMplus.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MplusMetaAggregation');

/** Minimum players required for valid meta. */
const MIN_SAMPLE_SIZE = 50;

/** Minimum talent popularity % to include in commonTalents. */
const MIN_TALENT_POPULARITY = 5;

/**
 * Aggregate talent data across multiple talent loadouts.
 *
 * @param {Array<Array>} talentResults - Array of talent arrays from getCharacterTalents()
 * @param {number} sampleSize - Total samples for percentage calculation
 * @returns {Array} Sorted array of { id, nodeId, name, spellId, popularity }
 */
export function aggregateTalents(talentResults, sampleSize) {
  if (sampleSize === 0) return [];

  const talentCounts = new Map(); // nodeId → { count, name, spellId, id }

  for (const talents of talentResults) {
    if (!Array.isArray(talents)) continue;
    for (const talent of talents) {
      const nodeId = talent.nodeId || talent.id;
      if (!nodeId) continue;

      const existing = talentCounts.get(nodeId);
      if (existing) {
        existing.count++;
      } else {
        talentCounts.set(nodeId, {
          count: 1,
          id: talent.id,
          nodeId,
          name: talent.name || `Node ${nodeId}`,
          spellId: talent.spellId || null,
        });
      }
    }
  }

  return [...talentCounts.values()]
    .map((t) => ({
      id: t.id,
      nodeId: t.nodeId,
      name: t.name,
      spellId: t.spellId,
      popularity: Math.round((t.count / sampleSize) * 1000) / 10,
    }))
    .filter((t) => t.popularity >= MIN_TALENT_POPULARITY)
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * Find the Blizzard specId for a given className + spec name.
 */
function findSpecId(className, spec) {
  for (const [id, info] of Object.entries(SPEC_ID_INFO)) {
    if (info.className === className && info.spec === spec) {
      return Number(id);
    }
  }
  return null;
}

/**
 * Refresh M+ meta for a specific spec.
 *
 * 1. Gets top 500 players from leaderboard crawl results
 * 2. Fetches equipment + talents for each (with rate-limit delays)
 * 3. Aggregates stats, enchants, gems, and talents
 * 4. Upserts into spec_meta_cache with source='mplus'
 *
 * @param {string} className - Class display name (e.g. 'Death Knight')
 * @param {string} spec - Spec display name (e.g. 'Frost DK')
 * @param {string} region - 'world', 'us', 'eu', etc.
 * @param {number} limit - Max players to analyze (default 500)
 * @returns {Promise<object|null>} Aggregated meta data, or null on failure
 */
export async function refreshMplusSpecMeta(className, spec, region = 'world', limit = 500) {
  const season = CURRENT_SEASON;

  try {
    const specId = findSpecId(className, spec);
    if (!specId) {
      log.warn(`No specId found for ${className} ${spec}`);
      return null;
    }

    const topPlayers = getTopMplusPlayersForSpec(specId, limit);
    if (topPlayers.length < MIN_SAMPLE_SIZE) {
      log.warn(
        `Not enough M+ players for ${className} ${spec}: ${topPlayers.length} < ${MIN_SAMPLE_SIZE}`,
      );
      return null;
    }

    log.info(
      `Refreshing M+ meta: ${className} ${spec} (${region}) — ${topPlayers.length} players`,
    );

    const equipmentResults = [];
    const talentResults = [];
    let fetchedCount = 0;

    for (const player of topPlayers) {
      const playerRegion = player.region || 'eu';

      try {
        const [rawEquipment, talents] = await Promise.all([
          getCharacterEquipment(player.name, player.realmSlug, playerRegion).catch(() => null),
          getCharacterTalents(player.name, player.realmSlug, playerRegion).catch(() => null),
        ]);

        if (rawEquipment) {
          equipmentResults.push(transformEquipment(rawEquipment));
        }
        if (talents && talents.length > 0) {
          talentResults.push(talents);
        }

        fetchedCount++;
      } catch (err) {
        log.debug(`Failed to fetch data for ${player.name}-${player.realmSlug}`, err.message);
      }

      // Rate limiting: 150ms between players (2 parallel calls per player)
      await new Promise((r) => setTimeout(r, 150));

      if (fetchedCount % 100 === 0 && fetchedCount > 0) {
        log.info(
          `  ${className} ${spec}: ${fetchedCount}/${topPlayers.length} processed (${equipmentResults.length} equip, ${talentResults.length} talents)`,
        );
      }
    }

    if (equipmentResults.length < MIN_SAMPLE_SIZE) {
      log.warn(
        `Not enough equipment data for ${className} ${spec}: ${equipmentResults.length} < ${MIN_SAMPLE_SIZE}`,
      );
      return null;
    }

    // Aggregate
    const sampleSize = equipmentResults.length;
    const { avgStats, avgItemLevel } = aggregateEquipmentStats(equipmentResults);
    const commonEnchants = aggregateEnchants(equipmentResults, sampleSize);
    const commonGems = aggregateGems(equipmentResults, sampleSize);

    const talentSampleSize = talentResults.length;
    const commonTalents =
      talentSampleSize >= MIN_SAMPLE_SIZE
        ? aggregateTalents(talentResults, talentSampleSize)
        : [];

    // Upsert with source='mplus'
    const data = {
      avgStats: JSON.stringify(avgStats),
      avgItemLevel,
      commonEnchants: JSON.stringify(commonEnchants),
      commonGems: JSON.stringify(commonGems),
      commonTalents: JSON.stringify(commonTalents),
      sampleSize,
    };

    await upsertSpecMeta({ className, spec, region, season, source: 'mplus', data });

    log.info(
      `M+ meta updated: ${className} ${spec} — ${sampleSize} equip, ${talentSampleSize} talents, ${commonTalents.length} nodes, avgIlvl ${avgItemLevel}`,
    );

    return { avgStats, avgItemLevel, commonEnchants, commonGems, commonTalents, sampleSize };
  } catch (err) {
    log.error(`Failed to refresh M+ spec meta: ${className} ${spec}`, err);
    return null;
  }
}
