/**
 * Build / Gear Analysis Service
 *
 * Analyzes a player's equipment (items, enchants, gems, stats) against their
 * spec's stat priority and optional community meta data (Phase 4).
 * Produces coaching tips following the same { category, key, severity, priority, data }
 * pattern used by the performance analysis engine.
 *
 * Pure function — no DB access, no async.
 */

import { getSpecData, SECONDARY_STATS } from '@stillnoob/shared';

/** Cosmetic slots excluded from ilvl tips */
const COSMETIC_SLOTS = new Set(['shirt', 'tabard']);

/** Defensive/tertiary enchant patterns — suboptimal for DPS roles */
const TERTIARY_ENCHANT_PATTERNS = /avoidance|speed|leech|stamina|armor kit/i;

// ── Helpers ────────────────────────────────────────────────────

/**
 * Determine how well a player's stat distribution aligns with spec priority.
 *
 * - 'good':  top stat matches #1 priority AND top-2 stats match top-2 priority
 * - 'mixed': top stat is in top-2 priority but not perfectly aligned
 * - 'poor':  top stat is NOT in top-2 priority
 *
 * @param {Record<string, number>} statDistribution  e.g. { crit: 25, haste: 40, ... }
 * @param {string[]} specPriority  ordered stat priority for the spec
 * @returns {'good'|'mixed'|'poor'}
 */
function calculateAlignment(statDistribution, specPriority) {
  // Sort secondary stats by player's percentage (descending)
  const playerRanked = SECONDARY_STATS
    .filter((s) => statDistribution[s] != null)
    .sort((a, b) => (statDistribution[b] || 0) - (statDistribution[a] || 0));

  if (playerRanked.length < 2 || specPriority.length < 2) return 'poor';

  const playerTop1 = playerRanked[0];
  const playerTop2 = playerRanked[1];
  const specTop2 = specPriority.slice(0, 2);

  // Player's highest stat is NOT in spec's top 2 => poor
  if (!specTop2.includes(playerTop1)) return 'poor';

  // Player's top stat IS #1 priority AND both top-2 stats match spec top-2 => good
  if (playerTop1 === specPriority[0] && specTop2.includes(playerTop2)) return 'good';

  // Top stat is in top-2 but not perfectly aligned => mixed
  return 'mixed';
}

/**
 * Build a ranked detail list comparing player stat distribution to spec priority.
 */
function buildStatDetails(statDistribution, specPriority) {
  return SECONDARY_STATS
    .filter((s) => statDistribution[s] != null)
    .map((stat) => {
      const rank = specPriority.indexOf(stat);
      return {
        stat,
        playerPct: Math.round((statDistribution[stat] || 0) * 10) / 10,
        rank: rank !== -1 ? rank + 1 : specPriority.length + 1,
        isTopPriority: rank === 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

// ── Main Export ────────────────────────────────────────────────

/**
 * Analyze a character's equipment and generate gear coaching tips.
 *
 * @param {object} equipment     Output of transformEquipment()
 * @param {string} className     e.g. 'Warrior'
 * @param {string} spec          e.g. 'Arms'
 * @param {object|null} specMeta Optional community meta (Phase 4)
 * @returns {{ statAnalysis, enchantAudit, gemAudit, gearTips }}
 */
export function analyzeCharacterBuild(equipment, className, spec, specMeta = null) {
  const specData = getSpecData(className, spec);
  const { statDistribution } = equipment.aggregated;
  const specPriority = specData?.statPriority || SECONDARY_STATS;
  const softCaps = specData?.softCaps || {};

  // ── Stat analysis ───────────────────────────────────────────
  const alignment = calculateAlignment(statDistribution, specPriority);
  const details = buildStatDetails(statDistribution, specPriority);

  const statAnalysis = {
    distribution: statDistribution,
    specPriority,
    alignment,
    details,
  };

  // ── Tip generation ──────────────────────────────────────────
  const gearTips = [];

  // 1. gear_missing_enchants
  const { missing, total } = equipment.enchantAudit;
  if (missing.length > 0) {
    gearTips.push({
      category: 'gear',
      key: 'gear_missing_enchants',
      severity: missing.length >= 3 ? 'critical' : 'warning',
      priority: 5,
      data: { count: missing.length, slots: missing.join(', '), total },
    });
  }

  // 1b. gear_suboptimal_enchant — DPS using defensive/tertiary enchants
  if (specData?.role === 'DPS') {
    for (const item of equipment.items) {
      if (item.enchant && TERTIARY_ENCHANT_PATTERNS.test(item.enchant)) {
        gearTips.push({
          category: 'gear',
          key: 'gear_suboptimal_enchant',
          severity: 'warning',
          priority: 7,
          data: { slot: item.slot, enchant: item.enchant },
        });
        break; // only report the first suboptimal enchant
      }
    }
  }

  // 2. gear_missing_gems
  const { empty, emptySlots } = equipment.gemAudit;
  if (empty > 0) {
    gearTips.push({
      category: 'gear',
      key: 'gear_missing_gems',
      severity: 'warning',
      priority: 6,
      data: { count: empty, slots: emptySlots.join(', ') },
    });
  }

  // 3. gear_stat_vs_meta (only when specMeta is provided)
  if (specMeta?.avgStats) {
    let biggestGap = null;
    for (const stat of SECONDARY_STATS) {
      const playerPct = statDistribution[stat] || 0;
      const metaPct = specMeta.avgStats[stat] || 0;
      const gap = Math.abs(playerPct - metaPct);
      if (gap > 5 && (!biggestGap || gap > biggestGap.gap)) {
        biggestGap = {
          stat,
          playerPct: Math.round(playerPct * 10) / 10,
          metaPct: Math.round(metaPct * 10) / 10,
          gap: Math.round(gap * 10) / 10,
        };
      }
    }
    if (biggestGap) {
      gearTips.push({
        category: 'gear',
        key: 'gear_stat_vs_meta',
        severity: 'warning',
        priority: 8,
        data: biggestGap,
      });
    }
  }

  // 4. gear_wrong_stat_priority
  //    Trigger: player's highest % stat is NOT in the spec's top 2 priority stats
  const playerRanked = SECONDARY_STATS
    .filter((s) => statDistribution[s] != null)
    .sort((a, b) => (statDistribution[b] || 0) - (statDistribution[a] || 0));

  if (playerRanked.length > 0 && specPriority.length >= 2) {
    const topStat = playerRanked[0];
    const topPct = Math.round((statDistribution[topStat] || 0) * 10) / 10;
    const specTop2 = specPriority.slice(0, 2);

    if (!specTop2.includes(topStat)) {
      gearTips.push({
        category: 'gear',
        key: 'gear_wrong_stat_priority',
        severity: 'warning',
        priority: 10,
        data: {
          topStat,
          topPct,
          expectedStats: specTop2.join('/'),
          specPriority: specPriority.join(' > '),
        },
      });
    }
  }

  // 5. gear_low_ilvl_slot
  //    Trigger: any slot is 15+ ilvl below the character's average
  const avgIlvl = equipment.aggregated.averageItemLevel;
  if (equipment.items.length > 0 && avgIlvl > 0) {
    let worstSlot = null;
    for (const item of equipment.items) {
      if (COSMETIC_SLOTS.has(item.slot)) continue;
      const gap = avgIlvl - item.itemLevel;
      if (gap >= 15 && (!worstSlot || gap > worstSlot.gap)) {
        worstSlot = {
          slot: item.slot,
          itemLevel: item.itemLevel,
          average: avgIlvl,
          gap: Math.round(gap),
        };
      }
    }
    if (worstSlot) {
      gearTips.push({
        category: 'gear',
        key: 'gear_low_ilvl_slot',
        severity: 'info',
        priority: 12,
        data: worstSlot,
      });
    }
  }

  // 6. gear_enchant_vs_meta (only when specMeta is provided)
  if (specMeta?.commonEnchants) {
    for (const item of equipment.items) {
      const metaEnchant = specMeta.commonEnchants[item.slot];
      if (!metaEnchant) continue;

      // Player has an enchant on this slot but it differs from the popular one
      if (item.enchant && item.enchant !== metaEnchant.name) {
        gearTips.push({
          category: 'gear',
          key: 'gear_enchant_vs_meta',
          severity: 'info',
          priority: 14,
          data: {
            slot: item.slot,
            playerEnchant: item.enchant,
            metaEnchant: metaEnchant.name,
            metaPct: metaEnchant.pct,
          },
        });
        break; // only report the first mismatch
      }
    }
  }

  // 7. gear_stat_overcap
  //    Trigger: player has more of a stat than its soft cap
  const { totalStats } = equipment.aggregated;
  for (const stat of SECONDARY_STATS) {
    const cap = softCaps[stat];
    if (cap != null && (totalStats[stat] || 0) > cap) {
      gearTips.push({
        category: 'gear',
        key: 'gear_stat_overcap',
        severity: 'info',
        priority: 15,
        data: {
          stat,
          value: totalStats[stat],
          cap,
        },
      });
      break; // only report the first overcap
    }
  }

  // 8. gear_well_optimized (positive feedback)
  //    Only when there are no missing enchants, no missing gems, AND stat alignment is good
  if (missing.length === 0 && empty === 0 && alignment === 'good') {
    gearTips.push({
      category: 'gear',
      key: 'gear_well_optimized',
      severity: 'positive',
      priority: 50,
      data: {},
    });
  }

  return {
    statAnalysis,
    enchantAudit: equipment.enchantAudit,
    gemAudit: equipment.gemAudit,
    gearTips,
  };
}
