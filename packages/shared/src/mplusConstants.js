/**
 * M+ dungeon constants for the current season.
 * Update these each season when the dungeon rotation changes.
 *
 * TWW Season 3 — The War Within (Aug 2025 – Mar 2026)
 * Next: Midnight Season 1 (Mar 17, 2026) — update IDs via getMplusDungeons()
 */

/**
 * Short names by dungeon name (canonical, season-independent).
 * Used as fallback when Blizzard dungeon IDs aren't yet populated.
 */
const DUNGEON_SHORT_NAMES_BY_NAME = {
  // TWW Season 3
  'Ara-Kara, City of Echoes': 'AK',
  'Eco-Dome Al\'dani': 'ED',
  'Halls of Atonement': 'HOA',
  'Operation: Floodgate': 'OF',
  'Priory of the Sacred Flame': 'POTS',
  'Tazavesh: So\'leah\'s Gambit': 'SG',
  'Tazavesh: Streets of Wonder': 'SW',
  'The Dawnbreaker': 'DB',
  // Midnight Season 1
  'Magister\'s Terrace': 'MT',
  'Maisara Caverns': 'MC',
  'Nexus-Point Xenas': 'NPX',
  'Windrunner Spire': 'WS',
  'Algeth\'ar Academy': 'AA',
  'Seat of the Triumvirate': 'SOTT',
  'Skyreach': 'SKY',
  'Pit of Saron': 'POS',
  // TWW Season 2 (legacy, kept for history)
  'Cinderbrew Meadery': 'CM',
  'Darkflame Cleft': 'DFC',
  'The Rookery': 'ROOK',
  'The MOTHERLODE!!': 'ML',
  'Theater of Pain': 'TOP',
  'Operation: Mechagon - Workshop': 'WORK',
  // TWW Season 1
  'The Stonevault': 'SV',
  'City of Threads': 'COT',
  'Grim Batol': 'GB',
  'The Necrotic Wake': 'NW',
  'Siege of Boralus': 'SOB',
  'Mists of Tirna Scithe': 'MOTS',
};

/**
 * Par timers by dungeon name (in milliseconds).
 * TWW Season 3 values — update each season.
 */
const DUNGEON_TIMERS_BY_NAME = {
  'Ara-Kara, City of Echoes': 30 * 60 * 1000,
  'Eco-Dome Al\'dani': 31 * 60 * 1000,
  'Halls of Atonement': 31 * 60 * 1000,
  'Operation: Floodgate': 33 * 60 * 1000,
  'Priory of the Sacred Flame': 32.5 * 60 * 1000,
  'Tazavesh: So\'leah\'s Gambit': 30 * 60 * 1000,
  'Tazavesh: Streets of Wonder': 39 * 60 * 1000,
  'The Dawnbreaker': 31 * 60 * 1000,
};

/**
 * Dungeon par timers (in milliseconds) by Blizzard dungeon ID.
 * Populated at runtime via getMplusDungeons() or manually per season.
 * Empty = fallback to DUNGEON_TIMERS_BY_NAME via getDungeonTimer().
 */
export const MPLUS_DUNGEON_TIMERS = {};

/**
 * Short names for dungeons by Blizzard dungeon ID.
 * Populated at runtime or manually per season.
 * Empty = fallback to DUNGEON_SHORT_NAMES_BY_NAME via getDungeonShortName().
 */
export const MPLUS_DUNGEON_SHORT_NAMES = {};

/**
 * Get short name for a dungeon — checks ID map first, then name map.
 * @param {number|null} dungeonId - Blizzard dungeon ID
 * @param {string|null} dungeonName - Dungeon name
 * @returns {string} Short name (e.g. 'AK', 'HOA')
 */
export function getDungeonShortName(dungeonId, dungeonName) {
  if (dungeonId && MPLUS_DUNGEON_SHORT_NAMES[dungeonId]) {
    return MPLUS_DUNGEON_SHORT_NAMES[dungeonId];
  }
  if (dungeonName && DUNGEON_SHORT_NAMES_BY_NAME[dungeonName]) {
    return DUNGEON_SHORT_NAMES_BY_NAME[dungeonName];
  }
  return dungeonName?.substring(0, 4)?.toUpperCase() || '???';
}

/**
 * Get par timer for a dungeon — checks ID map first, then name map.
 * @param {number|null} dungeonId - Blizzard dungeon ID
 * @param {string|null} dungeonName - Dungeon name
 * @returns {number|null} Par time in milliseconds, or null
 */
export function getDungeonTimer(dungeonId, dungeonName) {
  if (dungeonId && MPLUS_DUNGEON_TIMERS[dungeonId]) {
    return MPLUS_DUNGEON_TIMERS[dungeonId];
  }
  if (dungeonName && DUNGEON_TIMERS_BY_NAME[dungeonName]) {
    return DUNGEON_TIMERS_BY_NAME[dungeonName];
  }
  return null;
}

/**
 * Calculate score color from M+ rating using our bracket system.
 *
 * @param {number} score - M+ rating score
 * @param {Array} brackets - Optional custom brackets
 * @returns {string} Hex color string
 */
export function getScoreColor(score, brackets) {
  const b = brackets || [
    { min: 0, color: '#888888' },
    { min: 751, color: '#1eff00' },
    { min: 1501, color: '#0070dd' },
    { min: 2001, color: '#a335ee' },
    { min: 2501, color: '#ff8000' },
    { min: 3001, color: '#e268a8' },
  ];

  let color = b[0].color;
  for (const bracket of b) {
    if (score >= bracket.min) color = bracket.color;
  }
  return color;
}

/**
 * Calculate keystone upgrade count from timing.
 * - Within time: 1 upgrade (timed)
 * - 20%+ faster: 2 upgrades
 * - 40%+ faster: 3 upgrades
 *
 * @param {number} duration - Run duration in milliseconds
 * @param {number} parTime - Dungeon par time in milliseconds
 * @returns {number} 0-3 upgrades
 */
export function calculateUpgrades(duration, parTime) {
  if (!parTime || duration > parTime) return 0;
  const ratio = duration / parTime;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 2;
  return 1;
}
