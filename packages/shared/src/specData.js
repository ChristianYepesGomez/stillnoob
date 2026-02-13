/**
 * WoW spec data for build analysis.
 * Keys match BLIZZARD_SPEC_MAP names exactly.
 * Stat priorities reflect TWW Season 3 (Patch 11.1+).
 */

export const SPEC_DATA = {
  Warrior: {
    Arms: {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['crit', 'haste', 'mastery', 'versatility'],
      expectedCpm: 35,
      softCaps: {},
    },
    Fury: {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      expectedCpm: 42,
      softCaps: {},
    },
    'Protection Warrior': {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      expectedCpm: 30,
      softCaps: {},
    },
  },

  Paladin: {
    'Holy Paladin': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 30,
      softCaps: {},
    },
    'Protection Paladin': {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      expectedCpm: 28,
      softCaps: {},
    },
    Retribution: {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      expectedCpm: 36,
      softCaps: {},
    },
  },

  Hunter: {
    'Beast Mastery': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      expectedCpm: 38,
      softCaps: {},
    },
    Marksmanship: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['mastery', 'crit', 'versatility', 'haste'],
      expectedCpm: 28,
      softCaps: {},
    },
    Survival: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      expectedCpm: 38,
      softCaps: {},
    },
  },

  Rogue: {
    Assassination: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 32,
      softCaps: {},
    },
    Outlaw: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['versatility', 'haste', 'crit', 'mastery'],
      expectedCpm: 40,
      softCaps: {},
    },
    Subtlety: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['versatility', 'crit', 'haste', 'mastery'],
      expectedCpm: 35,
      softCaps: {},
    },
  },

  Priest: {
    Discipline: {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 28,
      softCaps: {},
    },
    'Holy Priest': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 30,
      softCaps: {},
    },
    Shadow: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 32,
      softCaps: {},
    },
  },

  'Death Knight': {
    Blood: {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      expectedCpm: 25,
      softCaps: {},
    },
    'Frost DK': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['mastery', 'crit', 'haste', 'versatility'],
      expectedCpm: 35,
      softCaps: {},
    },
    Unholy: {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['mastery', 'haste', 'crit', 'versatility'],
      expectedCpm: 33,
      softCaps: {},
    },
  },

  Shaman: {
    Elemental: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      expectedCpm: 33,
      softCaps: {},
    },
    Enhancement: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'mastery', 'versatility', 'crit'],
      expectedCpm: 40,
      softCaps: {},
    },
    'Restoration Shaman': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['crit', 'haste', 'versatility', 'mastery'],
      expectedCpm: 28,
      softCaps: {},
    },
  },

  Mage: {
    Arcane: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 35,
      softCaps: {},
    },
    Fire: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      expectedCpm: 37,
      softCaps: {},
    },
    'Frost Mage': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 38,
      softCaps: {},
    },
  },

  Warlock: {
    Affliction: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 28,
      softCaps: {},
    },
    Demonology: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 33,
      softCaps: {},
    },
    Destruction: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      expectedCpm: 30,
      softCaps: {},
    },
  },

  Monk: {
    Brewmaster: {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['versatility', 'crit', 'mastery', 'haste'],
      expectedCpm: 30,
      softCaps: {},
    },
    Windwalker: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['mastery', 'versatility', 'crit', 'haste'],
      expectedCpm: 40,
      softCaps: {},
    },
    Mistweaver: {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 28,
      softCaps: {},
    },
  },

  Druid: {
    Balance: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 30,
      softCaps: {},
    },
    Feral: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['crit', 'mastery', 'versatility', 'haste'],
      expectedCpm: 35,
      softCaps: {},
    },
    Guardian: {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['versatility', 'haste', 'mastery', 'crit'],
      expectedCpm: 28,
      softCaps: {},
    },
    'Restoration Druid': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 28,
      softCaps: {},
    },
  },

  'Demon Hunter': {
    Havoc: {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 42,
      softCaps: {},
    },
    Vengeance: {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      expectedCpm: 28,
      softCaps: {},
    },
  },

  Evoker: {
    Devastation: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      expectedCpm: 35,
      softCaps: {},
    },
    Preservation: {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      expectedCpm: 28,
      softCaps: {},
    },
    Augmentation: {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      expectedCpm: 32,
      softCaps: {},
    },
  },
};

/**
 * Look up spec data by class name and spec name.
 * @param {string} className - Class name matching BLIZZARD_CLASS_MAP (e.g. 'Warrior')
 * @param {string} spec - Spec name matching BLIZZARD_SPEC_MAP (e.g. 'Arms')
 * @returns {{ role: string, mainStat: string, statPriority: string[], softCaps: object } | null}
 */
export function getSpecData(className, spec) {
  return SPEC_DATA[className]?.[spec] || null;
}

/** Gear slots that can receive enchantments. */
export const ENCHANTABLE_SLOTS = [
  'head',
  'back',
  'chest',
  'wrist',
  'legs',
  'feet',
  'finger1',
  'finger2',
  'mainHand',
];

/** All secondary stats in WoW. */
export const SECONDARY_STATS = ['crit', 'haste', 'mastery', 'versatility'];
