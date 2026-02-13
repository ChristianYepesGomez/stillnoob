import { describe, it, expect } from 'vitest';
import { analyzeCharacterBuild } from '../services/buildAnalysis.js';

// ─── Helpers ─────────────────────────────────────────────────

/** Builds a valid equipment object with sensible defaults, overridable via deep spread. */
function makeEquipment(overrides = {}) {
  const base = {
    items: [
      { slot: 'head', itemLevel: 620, enchant: 'Enchant Head', gems: [] },
      { slot: 'back', itemLevel: 618, enchant: 'Enchant Back', gems: [] },
      { slot: 'chest', itemLevel: 622, enchant: 'Enchant Chest', gems: [] },
      { slot: 'wrist', itemLevel: 619, enchant: 'Enchant Wrist', gems: [] },
      { slot: 'legs', itemLevel: 621, enchant: 'Enchant Legs', gems: [] },
      { slot: 'feet', itemLevel: 617, enchant: 'Enchant Feet', gems: [] },
      { slot: 'finger1', itemLevel: 620, enchant: 'Enchant Ring', gems: ['Gem1'] },
      { slot: 'finger2', itemLevel: 618, enchant: 'Enchant Ring', gems: ['Gem2'] },
      { slot: 'mainHand', itemLevel: 625, enchant: 'Enchant Weapon', gems: [] },
    ],
    enchantAudit: {
      missing: [],
      present: ['head', 'back', 'chest', 'wrist', 'legs', 'feet', 'finger1', 'finger2', 'mainHand'],
      enchanted: 9,
      total: 9,
      ...(overrides.enchantAudit || {}),
    },
    gemAudit: {
      empty: 0,
      filled: 2,
      totalSockets: 2,
      emptySlots: [],
      ...(overrides.gemAudit || {}),
    },
    aggregated: {
      averageItemLevel: 620,
      // Warrior Arms priority: crit > haste > mastery > versatility
      // Default: crit highest => alignment 'good'
      statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
      totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
      ...(overrides.aggregated || {}),
    },
  };

  // Allow overriding items array directly
  if (overrides.items) {
    base.items = overrides.items;
  }

  return base;
}

/** Builds a specMeta object with sensible defaults. */
function makeSpecMeta(overrides = {}) {
  return {
    avgStats: { crit: 33, haste: 28, mastery: 22, versatility: 17 },
    avgItemLevel: 625,
    commonEnchants: { chest: { name: 'Enchant Chest', pct: 85 } },
    commonGems: {},
    sampleSize: 30,
    ...overrides,
  };
}

// ─── Tip finder helper ───────────────────────────────────────

function findTip(gearTips, key) {
  return gearTips.find((t) => t.key === key);
}

// ═══════════════════════════════════════════════════════════════
//  analyzeCharacterBuild
// ═══════════════════════════════════════════════════════════════

describe('analyzeCharacterBuild', () => {
  // ── statAnalysis ──────────────────────────────────────────

  describe('statAnalysis', () => {
    it('returns alignment and details', () => {
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');

      expect(result.statAnalysis).toHaveProperty('alignment');
      expect(result.statAnalysis).toHaveProperty('details');
      expect(result.statAnalysis).toHaveProperty('distribution');
      expect(result.statAnalysis).toHaveProperty('specPriority');
      expect(Array.isArray(result.statAnalysis.details)).toBe(true);
      expect(result.statAnalysis.details.length).toBeGreaterThan(0);
    });

    it('alignment is "good" when top stats match spec priority', () => {
      // Warrior Arms: crit > haste > mastery > versatility
      // Player: crit 35%, haste 30% => top-2 match spec top-2 perfectly
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result.statAnalysis.alignment).toBe('good');
    });

    it('alignment is "mixed" when top stat is in priority but not #1', () => {
      // Warrior Arms: crit > haste > mastery > versatility
      // Player: haste 35%, crit 30% => haste is in top-2 but not #1
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 30, haste: 35, mastery: 20, versatility: 15 },
          totalStats: { crit: 4000, haste: 5000, mastery: 3000, versatility: 2000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result.statAnalysis.alignment).toBe('mixed');
    });

    it('alignment is "poor" when top stat is not in spec top 2', () => {
      // Warrior Arms: crit > haste > mastery > versatility
      // Player: versatility 40% => not in top 2
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 15, haste: 20, mastery: 25, versatility: 40 },
          totalStats: { crit: 2000, haste: 3000, mastery: 3500, versatility: 6000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result.statAnalysis.alignment).toBe('poor');
    });
  });

  // ── gear_missing_enchants ─────────────────────────────────

  describe('gear_missing_enchants', () => {
    it('generates tip when enchants are missing', () => {
      const equipment = makeEquipment({
        enchantAudit: {
          missing: ['wrist', 'legs'],
          present: ['chest', 'mainHand', 'head', 'back', 'feet', 'finger1', 'finger2'],
          enchanted: 7,
          total: 9,
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_enchants');
      expect(tip).toBeDefined();
      expect(tip.category).toBe('gear');
      expect(tip.priority).toBe(5);
      expect(tip.data.count).toBe(2);
      expect(tip.data.slots).toBe('wrist, legs');
    });

    it('severity is critical when >= 3 missing', () => {
      const equipment = makeEquipment({
        enchantAudit: {
          missing: ['wrist', 'legs', 'chest', 'feet'],
          present: ['mainHand', 'head', 'back', 'finger1', 'finger2'],
          enchanted: 5,
          total: 9,
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_enchants');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('critical');
    });

    it('severity is warning when 1-2 missing', () => {
      const equipment = makeEquipment({
        enchantAudit: {
          missing: ['wrist'],
          present: ['chest', 'mainHand', 'head', 'back', 'legs', 'feet', 'finger1', 'finger2'],
          enchanted: 8,
          total: 9,
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_enchants');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('warning');
    });

    it('does NOT generate when no missing enchants', () => {
      const equipment = makeEquipment(); // defaults: no missing enchants
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_enchants');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_suboptimal_enchant ───────────────────────────────

  describe('gear_suboptimal_enchant', () => {
    it('generates tip when DPS has defensive enchant (avoidance)', () => {
      const equipment = makeEquipment({
        items: [
          { slot: 'back', itemLevel: 620, enchant: 'Enchant Cloak - Graceful Avoidance', gems: [] },
          { slot: 'chest', itemLevel: 622, enchant: 'Enchant Chest', gems: [] },
        ],
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = result.gearTips.find((t) => t.key === 'gear_suboptimal_enchant');
      expect(tip).toBeDefined();
      expect(tip.data.slot).toBe('back');
      expect(tip.severity).toBe('warning');
    });

    it('does NOT generate tip for Tank with avoidance enchant', () => {
      const equipment = makeEquipment({
        items: [
          { slot: 'back', itemLevel: 620, enchant: 'Enchant Cloak - Graceful Avoidance', gems: [] },
        ],
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Protection Warrior');
      const tip = result.gearTips.find((t) => t.key === 'gear_suboptimal_enchant');
      expect(tip).toBeUndefined();
    });

    it('does NOT generate tip when DPS has throughput enchant', () => {
      const equipment = makeEquipment({
        items: [
          {
            slot: 'back',
            itemLevel: 620,
            enchant: 'Enchant Cloak - Chant of Winged Grace',
            gems: [],
          },
        ],
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = result.gearTips.find((t) => t.key === 'gear_suboptimal_enchant');
      expect(tip).toBeUndefined();
    });

    it('generates tip for speed enchant on DPS', () => {
      const equipment = makeEquipment({
        items: [
          {
            slot: 'feet',
            itemLevel: 620,
            enchant: "Enchant Boots - Defender's March (Speed)",
            gems: [],
          },
        ],
      });
      const result = analyzeCharacterBuild(equipment, 'Rogue', 'Assassination');
      const tip = result.gearTips.find((t) => t.key === 'gear_suboptimal_enchant');
      expect(tip).toBeDefined();
    });
  });

  // ── gear_missing_gems ─────────────────────────────────────

  describe('gear_missing_gems', () => {
    it('generates tip when gems are empty', () => {
      const equipment = makeEquipment({
        gemAudit: {
          empty: 2,
          filled: 1,
          totalSockets: 3,
          emptySlots: ['finger1', 'finger2'],
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_gems');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('warning');
      expect(tip.priority).toBe(6);
      expect(tip.data.count).toBe(2);
      expect(tip.data.slots).toBe('finger1, finger2');
    });

    it('does NOT generate when all gems filled', () => {
      const equipment = makeEquipment(); // defaults: empty = 0
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_missing_gems');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_stat_vs_meta ─────────────────────────────────────

  describe('gear_stat_vs_meta', () => {
    it('generates tip when stat gap > 5% vs meta', () => {
      // Player: crit 35%, meta: crit 28% => gap 7% > 5
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
        },
      });
      const specMeta = makeSpecMeta({
        avgStats: { crit: 28, haste: 30, mastery: 22, versatility: 20 },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms', specMeta);
      const tip = findTip(result.gearTips, 'gear_stat_vs_meta');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('warning');
      expect(tip.priority).toBe(8);
      expect(tip.data.gap).toBeGreaterThan(5);
    });

    it('does NOT generate when no specMeta provided', () => {
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_stat_vs_meta');
      expect(tip).toBeUndefined();
    });

    it('does NOT generate when all gaps <= 5%', () => {
      // Player stats very close to meta
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 30, haste: 28, mastery: 22, versatility: 20 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 3000 },
        },
      });
      const specMeta = makeSpecMeta({
        avgStats: { crit: 32, haste: 27, mastery: 23, versatility: 18 },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms', specMeta);
      const tip = findTip(result.gearTips, 'gear_stat_vs_meta');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_wrong_stat_priority ──────────────────────────────

  describe('gear_wrong_stat_priority', () => {
    it('generates tip when highest stat not in spec top 2', () => {
      // Warrior Arms: crit > haste. Player's highest: versatility
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 15, haste: 20, mastery: 25, versatility: 40 },
          totalStats: { crit: 2000, haste: 3000, mastery: 3500, versatility: 6000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_wrong_stat_priority');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('warning');
      expect(tip.priority).toBe(10);
      expect(tip.data.topStat).toBe('versatility');
      expect(tip.data.expectedStats).toBe('crit/haste');
    });

    it('does NOT generate when highest stat is in spec top 2', () => {
      // Warrior Arms: crit > haste. Player's highest: crit
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_wrong_stat_priority');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_low_ilvl_slot ────────────────────────────────────

  describe('gear_low_ilvl_slot', () => {
    it('generates tip when slot is 15+ ilvl below average', () => {
      const items = [
        { slot: 'head', itemLevel: 620, enchant: 'Enchant Head', gems: [] },
        { slot: 'chest', itemLevel: 620, enchant: 'Enchant Chest', gems: [] },
        { slot: 'wrist', itemLevel: 600, enchant: 'Enchant Wrist', gems: [] }, // 20 below avg
        { slot: 'mainHand', itemLevel: 620, enchant: 'Enchant Weapon', gems: [] },
      ];
      const equipment = makeEquipment({
        items,
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_low_ilvl_slot');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('info');
      expect(tip.priority).toBe(12);
      expect(tip.data.slot).toBe('wrist');
      expect(tip.data.gap).toBe(20);
    });

    it('does NOT generate when all slots within 14 ilvl', () => {
      const items = [
        { slot: 'head', itemLevel: 620, enchant: 'Enchant Head', gems: [] },
        { slot: 'chest', itemLevel: 615, enchant: 'Enchant Chest', gems: [] },
        { slot: 'wrist', itemLevel: 608, enchant: 'Enchant Wrist', gems: [] }, // 12 below = ok
        { slot: 'mainHand', itemLevel: 625, enchant: 'Enchant Weapon', gems: [] },
      ];
      const equipment = makeEquipment({
        items,
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 5000, haste: 4000, mastery: 3000, versatility: 2000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_low_ilvl_slot');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_enchant_vs_meta ──────────────────────────────────

  describe('gear_enchant_vs_meta', () => {
    it('generates tip when player enchant differs from meta', () => {
      const items = [
        { slot: 'chest', itemLevel: 620, enchant: 'Weird Enchant', gems: [] },
        { slot: 'mainHand', itemLevel: 625, enchant: 'Enchant Weapon', gems: [] },
      ];
      const equipment = makeEquipment({ items });
      const specMeta = makeSpecMeta({
        commonEnchants: { chest: { name: 'Popular Enchant', pct: 90 } },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms', specMeta);
      const tip = findTip(result.gearTips, 'gear_enchant_vs_meta');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('info');
      expect(tip.priority).toBe(14);
      expect(tip.data.slot).toBe('chest');
      expect(tip.data.playerEnchant).toBe('Weird Enchant');
      expect(tip.data.metaEnchant).toBe('Popular Enchant');
      expect(tip.data.metaPct).toBe(90);
    });

    it('does NOT generate without specMeta', () => {
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_enchant_vs_meta');
      expect(tip).toBeUndefined();
    });

    it('does NOT generate when enchant matches meta', () => {
      const items = [{ slot: 'chest', itemLevel: 620, enchant: 'Popular Enchant', gems: [] }];
      const equipment = makeEquipment({ items });
      const specMeta = makeSpecMeta({
        commonEnchants: { chest: { name: 'Popular Enchant', pct: 90 } },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms', specMeta);
      const tip = findTip(result.gearTips, 'gear_enchant_vs_meta');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_stat_overcap ─────────────────────────────────────

  describe('gear_stat_overcap', () => {
    it('does NOT generate when no soft caps defined', () => {
      // All current specs have softCaps: {}, so this tip should never fire
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 35, haste: 30, mastery: 20, versatility: 15 },
          totalStats: { crit: 15000, haste: 12000, mastery: 9000, versatility: 7000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_stat_overcap');
      expect(tip).toBeUndefined();
    });
  });

  // ── gear_well_optimized ───────────────────────────────────

  describe('gear_well_optimized', () => {
    it('generates positive tip when all enchants present, all gems filled, alignment good', () => {
      // Default makeEquipment: no missing enchants, no empty gems
      // Default stat distribution: crit highest => 'good' for Arms Warrior
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_well_optimized');
      expect(tip).toBeDefined();
      expect(tip.severity).toBe('positive');
      expect(tip.priority).toBe(50);
      expect(tip.category).toBe('gear');
    });

    it('does NOT generate when enchants are missing', () => {
      const equipment = makeEquipment({
        enchantAudit: {
          missing: ['wrist'],
          present: ['chest', 'mainHand'],
          enchanted: 2,
          total: 3,
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_well_optimized');
      expect(tip).toBeUndefined();
    });

    it('does NOT generate when gems are missing', () => {
      const equipment = makeEquipment({
        gemAudit: {
          empty: 1,
          filled: 1,
          totalSockets: 2,
          emptySlots: ['finger1'],
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_well_optimized');
      expect(tip).toBeUndefined();
    });

    it('does NOT generate when alignment is poor', () => {
      // Warrior Arms: crit > haste. Player: versatility highest => poor alignment
      const equipment = makeEquipment({
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 15, haste: 20, mastery: 25, versatility: 40 },
          totalStats: { crit: 2000, haste: 3000, mastery: 3500, versatility: 6000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      const tip = findTip(result.gearTips, 'gear_well_optimized');
      expect(tip).toBeUndefined();
    });
  });

  // ── Return structure ──────────────────────────────────────

  describe('return structure', () => {
    it('returns statAnalysis, enchantAudit, gemAudit, and gearTips', () => {
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result).toHaveProperty('statAnalysis');
      expect(result).toHaveProperty('enchantAudit');
      expect(result).toHaveProperty('gemAudit');
      expect(result).toHaveProperty('gearTips');
      expect(Array.isArray(result.gearTips)).toBe(true);
    });

    it('every tip has required fields', () => {
      // Trigger several tips at once
      const equipment = makeEquipment({
        enchantAudit: {
          missing: ['wrist', 'legs', 'chest'],
          present: ['mainHand'],
          enchanted: 1,
          total: 4,
        },
        gemAudit: {
          empty: 2,
          filled: 0,
          totalSockets: 2,
          emptySlots: ['finger1', 'finger2'],
        },
        aggregated: {
          averageItemLevel: 620,
          statDistribution: { crit: 15, haste: 20, mastery: 25, versatility: 40 },
          totalStats: { crit: 2000, haste: 3000, mastery: 3500, versatility: 6000 },
        },
      });
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result.gearTips.length).toBeGreaterThan(0);
      for (const tip of result.gearTips) {
        expect(tip).toHaveProperty('category');
        expect(tip).toHaveProperty('key');
        expect(tip).toHaveProperty('severity');
        expect(tip).toHaveProperty('priority');
        expect(tip).toHaveProperty('data');
        expect(typeof tip.priority).toBe('number');
      }
    });

    it('enchantAudit and gemAudit are passed through from equipment', () => {
      const equipment = makeEquipment();
      const result = analyzeCharacterBuild(equipment, 'Warrior', 'Arms');
      expect(result.enchantAudit).toBe(equipment.enchantAudit);
      expect(result.gemAudit).toBe(equipment.gemAudit);
    });
  });
});
