import axios from 'axios';

// Warcraft Logs API Configuration
const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth access token from Warcraft Logs (client credentials flow)
 */
async function getAccessToken() {
  const clientId = process.env.WCL_CLIENT_ID;
  const clientSecret = process.env.WCL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('WCL credentials not configured. Set WCL_CLIENT_ID and WCL_CLIENT_SECRET in .env');
  }

  // Return cached token if still valid (5-min buffer)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  const response = await axios.post(
    WCL_TOKEN_URL,
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  return cachedToken;
}

/**
 * Execute GraphQL query against Warcraft Logs API
 */
async function executeGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  const response = await axios.post(
    WCL_API_URL,
    { query, variables },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (response.data.errors) {
    throw new Error(`WCL GraphQL: ${response.data.errors[0].message}`);
  }

  return response.data.data;
}

/**
 * Get report data including participants and fights
 */
export async function getReportData(reportCode) {
  const query = `
    query GetReportData($reportCode: String!) {
      reportData {
        report(code: $reportCode) {
          code
          title
          startTime
          endTime
          region { name }
          guild { name }
          zone { name }
          fights(killType: Encounters) {
            id
            encounterID
            name
            kill
            difficulty
            startTime
            endTime
          }
          masterData(translate: true) {
            actors(type: "Player") {
              id
              name
              server
              subType
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(query, { reportCode });
  const report = data.reportData?.report;

  if (!report) return null;

  return {
    code: report.code,
    title: report.title,
    startTime: report.startTime,
    endTime: report.endTime,
    region: report.region?.name,
    guild: report.guild,
    zone: report.zone,
    fights: report.fights || [],
    participants: (report.masterData?.actors || []).map(a => ({
      name: a.name,
      server: a.server || 'Unknown',
      class: a.subType,
    })),
  };
}

/**
 * Get comprehensive fight statistics (damage, healing, damageTaken, deaths)
 */
export async function getFightStats(reportCode, fightIds) {
  const query = `
    query GetFightStats($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          damage: table(dataType: DamageDone, fightIDs: $fightIDs, hostilityType: Friendlies)
          healing: table(dataType: Healing, fightIDs: $fightIDs, hostilityType: Friendlies)
          damageTaken: table(dataType: DamageTaken, fightIDs: $fightIDs, hostilityType: Friendlies)
          deaths: table(dataType: Deaths, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const report = data.reportData?.report;
    if (!report) return { damage: [], healing: [], damageTaken: [], deaths: [] };

    const parseTable = (table) => {
      if (!table?.data?.entries) return [];
      return table.data.entries;
    };

    return {
      damage: parseTable(report.damage).map(e => ({ name: e.name, total: e.total || 0, activeTime: e.activeTime || 0 })),
      healing: parseTable(report.healing).map(e => ({ name: e.name, total: e.total || 0 })),
      damageTaken: parseTable(report.damageTaken).map(e => ({ name: e.name, total: e.total || 0 })),
      deaths: parseTable(report.deaths).map(e => ({ name: e.name, total: e.total || 0 })),
    };
  } catch (error) {
    console.error('Error fetching fight stats:', error.message);
    return { damage: [], healing: [], damageTaken: [], deaths: [] };
  }
}

/**
 * Get extended fight stats: casts, buffs, interrupts, dispels
 * Used for consumable/buff detection and utility tracking
 */
export async function getExtendedFightStats(reportCode, fightIds) {
  const query = `
    query GetExtendedFightStats($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          casts: table(dataType: Casts, fightIDs: $fightIDs, hostilityType: Friendlies)
          buffs: table(dataType: Buffs, fightIDs: $fightIDs, hostilityType: Friendlies)
          interrupts: table(dataType: Interrupts, fightIDs: $fightIDs, hostilityType: Friendlies)
          dispels: table(dataType: Dispels, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const report = data.reportData?.report;
    if (!report) return { casts: [], buffs: [], interrupts: [], dispels: [] };

    const parseTable = (table) => table?.data?.entries || [];

    return {
      casts: parseTable(report.casts),
      buffs: parseTable(report.buffs),
      interrupts: parseTable(report.interrupts),
      dispels: parseTable(report.dispels),
    };
  } catch (error) {
    console.error('Error fetching extended fight stats:', error.message);
    return { casts: [], buffs: [], interrupts: [], dispels: [] };
  }
}

/**
 * Batch fetch fight stats for multiple fights in a single GraphQL request.
 * Uses aliases to get per-fight data: 2 API calls instead of 2*N.
 * Returns Map<fightId, { damage, healing, damageTaken, deaths }>
 */
export async function getBatchFightStats(reportCode, fightIds) {
  if (fightIds.length === 0) return new Map();

  const fightQueries = fightIds.map(id => `
    fight_${id}_damage: table(dataType: DamageDone, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_healing: table(dataType: Healing, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_damageTaken: table(dataType: DamageTaken, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_deaths: table(dataType: Deaths, fightIDs: [${id}], hostilityType: Friendlies)
  `).join('\n');

  const query = `
    query GetBatchFightStats($reportCode: String!) {
      reportData {
        report(code: $reportCode) {
          ${fightQueries}
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode });
    const report = data.reportData?.report;
    if (!report) return new Map();

    const parseTable = (table) => {
      if (!table?.data?.entries) return [];
      return table.data.entries;
    };

    const results = new Map();
    for (const id of fightIds) {
      results.set(id, {
        damage: parseTable(report[`fight_${id}_damage`]).map(e => ({ name: e.name, total: e.total || 0, activeTime: e.activeTime || 0 })),
        healing: parseTable(report[`fight_${id}_healing`]).map(e => ({ name: e.name, total: e.total || 0 })),
        damageTaken: parseTable(report[`fight_${id}_damageTaken`]).map(e => ({ name: e.name, total: e.total || 0 })),
        deaths: parseTable(report[`fight_${id}_deaths`]).map(e => ({ name: e.name, total: e.total || 0 })),
      });
    }
    return results;
  } catch (error) {
    console.error('Error fetching batch fight stats:', error.message);
    return new Map();
  }
}

/**
 * Batch fetch extended fight stats for multiple fights in a single GraphQL request.
 * Returns Map<fightId, { casts, buffs, interrupts, dispels }>
 */
export async function getBatchExtendedFightStats(reportCode, fightIds) {
  if (fightIds.length === 0) return new Map();

  const fightQueries = fightIds.map(id => `
    fight_${id}_casts: table(dataType: Casts, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_buffs: table(dataType: Buffs, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_interrupts: table(dataType: Interrupts, fightIDs: [${id}], hostilityType: Friendlies)
    fight_${id}_dispels: table(dataType: Dispels, fightIDs: [${id}], hostilityType: Friendlies)
  `).join('\n');

  const query = `
    query GetBatchExtendedFightStats($reportCode: String!) {
      reportData {
        report(code: $reportCode) {
          ${fightQueries}
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode });
    const report = data.reportData?.report;
    if (!report) return new Map();

    const parseTable = (table) => table?.data?.entries || [];

    const results = new Map();
    for (const id of fightIds) {
      results.set(id, {
        casts: parseTable(report[`fight_${id}_casts`]),
        buffs: parseTable(report[`fight_${id}_buffs`]),
        interrupts: parseTable(report[`fight_${id}_interrupts`]),
        dispels: parseTable(report[`fight_${id}_dispels`]),
      });
    }
    return results;
  } catch (error) {
    console.error('Error fetching batch extended fight stats:', error.message);
    return new Map();
  }
}

// ============================================
// WCL User OAuth (for private logs)
// ============================================

const WCL_AUTHORIZE_URL = 'https://www.warcraftlogs.com/oauth/authorize';

/**
 * Build WCL OAuth authorize URL for user-level access.
 * This grants access to the user's private reports.
 */
export function getWclAuthorizeUrl(state) {
  const clientId = process.env.WCL_CLIENT_ID;
  const redirectUri = `${process.env.API_URL}/api/v1/auth/wcl/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  return `${WCL_AUTHORIZE_URL}?${params}`;
}

/**
 * Exchange WCL authorization code for user tokens.
 */
export async function exchangeWclCode(code) {
  const response = await axios.post(
    WCL_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.API_URL}/api/v1/auth/wcl/callback`,
    }).toString(),
    {
      auth: { username: process.env.WCL_CLIENT_ID, password: process.env.WCL_CLIENT_SECRET },
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
 * Execute GraphQL query with a user token (for private reports).
 */
async function executeUserGraphQL(userToken, query, variables = {}) {
  // User tokens hit the user endpoint, not the client endpoint
  const WCL_USER_API_URL = 'https://www.warcraftlogs.com/api/v2/user';

  const response = await axios.post(
    WCL_USER_API_URL,
    { query, variables },
    {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (response.data.errors) {
    throw new Error(`WCL GraphQL: ${response.data.errors[0].message}`);
  }

  return response.data.data;
}

/**
 * Get a report using the user's token (works for private reports).
 * Falls back to client credentials if user token fails.
 */
export async function getReportDataWithUserToken(reportCode, userToken) {
  const query = `
    query GetReportData($reportCode: String!) {
      reportData {
        report(code: $reportCode) {
          code
          title
          startTime
          endTime
          region { name }
          guild { name }
          zone { name }
          visibility
          fights(killType: Encounters) {
            id
            encounterID
            name
            kill
            difficulty
            startTime
            endTime
          }
          masterData(translate: true) {
            actors(type: "Player") {
              id
              name
              server
              subType
            }
          }
        }
      }
    }
  `;

  const data = await executeUserGraphQL(userToken, query, { reportCode });
  const report = data.reportData?.report;

  if (!report) return null;

  return {
    code: report.code,
    title: report.title,
    startTime: report.startTime,
    endTime: report.endTime,
    region: report.region?.name,
    guild: report.guild,
    zone: report.zone,
    visibility: report.visibility || 'public',
    fights: report.fights || [],
    participants: (report.masterData?.actors || []).map(a => ({
      name: a.name,
      server: a.server || 'Unknown',
      class: a.subType,
    })),
  };
}

/**
 * Get WCL user info (userId) from user token.
 */
export async function getWclUserInfo(userToken) {
  const query = `{ userData { currentUser { id name } } }`;
  const data = await executeUserGraphQL(userToken, query);
  return data.userData?.currentUser;
}

/**
 * Search for reports containing a specific character
 * Used for auto-import
 */
export async function getCharacterReports(name, serverSlug, serverRegion, limit = 10) {
  const query = `
    query GetCharacterReports($name: String!, $serverSlug: String!, $serverRegion: String!) {
      characterData {
        character(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
          recentReports(limit: ${limit}) {
            data {
              code
              startTime
              endTime
            }
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { name, serverSlug, serverRegion });
    return data.characterData?.character?.recentReports?.data || [];
  } catch (error) {
    console.error('Error fetching character reports:', error.message);
    return [];
  }
}

/**
 * Batch fetch WCL parse percentiles for a character across multiple encounters.
 * Uses GraphQL aliases to fetch all encounters in a single API call.
 * Returns Map<encounterID, { bestPercent, medianPercent, kills, bestAmount }>
 */
export async function getCharacterEncounterRankings(name, serverSlug, serverRegion, encounterIds, difficulty) {
  if (!encounterIds || encounterIds.length === 0) return new Map();

  const difficultyMap = { 'LFR': 1, 'Normal': 2, 'Heroic': 3, 'Mythic': 5 };
  const diffNum = typeof difficulty === 'string' ? (difficultyMap[difficulty] || 5) : (difficulty || 5);

  const encounterQueries = encounterIds.map(id =>
    `enc_${id}: encounterRankings(encounterID: ${id}, difficulty: ${diffNum})`
  ).join('\n');

  const query = `
    query GetCharacterRankings($name: String!, $serverSlug: String!, $serverRegion: String!) {
      characterData {
        character(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
          ${encounterQueries}
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { name, serverSlug, serverRegion });
    const character = data.characterData?.character;
    if (!character) return new Map();

    const results = new Map();
    for (const id of encounterIds) {
      const ranking = character[`enc_${id}`];
      if (ranking) {
        results.set(id, {
          bestPercent: ranking.rankPercent ?? ranking.bestPerformanceAverage ?? null,
          medianPercent: ranking.medianPerformance ?? ranking.medianPercent ?? null,
          kills: ranking.totalKills || 0,
          bestAmount: ranking.bestAmount || 0,
        });
      }
    }
    return results;
  } catch (error) {
    console.error('Error fetching character rankings:', error.message);
    return new Map();
  }
}
