/**
 * M+ dungeon constants for the current season.
 * Update these each season when the dungeon rotation changes.
 *
 * TWW Season 2 — The War Within
 */

/** Dungeon par timers (in milliseconds) by Blizzard dungeon ID. */
export const MPLUS_DUNGEON_TIMERS = {
  // These must be updated each season from Blizzard's dungeon data.
  // Par times come from the in-game M+ timer.
  // Run getMplusDungeons() to get current dungeon IDs.
};

/** Short names for dungeons by Blizzard dungeon ID. */
export const MPLUS_DUNGEON_SHORT_NAMES = {
  // These must be updated each season.
  // Example: 12345: 'AK' (for Ara-Kara)
};

/**
 * Calculate score color from M+ rating using our bracket system.
 * Falls back to MPLUS_BRACKETS from constants.js.
 *
 * @param {number} score - M+ rating score
 * @param {Array} brackets - Optional custom brackets
 * @returns {string} Hex color string
 */
export function getScoreColor(score, brackets) {
  // Use provided brackets or default
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
 * In TWW, upgrades are based on how much faster than par time:
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
