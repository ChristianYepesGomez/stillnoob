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
      damage: parseTable(report.damage).map(e => ({ name: e.name, total: e.total || 0 })),
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
