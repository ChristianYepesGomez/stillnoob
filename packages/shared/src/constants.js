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
  'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest',
  'Shaman', 'Mage', 'Warlock', 'Druid', 'Death Knight',
  'Monk', 'Demon Hunter', 'Evoker',
];

/** Raid roles */
export const RAID_ROLES = ['Tank', 'Healer', 'DPS'];

/** Regions */
export const REGIONS = ['us', 'eu', 'kr', 'tw'];

/** User tiers */
export const USER_TIERS = ['free', 'premium', 'admin'];

/** Recommendation categories */
export const REC_CATEGORIES = ['survivability', 'consumables', 'performance', 'utility'];

/** Recommendation severities */
export const REC_SEVERITIES = ['positive', 'info', 'warning', 'critical'];

/** Severity styles for frontend */
export const SEVERITY_STYLES = {
  positive: { bg: 'bg-green-900/20', border: 'border-green-500/30', icon: 'fa-check-circle', color: 'text-green-400' },
  info: { bg: 'bg-blue-900/20', border: 'border-blue-500/30', icon: 'fa-info-circle', color: 'text-blue-400' },
  warning: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', icon: 'fa-exclamation-triangle', color: 'text-yellow-400' },
  critical: { bg: 'bg-red-900/20', border: 'border-red-500/30', icon: 'fa-times-circle', color: 'text-red-400' },
};

/** Category styles for frontend */
export const CATEGORY_STYLES = {
  survivability: { icon: 'fa-shield-alt', color: 'text-red-400' },
  consumables: { icon: 'fa-flask', color: 'text-green-400' },
  performance: { icon: 'fa-chart-line', color: 'text-blue-400' },
  utility: { icon: 'fa-wrench', color: 'text-purple-400' },
};

/** Consumable detection regex patterns */
export const CONSUMABLE_PATTERNS = {
  healthPotion: /healing potion|potion of .*(heal|life)|algari healing/i,
  healthstone: /healthstone/i,
  combatPotion: /tempered potion|potion of unwavering focus|frontline potion|elemental potion|potion of the .*(war|twilight)/i,
};

/** Buff detection regex patterns */
export const BUFF_PATTERNS = {
  flask: /flask|phial/i,
  food: /well fed|sated|nourished|satisfecho|alimentado/i,
  augmentRune: /augment rune/i,
};

/** Consumable score weights */
export const CONSUMABLE_WEIGHTS = {
  healthPotion: 0.20,
  healthstone: 0.15,
  combatPotion: 0.25,
  flask: 0.25,
  food: 0.10,
  augmentRune: 0.05,
};
