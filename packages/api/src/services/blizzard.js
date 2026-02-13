import axios from 'axios';

// Blizzard API configuration
const getApiUrl = (region) => `https://${region}.api.blizzard.com`;
const getOAuthUrl = (region) => `https://${region}.battle.net/oauth`;

let appToken = null;
let tokenExpiry = 0;

/** Blizzard class ID → class name */
const BLIZZARD_CLASS_MAP = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  6: 'Death Knight',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  10: 'Monk',
  11: 'Druid',
  12: 'Demon Hunter',
  13: 'Evoker',
};

/** Blizzard spec ID → spec name + raid role */
const BLIZZARD_SPEC_MAP = {
  // Warrior
  71: { spec: 'Arms', role: 'DPS' },
  72: { spec: 'Fury', role: 'DPS' },
  73: { spec: 'Protection Warrior', role: 'Tank' },
  // Paladin
  65: { spec: 'Holy Paladin', role: 'Healer' },
  66: { spec: 'Protection Paladin', role: 'Tank' },
  70: { spec: 'Retribution', role: 'DPS' },
  // Hunter
  253: { spec: 'Beast Mastery', role: 'DPS' },
  254: { spec: 'Marksmanship', role: 'DPS' },
  255: { spec: 'Survival', role: 'DPS' },
  // Rogue
  259: { spec: 'Assassination', role: 'DPS' },
  260: { spec: 'Outlaw', role: 'DPS' },
  261: { spec: 'Subtlety', role: 'DPS' },
  // Priest
  256: { spec: 'Discipline', role: 'Healer' },
  257: { spec: 'Holy Priest', role: 'Healer' },
  258: { spec: 'Shadow', role: 'DPS' },
  // Death Knight
  250: { spec: 'Blood', role: 'Tank' },
  251: { spec: 'Frost DK', role: 'DPS' },
  252: { spec: 'Unholy', role: 'DPS' },
  // Shaman
  262: { spec: 'Elemental', role: 'DPS' },
  263: { spec: 'Enhancement', role: 'DPS' },
  264: { spec: 'Restoration Shaman', role: 'Healer' },
  // Mage
  62: { spec: 'Arcane', role: 'DPS' },
  63: { spec: 'Fire', role: 'DPS' },
  64: { spec: 'Frost Mage', role: 'DPS' },
  // Warlock
  265: { spec: 'Affliction', role: 'DPS' },
  266: { spec: 'Demonology', role: 'DPS' },
  267: { spec: 'Destruction', role: 'DPS' },
  // Monk
  268: { spec: 'Brewmaster', role: 'Tank' },
  269: { spec: 'Windwalker', role: 'DPS' },
  270: { spec: 'Mistweaver', role: 'Healer' },
  // Druid
  102: { spec: 'Balance', role: 'DPS' },
  103: { spec: 'Feral', role: 'DPS' },
  104: { spec: 'Guardian', role: 'Tank' },
  105: { spec: 'Restoration Druid', role: 'Healer' },
  // Demon Hunter
  577: { spec: 'Havoc', role: 'DPS' },
  581: { spec: 'Vengeance', role: 'Tank' },
  // Evoker
  1467: { spec: 'Devastation', role: 'DPS' },
  1468: { spec: 'Preservation', role: 'Healer' },
  1473: { spec: 'Augmentation', role: 'DPS' },
};

/**
 * Get app-level access token (client credentials flow).
 * Used for public data queries.
 */
export async function getAccessToken() {
  if (appToken && Date.now() < tokenExpiry) {
    return appToken;
  }

  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
  const region = process.env.BLIZZARD_REGION || 'eu';

  if (!clientId || !clientSecret) {
    throw new Error('Blizzard credentials not configured');
  }

  const response = await axios.post(
    `${getOAuthUrl(region)}/token`,
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  appToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000;
  return appToken;
}

/**
 * Build Blizzard OAuth authorize URL for character linking.
 * Redirects user to Blizzard login page.
 */
export function getAuthorizeUrl(state) {
  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const region = process.env.BLIZZARD_REGION || 'eu';
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/auth/blizzard/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'wow.profile',
    state,
  });

  return `${getOAuthUrl(region)}/authorize?${params}`;
}

/**
 * Exchange authorization code for user access token.
 */
export async function exchangeCode(code) {
  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
  const region = process.env.BLIZZARD_REGION || 'eu';
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/auth/blizzard/callback`;

  const response = await axios.post(
    `${getOAuthUrl(region)}/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in,
  };
}

/**
 * Get user's WoW characters using their OAuth token.
 * Returns max-level characters with accurate spec/role info.
 */
export async function getUserCharacters(userToken) {
  const region = process.env.BLIZZARD_REGION || 'eu';

  const response = await axios.get(`${getApiUrl(region)}/profile/user/wow`, {
    params: { namespace: `profile-${region}` },
    headers: { Authorization: `Bearer ${userToken}` },
  });

  const locStr = (val) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object')
      return val.en_US || val.en_GB || val.es_ES || Object.values(val)[0];
    return undefined;
  };

  // Collect basic character info
  const basicChars = [];
  for (const account of response.data.wow_accounts || []) {
    for (const char of account.characters || []) {
      basicChars.push({
        name: locStr(char.name) || char.name,
        realm: locStr(char.realm?.name) || char.realm?.slug || 'Unknown',
        realmSlug: char.realm?.slug || '',
        className:
          BLIZZARD_CLASS_MAP[char.playable_class?.id] || `Class ${char.playable_class?.id}`,
        classId: char.playable_class?.id,
        level: char.level || 0,
        summarySpecId: char.active_spec?.id,
      });
    }
  }

  // Filter to max-level only
  const maxLevel = basicChars.reduce((max, c) => Math.max(max, c.level), 0);
  const eligible = basicChars.filter((c) => c.name && c.level >= maxLevel && maxLevel > 0);

  // Fetch detailed profile for accurate spec
  const characters = [];
  for (const char of eligible) {
    let spec = null;
    let raidRole = null;

    try {
      const profile = await axios.get(
        `${getApiUrl(region)}/profile/wow/character/${encodeURIComponent(char.realmSlug)}/${encodeURIComponent(char.name.normalize('NFC').toLowerCase())}`,
        {
          params: { namespace: `profile-${region}` },
          headers: { Authorization: `Bearer ${userToken}` },
        },
      );

      if (profile.data?.active_spec?.id) {
        const specInfo = BLIZZARD_SPEC_MAP[profile.data.active_spec.id];
        spec = specInfo?.spec || null;
        raidRole = specInfo?.role || null;
      }
    } catch {
      // Fallback to summary spec
      if (char.summarySpecId) {
        const specInfo = BLIZZARD_SPEC_MAP[char.summarySpecId];
        spec = specInfo?.spec || null;
        raidRole = specInfo?.role || null;
      }
    }

    characters.push({
      name: char.name,
      realm: char.realm,
      realmSlug: char.realmSlug,
      region,
      className: char.className,
      classId: char.classId,
      spec,
      raidRole,
      level: char.level,
    });

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return characters.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get public character profile (uses app token, no user auth needed).
 */
export async function getCharacterProfile(name, realmSlug, region) {
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.normalize('NFC').toLowerCase())}`,
      {
        params: { namespace: `profile-${region}`, locale: 'en_US' },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return {
      name: response.data.name,
      realm: response.data.realm?.name,
      realmSlug: response.data.realm?.slug,
      level: response.data.level,
      className: BLIZZARD_CLASS_MAP[response.data.character_class?.id],
      spec: BLIZZARD_SPEC_MAP[response.data.active_spec?.id]?.spec,
      raidRole: BLIZZARD_SPEC_MAP[response.data.active_spec?.id]?.role,
      averageItemLevel: response.data.average_item_level,
      equippedItemLevel: response.data.equipped_item_level,
    };
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Get character media (avatar, render images).
 */
export async function getCharacterMedia(name, realmSlug, region) {
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.normalize('NFC').toLowerCase())}/character-media`,
      {
        params: { namespace: `profile-${region}` },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const assets = response.data.assets || [];
    return {
      avatar: assets.find((a) => a.key === 'avatar')?.value,
      inset: assets.find((a) => a.key === 'inset')?.value,
      main: assets.find((a) => a.key === 'main')?.value,
      mainRaw: assets.find((a) => a.key === 'main-raw')?.value,
    };
  } catch {
    return null;
  }
}

// --- Equipment API ---

// In-memory cache: key → { data, timestamp }
const equipmentCache = new Map();
const EQUIPMENT_CACHE_TTL = 60 * 60 * 1000; // 60 minutes

function getEquipmentCacheKey(region, realmSlug, name) {
  return `equip:${region}:${realmSlug}:${name}`.normalize('NFC').toLowerCase();
}

function getEquipmentCached(key) {
  const entry = equipmentCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > EQUIPMENT_CACHE_TTL) {
    equipmentCache.delete(key);
    return null;
  }
  return entry.data;
}

function setEquipmentCache(key, data) {
  equipmentCache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (equipmentCache.size > 500) {
    const oldest = [...equipmentCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 100; i++) equipmentCache.delete(oldest[i][0]);
  }
}

/** Blizzard slot type → normalized slot name */
const SLOT_TYPE_MAP = {
  HEAD: 'head',
  NECK: 'neck',
  SHOULDER: 'shoulder',
  BACK: 'back',
  CHEST: 'chest',
  WRIST: 'wrist',
  HANDS: 'hands',
  WAIST: 'waist',
  LEGS: 'legs',
  FEET: 'feet',
  FINGER_1: 'finger1',
  FINGER_2: 'finger2',
  TRINKET_1: 'trinket1',
  TRINKET_2: 'trinket2',
  MAIN_HAND: 'mainHand',
  OFF_HAND: 'offHand',
};

/** Blizzard stat type → normalized stat key */
const STAT_TYPE_MAP = {
  CRIT_RATING: 'crit',
  HASTE_RATING: 'haste',
  MASTERY_RATING: 'mastery',
  VERSATILITY: 'versatility',
};

/** Slots that should have an enchant */
const ENCHANTABLE_SLOTS = new Set([
  'head',
  'back',
  'chest',
  'wrist',
  'legs',
  'feet',
  'finger1',
  'finger2',
  'mainHand',
]);

/** Cosmetic slots excluded from ilvl calculations */
const COSMETIC_SLOTS = new Set(['shirt', 'tabard']);

/**
 * Fetch character equipment from Blizzard API.
 * Uses app-level token (no user auth needed).
 * Returns null on 404.
 */
export async function getCharacterEquipment(name, realmSlug, region) {
  const cacheKey = getEquipmentCacheKey(region, realmSlug, name);
  const cached = getEquipmentCached(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.normalize('NFC').toLowerCase())}/equipment`,
      {
        params: { namespace: `profile-${region}`, locale: 'en_US' },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    setEquipmentCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Transform raw Blizzard equipment API response into a structured format
 * with item details, aggregated stats, enchant audit, and gem audit.
 */
export function transformEquipment(rawEquipment) {
  const equippedItems = rawEquipment?.equipped_items || [];

  // --- Parse individual items ---
  const items = equippedItems.map((item) => {
    const slotType = item.slot?.type || '';
    const slot = SLOT_TYPE_MAP[slotType] || slotType.toLowerCase();

    // Parse stats
    const stats = { crit: 0, haste: 0, mastery: 0, versatility: 0 };
    for (const stat of item.stats || []) {
      const key = STAT_TYPE_MAP[stat.type?.type];
      if (key) stats[key] = stat.value;
    }

    // Parse enchant (take first enchantment display string, strip WoW markup tags)
    const rawEnchant = item.enchantments?.[0]?.display_string;
    const enchant = rawEnchant
      ? rawEnchant
          .replace(/^Enchanted:\s*/i, '')
          .replace(/\s*\|[aAcC][^|]*\|[ra]/g, '')
          .trim()
      : null;

    // Parse gems and empty sockets
    const gems = [];
    let emptySockets = 0;
    for (const socket of item.sockets || []) {
      if (socket.item?.name) {
        gems.push(socket.item.name);
      } else {
        emptySockets++;
      }
    }

    return {
      slot,
      name: item.name || 'Unknown',
      itemLevel: item.level?.value || 0,
      stats,
      enchant,
      gems,
      emptySockets,
    };
  });

  // --- Aggregated stats (exclude cosmetic slots from ilvl) ---
  let totalItemLevel = 0;
  let ilvlCount = 0;
  const totalStats = { crit: 0, haste: 0, mastery: 0, versatility: 0 };

  for (const item of items) {
    if (!COSMETIC_SLOTS.has(item.slot)) {
      totalItemLevel += item.itemLevel;
      ilvlCount++;
    }
    totalStats.crit += item.stats.crit;
    totalStats.haste += item.stats.haste;
    totalStats.mastery += item.stats.mastery;
    totalStats.versatility += item.stats.versatility;
  }

  const averageItemLevel = ilvlCount > 0 ? Math.round((totalItemLevel / ilvlCount) * 10) / 10 : 0;

  const totalSecondary =
    totalStats.crit + totalStats.haste + totalStats.mastery + totalStats.versatility;
  const statDistribution = {
    crit: totalSecondary > 0 ? Math.round((totalStats.crit / totalSecondary) * 1000) / 10 : 0,
    haste: totalSecondary > 0 ? Math.round((totalStats.haste / totalSecondary) * 1000) / 10 : 0,
    mastery: totalSecondary > 0 ? Math.round((totalStats.mastery / totalSecondary) * 1000) / 10 : 0,
    versatility:
      totalSecondary > 0 ? Math.round((totalStats.versatility / totalSecondary) * 1000) / 10 : 0,
  };

  // --- Enchant audit ---
  const enchantMissing = [];
  const enchantPresent = [];
  const itemSlotSet = new Set(items.map((i) => i.slot));

  for (const slot of ENCHANTABLE_SLOTS) {
    // Only audit slots the character actually has equipped
    if (!itemSlotSet.has(slot)) continue;
    const item = items.find((i) => i.slot === slot);
    if (item?.enchant) {
      enchantPresent.push(slot);
    } else {
      enchantMissing.push(slot);
    }
  }

  // --- Gem audit ---
  let totalSockets = 0;
  let filledSockets = 0;
  let emptySockTotal = 0;
  const emptySlots = [];

  for (const item of items) {
    const socketCount = item.gems.length + item.emptySockets;
    if (socketCount > 0) {
      totalSockets += socketCount;
      filledSockets += item.gems.length;
      emptySockTotal += item.emptySockets;
      if (item.emptySockets > 0) {
        emptySlots.push(item.slot);
      }
    }
  }

  return {
    items,
    aggregated: {
      averageItemLevel,
      totalStats,
      statDistribution,
    },
    enchantAudit: {
      missing: enchantMissing,
      present: enchantPresent,
      total: ENCHANTABLE_SLOTS.size,
      enchanted: enchantPresent.length,
    },
    gemAudit: {
      totalSockets,
      filled: filledSockets,
      empty: emptySockTotal,
      emptySlots,
    },
  };
}

// --- Realm List API ---

const realmCache = new Map();
const REALM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch realm list from Blizzard API for a given region.
 * Returns array of { id, name, slug } sorted by name.
 * Cached in-memory for 24 hours.
 */
export async function getRealmList(region) {
  const normalizedRegion = region.toLowerCase();
  const cached = realmCache.get(normalizedRegion);
  if (cached && Date.now() - cached.timestamp < REALM_CACHE_TTL) {
    return cached.data;
  }

  const token = await getAccessToken();

  const response = await axios.get(`${getApiUrl(normalizedRegion)}/data/wow/realm/index`, {
    params: { namespace: `dynamic-${normalizedRegion}`, locale: 'en_US' },
    headers: { Authorization: `Bearer ${token}` },
  });

  const realms = (response.data.realms || [])
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  realmCache.set(normalizedRegion, { data: realms, timestamp: Date.now() });
  return realms;
}
