/**
 * Meta Aggregation service — collects gear/stat data from top-ranked players
 * for each spec and stores aggregated "meta" builds in the DB.
 * Used to compare individual players against the current meta.
 */

import { db } from '../db/client.js';
import { specMetaCache } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSpecRankings } from './raiderio.js';
import { getCharacterEquipment, transformEquipment } from './blizzard.js';
import { SECONDARY_STATS } from '@stillnoob/shared';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MetaAggregation');

/** Current season identifier (hardcoded for TWW Season 2). */
const CURRENT_SEASON = 'tww-2';

/** How long a cached meta entry is considered fresh (7 days). */
const META_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Refresh the spec meta cache by fetching gear data from top-ranked players.
 *
 * 1. Gets the top 30 players from Raider.IO rankings
 * 2. Fetches each player's equipment from the Blizzard API (with rate-limit delays)
 * 3. Aggregates stats, enchants, and gems across all successful fetches
 * 4. Upserts the result into the specMetaCache table
 *
 * @param {string} className - Class display name (e.g. 'Death Knight')
 * @param {string} spec - Spec display name (e.g. 'Frost DK')
 * @param {string} region - 'world', 'us', 'eu', etc.
 * @returns {Promise<object|null>} The aggregated meta data, or null on failure
 */
export async function refreshSpecMeta(className, spec, region = 'world') {
  const season = CURRENT_SEASON;

  try {
    // Step 1: Get top ranked players
    const topPlayers = await getSpecRankings(className, spec, region);
    if (!topPlayers.length) {
      log.warn('No ranked players found', { className, spec, region });
      return null;
    }

    log.info(`Refreshing meta: ${className} ${spec} (${region}) — ${topPlayers.length} players`);

    // Step 2: Fetch equipment for each player
    const equipmentResults = [];

    for (const player of topPlayers) {
      try {
        // Use player's own region for Blizzard API calls
        const playerRegion = player.region || 'eu';
        const rawEquipment = await getCharacterEquipment(player.name, player.realm, playerRegion);

        if (rawEquipment) {
          const transformed = transformEquipment(rawEquipment);
          equipmentResults.push(transformed);
        }
      } catch (err) {
        log.debug(`Failed to fetch equipment for ${player.name}-${player.realm}`, err.message);
      }

      // Rate limiting: 200ms between each player
      await new Promise(r => setTimeout(r, 200));
    }

    if (!equipmentResults.length) {
      log.warn('No equipment data fetched for any player', { className, spec, region });
      return null;
    }

    log.info(`Got equipment for ${equipmentResults.length}/${topPlayers.length} players`);

    // Step 3: Aggregate results
    const sampleSize = equipmentResults.length;

    // --- Average stats (stat distribution percentages) ---
    const avgStats = {};
    for (const stat of SECONDARY_STATS) {
      const sum = equipmentResults.reduce(
        (acc, eq) => acc + (eq.aggregated?.statDistribution?.[stat] || 0),
        0
      );
      avgStats[stat] = Math.round((sum / sampleSize) * 10) / 10;
    }

    // --- Average item level ---
    const avgItemLevel = Math.round(
      (equipmentResults.reduce((acc, eq) => acc + (eq.aggregated?.averageItemLevel || 0), 0) / sampleSize) * 10
    ) / 10;

    // --- Common enchants (per enchantable slot) ---
    const enchantCounts = {}; // slot → { enchantName → count }
    for (const eq of equipmentResults) {
      for (const item of eq.items || []) {
        if (item.enchant) {
          if (!enchantCounts[item.slot]) enchantCounts[item.slot] = {};
          enchantCounts[item.slot][item.enchant] = (enchantCounts[item.slot][item.enchant] || 0) + 1;
        }
      }
    }

    const commonEnchants = {};
    for (const [slot, enchants] of Object.entries(enchantCounts)) {
      const sorted = Object.entries(enchants).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const [name, count] = sorted[0];
        commonEnchants[slot] = {
          name,
          pct: Math.round((count / sampleSize) * 1000) / 10,
        };
      }
    }

    // --- Common gems ---
    const gemCounts = {}; // gemName → count
    for (const eq of equipmentResults) {
      for (const item of eq.items || []) {
        for (const gem of item.gems || []) {
          gemCounts[gem] = (gemCounts[gem] || 0) + 1;
        }
      }
    }

    const commonGems = {};
    const sortedGems = Object.entries(gemCounts).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sortedGems.slice(0, 10)) {
      commonGems[name] = {
        count,
        pct: Math.round((count / sampleSize) * 1000) / 10,
      };
    }

    // Step 4: Upsert into DB
    const data = {
      avgStats: JSON.stringify(avgStats),
      avgItemLevel,
      commonEnchants: JSON.stringify(commonEnchants),
      commonGems: JSON.stringify(commonGems),
      sampleSize,
    };

    const existing = await db.select().from(specMetaCache)
      .where(and(
        eq(specMetaCache.className, className),
        eq(specMetaCache.spec, spec),
        eq(specMetaCache.region, region),
        eq(specMetaCache.season, season),
      )).get();

    if (existing) {
      await db.update(specMetaCache)
        .set({ ...data, lastUpdated: new Date().toISOString() })
        .where(eq(specMetaCache.id, existing.id));
    } else {
      await db.insert(specMetaCache).values({
        className,
        spec,
        region,
        season,
        ...data,
        lastUpdated: new Date().toISOString(),
      });
    }

    log.info(`Meta cache updated: ${className} ${spec} (${region}) — ${sampleSize} samples, avgIlvl ${avgItemLevel}`);

    return { avgStats, avgItemLevel, commonEnchants, commonGems, sampleSize };
  } catch (err) {
    log.error(`Failed to refresh spec meta: ${className} ${spec}`, err);
    return null;
  }
}

/**
 * Get cached spec meta data from the DB.
 * Returns null if no cached data exists or if the cache is older than 7 days.
 *
 * @param {string} className - Class display name
 * @param {string} spec - Spec display name
 * @param {string} region - 'world', 'us', 'eu', etc.
 * @returns {Promise<object|null>} Parsed meta data or null
 */
export async function getSpecMeta(className, spec, region = 'world') {
  try {
    const row = await db.select().from(specMetaCache)
      .where(and(
        eq(specMetaCache.className, className),
        eq(specMetaCache.spec, spec),
        eq(specMetaCache.region, region),
      )).get();

    if (!row) return null;

    // Check freshness
    const lastUpdated = new Date(row.lastUpdated).getTime();
    if (Date.now() - lastUpdated > META_FRESHNESS_MS) {
      return null;
    }

    return {
      className: row.className,
      spec: row.spec,
      region: row.region,
      season: row.season,
      avgStats: JSON.parse(row.avgStats || '{}'),
      avgItemLevel: row.avgItemLevel,
      commonEnchants: JSON.parse(row.commonEnchants || '{}'),
      commonGems: JSON.parse(row.commonGems || '{}'),
      sampleSize: row.sampleSize,
      lastUpdated: row.lastUpdated,
    };
  } catch (err) {
    log.error('Failed to get spec meta', err);
    return null;
  }
}

/**
 * Compare a player's equipment stats against the spec meta.
 * Returns per-stat deviations showing how the player differs from the average top player.
 *
 * @param {object} playerEquipment - Transformed equipment from transformEquipment()
 * @param {object} specMeta - Meta data from getSpecMeta() (with parsed avgStats)
 * @returns {object} Per-stat deviations: { crit: { player, meta, gap }, ... }
 */
export function compareAgainstMeta(playerEquipment, specMeta) {
  const playerStats = playerEquipment?.aggregated?.statDistribution || {};
  const metaStats = specMeta?.avgStats || {};

  const deviations = {};
  for (const stat of SECONDARY_STATS) {
    const playerVal = playerStats[stat] || 0;
    const metaVal = metaStats[stat] || 0;
    deviations[stat] = {
      player: playerVal,
      meta: metaVal,
      gap: Math.round((playerVal - metaVal) * 10) / 10,
    };
  }

  return deviations;
}
