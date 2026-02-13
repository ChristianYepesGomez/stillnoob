/**
 * Spec-specific coaching context for all 37 WoW specs.
 *
 * Keys match SPEC_DATA / BLIZZARD_SPEC_MAP names exactly.
 * Values are short ability/mechanic references (English only — these are
 * game terms that don't get translated).
 *
 * Used by the coaching engine to contextualize generic tips
 * (e.g. "low CPM" becomes "low Rampage/Bloodthirst GCD utilization").
 */

export const SPEC_COACHING = {
  Warrior: {
    Arms: {
      lowCpm: 'Mortal Strike and Execute windows during Colossus Smash',
      lowUptime:
        'maintain Colossus Smash windows during forced movement — use Heroic Leap and Charge to close gaps',
      defensiveCd: 'Die by the Sword, Spell Reflection, and Rallying Cry',
    },
    Fury: {
      lowCpm: 'Rampage and Bloodthirst GCD utilization — avoid capping rage',
      lowUptime: 'keep Enrage uptime during forced movement — Heroic Leap back to boss quickly',
      defensiveCd: 'Enraged Regeneration and Rallying Cry',
    },
    'Protection Warrior': {
      lowCpm: 'Shield Slam and Thunder Clap rotation to maintain Shield Block uptime',
      lowUptime: 'Shield Block and Ignore Pain uptime — gaps mean unmitigated hits',
      defensiveCd: 'Shield Wall, Last Stand, and Spell Reflection timing',
    },
  },

  Paladin: {
    'Holy Paladin': {
      lowCpm: 'Holy Shock on cooldown and Holy Light/Flash of Light filler usage',
      lowUptime:
        'maintain casting between heals — Consecration and Judgment contribute to Infusion of Light procs',
      defensiveCd: 'Divine Shield, Blessing of Protection, and Lay on Hands timing',
    },
    'Protection Paladin': {
      lowCpm: 'Shield of the Righteous and Judgment rotation for active mitigation',
      lowUptime: 'Shield of the Righteous uptime — every gap is unmitigated physical damage',
      defensiveCd: 'Ardent Defender, Guardian of Ancient Kings, and Lay on Hands',
    },
    Retribution: {
      lowCpm: "Templar's Verdict and Wake of Ashes usage — avoid capping Holy Power",
      lowUptime: 'Divine Steed and Blessing of Freedom for movement phases',
      defensiveCd: 'Shield of Vengeance and Divine Shield',
    },
  },

  Hunter: {
    'Beast Mastery': {
      lowCpm: 'Kill Command and Barbed Shot usage — keep Frenzy stacks rolling',
      lowUptime: 'maintain Barbed Shot Frenzy stacks during movement — BM is fully mobile',
      defensiveCd: 'Exhilaration, Aspect of the Turtle, and Feign Death',
    },
    Marksmanship: {
      lowCpm: 'Aimed Shot charges and Rapid Fire usage — avoid overcapping charges',
      lowUptime: 'pre-position for Aimed Shot casts — plan movement around Trueshot windows',
      defensiveCd: 'Exhilaration, Aspect of the Turtle, and Feign Death',
    },
    Survival: {
      lowCpm: 'Raptor Strike/Mongoose Bite and Kill Command weaving',
      lowUptime: 'Harpoon back to targets quickly after forced displacement',
      defensiveCd: 'Exhilaration, Aspect of the Turtle, and Feign Death',
    },
  },

  Rogue: {
    Assassination: {
      lowCpm: 'Mutilate and Envenom usage — avoid capping combo points',
      lowUptime: 'maintain Garrote and Rupture through movement — apply before repositioning',
      defensiveCd: 'Cloak of Shadows, Evasion, and Feint',
    },
    Outlaw: {
      lowCpm: 'Sinister Strike and Dispatch usage — keep Roll the Bones active',
      lowUptime: 'Grappling Hook and Sprint to return to melee range quickly',
      defensiveCd: 'Cloak of Shadows, Evasion, and Feint',
    },
    Subtlety: {
      lowCpm: 'Shadowstrike and Eviscerate usage — maximize Shadow Dance windows',
      lowUptime: 'Shadow Step back to targets — plan Shadow Dance around movement',
      defensiveCd: 'Cloak of Shadows, Evasion, and Feint',
    },
  },

  Priest: {
    Discipline: {
      lowCpm: 'Smite and Penance usage between Atonement windows',
      lowUptime: 'maintain Atonement applications and DPS between ramps',
      defensiveCd: 'Pain Suppression, Rapture, and Desperate Prayer',
    },
    'Holy Priest': {
      lowCpm: 'Prayer of Mending on cooldown and Circle of Healing usage',
      lowUptime: 'maintain casting between damage events — Heal/Flash Heal downranking when idle',
      defensiveCd: 'Guardian Spirit, Divine Hymn, and Desperate Prayer',
    },
    Shadow: {
      lowCpm: 'Mind Blast charges and Devouring Plague usage — avoid capping Insanity',
      lowUptime: 'maintain Shadow Word: Pain and Vampiric Touch through movement phases',
      defensiveCd: 'Dispersion, Vampiric Embrace, and Fade',
    },
  },

  'Death Knight': {
    Blood: {
      lowCpm: 'Heart Strike and Death Strike rotation — keep Bone Shield stacks up',
      lowUptime: 'Death Strike timing — bank Runic Power for predictable damage spikes',
      defensiveCd: 'Vampiric Blood, Icebound Fortitude, and Anti-Magic Shell timing',
    },
    'Frost DK': {
      lowCpm: 'Obliterate and Frost Strike usage — avoid capping Runic Power',
      lowUptime:
        "Death's Advance and Wraith Walk for movement — plan Pillar of Frost around mechanics",
      defensiveCd: 'Icebound Fortitude, Anti-Magic Shell, and Death Strike as emergency heal',
    },
    Unholy: {
      lowCpm: 'Festering Strike and Scourge Strike usage — manage Festering Wounds',
      lowUptime: "maintain diseases through movement — Death's Advance for repositioning",
      defensiveCd: 'Icebound Fortitude, Anti-Magic Shell, and Death Strike',
    },
  },

  Shaman: {
    Elemental: {
      lowCpm: 'Lava Burst charges and Earth Shock usage — avoid overcapping Maelstrom',
      lowUptime: 'Flame Shock maintenance and instant Lava Bursts during movement',
      defensiveCd: "Astral Shift and Nature's Guardian",
    },
    Enhancement: {
      lowCpm: 'Stormstrike and Lava Lash usage — keep Maelstrom Weapon stacks flowing',
      lowUptime:
        'Spirit Walk and Feral Lunge to close gaps — use instant Maelstrom spenders while moving',
      defensiveCd: "Astral Shift and Nature's Guardian",
    },
    'Restoration Shaman': {
      lowCpm: 'Riptide on cooldown and Healing Wave/Healing Surge filler',
      lowUptime: 'maintain Riptide HoTs and weave Flame Shock for DPS contribution',
      defensiveCd: 'Spirit Link Totem, Healing Tide Totem, and Astral Shift',
    },
  },

  Mage: {
    Arcane: {
      lowCpm: 'Arcane Blast and Arcane Missiles procs — manage mana during burn/conserve',
      lowUptime: 'Shimmer and Alter Time for repositioning without dropping casts',
      defensiveCd: 'Ice Block, Mirror Image, and Alter Time',
    },
    Fire: {
      lowCpm: 'Fireball filler and Fire Blast charge management during Combustion',
      lowUptime: 'Shimmer to maintain casting during movement — Scorch as mobile filler',
      defensiveCd: 'Ice Block, Mirror Image, and Alter Time',
    },
    'Frost Mage': {
      lowCpm: 'Frostbolt filler and Ice Lance Shatter combo execution',
      lowUptime: 'Shimmer and Ice Floes for movement — maintain Blizzard/Frozen Orb uptime',
      defensiveCd: 'Ice Block, Mirror Image, and Alter Time',
    },
  },

  Warlock: {
    Affliction: {
      lowCpm: 'Agony, Corruption, and Unstable Affliction maintenance on all targets',
      lowUptime: 'maintain DoTs through movement — refresh before repositioning',
      defensiveCd: 'Unending Resolve, Dark Pact, and Healthstone',
    },
    Demonology: {
      lowCpm: "Hand of Gul'dan and Call Dreadstalkers on cooldown — avoid capping Soul Shards",
      lowUptime: 'pre-summon demons before movement — Demonic Circle for instant repositioning',
      defensiveCd: 'Unending Resolve, Dark Pact, and Healthstone',
    },
    Destruction: {
      lowCpm: 'Incinerate filler and Chaos Bolt during Infernal windows',
      lowUptime: 'Demonic Circle and Burning Rush for movement — plan Infernal around mechanics',
      defensiveCd: 'Unending Resolve, Dark Pact, and Healthstone',
    },
  },

  Monk: {
    Brewmaster: {
      lowCpm: 'Keg Smash and Blackout Kick rotation — maintain Shuffle uptime',
      lowUptime:
        'Shuffle uptime is your active mitigation — every dropped GCD is unmitigated damage',
      defensiveCd: 'Fortifying Brew, Zen Meditation, and Celestial Brew timing',
    },
    Windwalker: {
      lowCpm: 'Rising Sun Kick and Fists of Fury on cooldown — avoid repeating abilities (Mastery)',
      lowUptime: "Roll and Chi Torpedo for repositioning — Tiger's Lust for movement phases",
      defensiveCd: 'Touch of Karma, Diffuse Magic, and Fortifying Brew',
    },
    Mistweaver: {
      lowCpm: 'Renewing Mist on cooldown and Rising Sun Kick for Ancient Teachings',
      lowUptime: 'maintain Renewing Mist rolling and weave damage for healing contribution',
      defensiveCd: 'Life Cocoon, Revival/Restoral, and Fortifying Brew',
    },
  },

  Druid: {
    Balance: {
      lowCpm: 'Starsurge usage and Eclipse rotation — avoid overcapping Astral Power',
      lowUptime: 'Starfall and instant casts during movement — pre-dot before repositioning',
      defensiveCd: 'Barkskin, Bear Form for emergencies, and Renewal',
    },
    Feral: {
      lowCpm: 'Ferocious Bite and Rip uptime — avoid energy capping',
      lowUptime: 'maintain Rake and Rip before movement — Dash/Stampeding Roar to return quickly',
      defensiveCd: 'Survival Instincts, Barkskin, and Bear Form',
    },
    Guardian: {
      lowCpm: 'Mangle and Thrash rotation — maintain Ironfur stacks',
      lowUptime: 'Ironfur stack uptime — each dropped stack means significant armor loss',
      defensiveCd: 'Survival Instincts, Barkskin, and Frenzied Regeneration timing',
    },
    'Restoration Druid': {
      lowCpm: 'Rejuvenation blanketing and Wild Growth on cooldown',
      lowUptime:
        'maintain HoTs rolling between damage events — Moonfire/Sunfire for DPS contribution',
      defensiveCd: 'Tranquility, Ironbark on tanks, and Barkskin',
    },
  },

  'Demon Hunter': {
    Havoc: {
      lowCpm: 'Blade Dance and Eye Beam on cooldown — Chaos Strike as filler',
      lowUptime: 'Fel Rush and Vengeful Retreat as gap closers — plan Eye Beam around movement',
      defensiveCd: 'Blur, Netherwalk, and Darkness',
    },
    Vengeance: {
      lowCpm: 'Soul Cleave and Fracture rotation — maintain Demon Spikes uptime',
      lowUptime: 'Demon Spikes uptime is critical — every gap is unmitigated physical damage',
      defensiveCd: 'Fiery Brand, Metamorphosis, and Demon Spikes stacking',
    },
  },

  Evoker: {
    Devastation: {
      lowCpm: 'Fire Breath/Eternity Surge empowerment and Disintegrate filler',
      lowUptime: 'Hover for mobile casting — plan empowered casts around movement phases',
      defensiveCd: 'Obsidian Scales, Renewing Blaze, and Rescue for repositioning',
    },
    Preservation: {
      lowCpm: 'Dream Breath/Spiritbloom empowerment and Living Flame filler',
      lowUptime: 'Hover for mobile casting — maintain Reversion HoTs rolling',
      defensiveCd: 'Obsidian Scales, Renewing Blaze, and Rewind timing',
    },
    Augmentation: {
      lowCpm: 'Eruption and Prescience on cooldown — maintain Ebon Might uptime',
      lowUptime: 'Hover for mobile empowered casts — Ebon Might uptime is your #1 priority',
      defensiveCd: 'Obsidian Scales, Renewing Blaze, and Spatial Paradox',
    },
  },
};

/**
 * Look up coaching context for a class/spec.
 * @param {string} className
 * @param {string} spec
 * @returns {{ lowCpm: string, lowUptime: string, defensiveCd: string } | null}
 */
export function getSpecCoaching(className, spec) {
  return SPEC_COACHING[className]?.[spec] || null;
}
