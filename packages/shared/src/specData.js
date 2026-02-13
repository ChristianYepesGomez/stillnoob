/**
 * WoW spec data for build analysis.
 * Keys match BLIZZARD_SPEC_MAP names exactly.
 * Stat priorities reflect TWW Season 3 (Patch 11.1+).
 */

export const SPEC_DATA = {
  'Warrior': {
    'Arms': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['crit', 'haste', 'mastery', 'versatility'],
      softCaps: {},
    },
    'Fury': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      softCaps: {},
    },
    'Protection Warrior': {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      softCaps: {},
    },
  },

  'Paladin': {
    'Holy Paladin': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
    'Protection Paladin': {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      softCaps: {},
    },
    'Retribution': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      softCaps: {},
    },
  },

  'Hunter': {
    'Beast Mastery': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      softCaps: {},
    },
    'Marksmanship': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['mastery', 'crit', 'versatility', 'haste'],
      softCaps: {},
    },
    'Survival': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      softCaps: {},
    },
  },

  'Rogue': {
    'Assassination': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Outlaw': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['versatility', 'haste', 'crit', 'mastery'],
      softCaps: {},
    },
    'Subtlety': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['versatility', 'crit', 'haste', 'mastery'],
      softCaps: {},
    },
  },

  'Priest': {
    'Discipline': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
    'Holy Priest': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Shadow': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
  },

  'Death Knight': {
    'Blood': {
      role: 'Tank',
      mainStat: 'strength',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      softCaps: {},
    },
    'Frost DK': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['mastery', 'crit', 'haste', 'versatility'],
      softCaps: {},
    },
    'Unholy': {
      role: 'DPS',
      mainStat: 'strength',
      statPriority: ['mastery', 'haste', 'crit', 'versatility'],
      softCaps: {},
    },
  },

  'Shaman': {
    'Elemental': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      softCaps: {},
    },
    'Enhancement': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'mastery', 'versatility', 'crit'],
      softCaps: {},
    },
    'Restoration Shaman': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['crit', 'haste', 'versatility', 'mastery'],
      softCaps: {},
    },
  },

  'Mage': {
    'Arcane': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
    'Fire': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'versatility', 'mastery', 'crit'],
      softCaps: {},
    },
    'Frost Mage': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
  },

  'Warlock': {
    'Affliction': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Demonology': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Destruction': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
      softCaps: {},
    },
  },

  'Monk': {
    'Brewmaster': {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['versatility', 'crit', 'mastery', 'haste'],
      softCaps: {},
    },
    'Windwalker': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['mastery', 'versatility', 'crit', 'haste'],
      softCaps: {},
    },
    'Mistweaver': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
  },

  'Druid': {
    'Balance': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Feral': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['crit', 'mastery', 'versatility', 'haste'],
      softCaps: {},
    },
    'Guardian': {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['versatility', 'haste', 'mastery', 'crit'],
      softCaps: {},
    },
    'Restoration Druid': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
  },

  'Demon Hunter': {
    'Havoc': {
      role: 'DPS',
      mainStat: 'agility',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
    'Vengeance': {
      role: 'Tank',
      mainStat: 'agility',
      statPriority: ['haste', 'versatility', 'crit', 'mastery'],
      softCaps: {},
    },
  },

  'Evoker': {
    'Devastation': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'mastery', 'crit', 'versatility'],
      softCaps: {},
    },
    'Preservation': {
      role: 'Healer',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'versatility', 'mastery'],
      softCaps: {},
    },
    'Augmentation': {
      role: 'DPS',
      mainStat: 'intellect',
      statPriority: ['haste', 'crit', 'mastery', 'versatility'],
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
