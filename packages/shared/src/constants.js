/** WoW class colors (matching Blizzard official colors) */
export const CLASS_COLORS = {
  Warrior: '#C79C6E',
  Paladin: '#F58CBA',
  Hunter: '#ABD473',
  Rogue: '#FFF569',
  Priest: '#FFFFFF',
  Shaman: '#0070DE',
  Mage: '#3FC7EB',
  Warlock: '#8788EE',
  Druid: '#FF7D0A',
  'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B',
  Monk: '#00FF96',
  'Demon Hunter': '#A330C9',
  DemonHunter: '#A330C9',
  Evoker: '#33937F',
};

/** Difficulty colors */
export const DIFFICULTY_COLORS = {
  Mythic: '#ff8000',
  Heroic: '#a335ee',
  Normal: '#1eff00',
  LFR: '#0070dd',
};

/** WoW classes list */
export const WOW_CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
  'Death Knight',
  'Monk',
  'Demon Hunter',
  'Evoker',
];

/** Raid roles */
export const RAID_ROLES = ['Tank', 'Healer', 'DPS'];

/** Regions */
export const REGIONS = ['us', 'eu', 'kr', 'tw'];

/** User tiers */
export const USER_TIERS = ['free', 'premium', 'admin'];

/** Recommendation categories */
export const REC_CATEGORIES = [
  'survivability',
  'consumables',
  'performance',
  'utility',
  'mythicPlus',
  'gear',
];

/** Recommendation severities */
export const REC_SEVERITIES = ['positive', 'info', 'warning', 'critical'];

/** Severity styles for frontend */
export const SEVERITY_STYLES = {
  positive: {
    bg: 'bg-green-900/20',
    border: 'border-green-500/30',
    icon: 'fa-check-circle',
    color: 'text-green-400',
  },
  info: {
    bg: 'bg-blue-900/20',
    border: 'border-blue-500/30',
    icon: 'fa-info-circle',
    color: 'text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-500/30',
    icon: 'fa-exclamation-triangle',
    color: 'text-yellow-400',
  },
  critical: {
    bg: 'bg-red-900/20',
    border: 'border-red-500/30',
    icon: 'fa-times-circle',
    color: 'text-red-400',
  },
};

/** Category styles for frontend */
export const CATEGORY_STYLES = {
  survivability: { icon: 'fa-shield-alt', color: 'text-red-400' },
  consumables: { icon: 'fa-flask', color: 'text-green-400' },
  performance: { icon: 'fa-chart-line', color: 'text-blue-400' },
  utility: { icon: 'fa-wrench', color: 'text-purple-400' },
  mythicPlus: { icon: 'fa-key', color: 'text-sunwell-amber' },
  gear: { icon: 'fa-shield-halved', color: 'text-amber-400' },
};

/** Abilities to exclude from CPM count (auto-attacks) */
export const AUTO_ATTACK_PATTERNS = /^(Melee|Auto Shot|Shoot)$/i;

/** Consumable detection regex patterns */
export const CONSUMABLE_PATTERNS = {
  healthstone: /healthstone/i,
  combatPotion:
    /tempered potion|potion of unwavering focus|frontline potion|elemental potion|potion of the .*(war|twilight)/i,
};

/** Buff detection regex patterns */
export const BUFF_PATTERNS = {
  flask: /flask|phial/i,
  food: /well fed|sated|nourished|satisfecho|alimentado/i,
  augmentRune: /augment rune/i,
};

/** Consumable score weights (must sum to 1.0) */
export const CONSUMABLE_WEIGHTS = {
  healthstone: 0.2,
  combatPotion: 0.3,
  flask: 0.3,
  food: 0.13,
  augmentRune: 0.07,
};

/** StillNoob Score component weights */
export const SCORE_WEIGHTS = {
  performance: 0.35,
  survival: 0.25,
  preparation: 0.2,
  utility: 0.1,
  consistency: 0.1,
};

/** StillNoob Score tier definitions */
export const SCORE_TIERS = [
  { min: 0, max: 20, key: 'noob', label: 'Noob', color: '#888888', emoji: '🩶' },
  { min: 21, max: 40, key: 'casual', label: 'Casual', color: '#00ff88', emoji: '💚' },
  { min: 41, max: 60, key: 'decent', label: 'Decent', color: '#0096ff', emoji: '💙' },
  { min: 61, max: 75, key: 'skilled', label: 'Skilled', color: '#9d5cff', emoji: '💜' },
  { min: 76, max: 85, key: 'pro', label: 'Pro', color: '#ff9f1c', emoji: '🧡' },
  { min: 86, max: 95, key: 'elite', label: 'Elite', color: '#ff3b5c', emoji: '❤️‍🔥' },
  { min: 96, max: 100, key: 'legendary', label: 'Legendary', color: '#f6c843', emoji: '👑' },
];

/** WarcraftLogs parse percentile color tiers (official) */
export const WCL_PARSE_COLORS = {
  grey: { min: 0, max: 24, color: '#666666', label: 'Grey' },
  green: { min: 25, max: 49, color: '#1eff00', label: 'Green' },
  blue: { min: 50, max: 74, color: '#0070dd', label: 'Blue' },
  purple: { min: 75, max: 94, color: '#a335ee', label: 'Purple' },
  orange: { min: 95, max: 98, color: '#ff8000', label: 'Orange' },
  pink: { min: 99, max: 99, color: '#e268a8', label: 'Pink' },
  gold: { min: 100, max: 100, color: '#e5cc80', label: 'Gold' },
};

/** Player skill levels for adaptive coaching */
export const PLAYER_LEVELS = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

/** How many primary tips to show per player level (rest go to "show more") */
export const TIP_LIMITS = {
  beginner: 3,
  intermediate: 5,
  advanced: 3,
};

/** Player level detection weights */
export const LEVEL_DETECTION = {
  dpsVsMedian: { weight: 25, thresholds: [85, 100, 115] },
  deathRate: { weight: 18, thresholds: [0.3, 0.15, 0.05] },
  consumables: { weight: 12, thresholds: [50, 80] },
  mythicPlus: { weight: 10, thresholds: [1200, 2000, 2800] },
  difficulty: { weight: 8 },
  consistency: { weight: 7, threshold: 30 },
  activeTime: { weight: 10, thresholds: [75, 85, 92] },
  parsePercentile: { weight: 10, thresholds: [25, 50, 75] },
  advancedThreshold: 70,
  intermediateThreshold: 35,
};

/** M+ Score brackets for coaching */
export const MPLUS_BRACKETS = [
  { min: 0, max: 750, key: 'starter', label: 'Starter', color: '#888888' },
  { min: 751, max: 1500, key: 'apprentice', label: 'Apprentice', color: '#1eff00' },
  { min: 1501, max: 2000, key: 'challenger', label: 'Challenger', color: '#0070dd' },
  { min: 2001, max: 2500, key: 'keystone_hero', label: 'Keystone Hero', color: '#a335ee' },
  { min: 2501, max: 3000, key: 'keystone_master', label: 'Keystone Master', color: '#ff8000' },
  { min: 3001, max: 9999, key: 'keystone_legend', label: 'Keystone Legend', color: '#e268a8' },
];
