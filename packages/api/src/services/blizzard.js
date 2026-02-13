import axios from 'axios';

// Blizzard API configuration
const getApiUrl = (region) => `https://${region}.api.blizzard.com`;
const getOAuthUrl = (region) => `https://${region}.battle.net/oauth`;

let appToken = null;
let tokenExpiry = 0;

/** Blizzard class ID → class name */
const BLIZZARD_CLASS_MAP = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
  5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
  9: 'Warlock', 10: 'Monk', 11: 'Druid', 12: 'Demon Hunter',
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
    }
  );

  appToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
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
    }
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

  const response = await axios.get(
    `${getApiUrl(region)}/profile/user/wow`,
    {
      params: { namespace: `profile-${region}` },
      headers: { Authorization: `Bearer ${userToken}` },
    }
  );

  const locStr = (val) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.en_US || val.en_GB || val.es_ES || Object.values(val)[0];
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
        className: BLIZZARD_CLASS_MAP[char.playable_class?.id] || `Class ${char.playable_class?.id}`,
        classId: char.playable_class?.id,
        level: char.level || 0,
        summarySpecId: char.active_spec?.id,
      });
    }
  }

  // Filter to max-level only
  const maxLevel = basicChars.reduce((max, c) => Math.max(max, c.level), 0);
  const eligible = basicChars.filter(c => c.name && c.level >= maxLevel && maxLevel > 0);

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
        }
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
    await new Promise(resolve => setTimeout(resolve, 100));
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
      }
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
      }
    );

    const assets = response.data.assets || [];
    return {
      avatar: assets.find(a => a.key === 'avatar')?.value,
      inset: assets.find(a => a.key === 'inset')?.value,
      main: assets.find(a => a.key === 'main')?.value,
      mainRaw: assets.find(a => a.key === 'main-raw')?.value,
    };
  } catch {
    return null;
  }
}
