import { Router } from 'express';
import { db } from '../db/client.js';
import { reports, fights, characters } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { importLimiter } from '../middleware/rateLimit.js';
import {
  getReportData,
  getReportDataWithUserToken,
  getBatchFightStats,
  getBatchExtendedFightStats,
} from '../services/wcl.js';
import { authProviders, guildMembers } from '../db/schema.js';
import { processExtendedFightData, invalidateAnalysisCache } from '../services/analysis.js';
import { decryptToken } from '../utils/encryption.js';
import { createLogger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';

const log = createLogger('Route:Reports');
const router = Router();

/**
 * Extract WCL report code from URL or raw code
 * @param {string} input
 * @returns {string|null}
 */
function extractReportCode(input) {
  if (!input) return null;
  // Direct code (16-char alphanumeric)
  if (/^[a-zA-Z0-9]{16}$/.test(input.trim())) {
    return input.trim();
  }
  // URL pattern
  const match = input.match(/warcraftlogs\.com\/reports\/([a-zA-Z0-9]{16})/);
  return match ? match[1] : null;
}

// POST /api/v1/reports/import — import a WCL report
router.post('/import', authenticateToken, importLimiter, async (req, res) => {
  try {
    const { url, visibility = 'public', guildId } = req.body;
    const reportCode = extractReportCode(url);

    if (!reportCode) {
      return res.status(400).json({ error: 'Invalid Warcraft Logs URL or report code' });
    }

    if (!['public', 'private', 'guild'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be public, private, or guild' });
    }

    // If guild visibility, verify membership
    if (guildId) {
      const membership = await db
        .select({ role: guildMembers.role })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
        .get();

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this guild' });
      }
    }

    // Check if already imported
    const existing = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.wclCode, reportCode))
      .get();

    if (existing) {
      return res.status(409).json({ error: 'Report already imported', reportId: existing.id });
    }

    // Try fetching with user token first (for private reports), fallback to client credentials
    let reportData = null;
    const wclProvider = await db
      .select({ accessToken: authProviders.accessToken })
      .from(authProviders)
      .where(and(eq(authProviders.userId, req.user.id), eq(authProviders.provider, 'warcraftlogs')))
      .get();

    if (wclProvider?.accessToken) {
      try {
        const token = decryptToken(wclProvider.accessToken);
        reportData = await retryWithBackoff(
          () => getReportDataWithUserToken(reportCode, token),
          `getReportDataWithUserToken(${reportCode})`,
        );
      } catch {
        // User token failed, fall back to client credentials
      }
    }

    if (!reportData) {
      reportData = await retryWithBackoff(
        () => getReportData(reportCode),
        `getReportData(${reportCode})`,
      );
    }

    if (!reportData) {
      return res.status(404).json({
        error: 'Report not found on Warcraft Logs. If private, link your WCL account first.',
      });
    }

    // Build character name → id map before transaction
    const userChars = await db
      .select()
      .from(characters)
      .where(eq(characters.userId, req.user.id))
      .all();
    const charMap = {};
    for (const c of userChars) {
      charMap[c.name.toLowerCase()] = c.id;
    }

    // Parse encounter fights before transaction
    const encounterFights = (reportData.fights || []).filter((f) => f.encounterID > 0);
    let performanceCount = 0;

    // Transaction: insert report + all fights atomically (rollback on failure)
    const { report, fightMappings } = await db.transaction(async (tx) => {
      const [txReport] = await tx
        .insert(reports)
        .values({
          wclCode: reportCode,
          title: reportData.title,
          startTime: reportData.startTime,
          endTime: reportData.endTime,
          region: reportData.region,
          guildName: reportData.guild?.name || null,
          zoneName: reportData.zone?.name || null,
          participantsCount: reportData.participants?.length || 0,
          importedBy: req.user.id,
          importSource: 'manual',
          visibility,
          guildId: guildId || null,
        })
        .returning();

      const txFightMappings = [];
      for (const fight of encounterFights) {
        const difficultyMap = { 1: 'LFR', 2: 'Normal', 3: 'Heroic', 4: 'Heroic', 5: 'Mythic' };
        const difficulty =
          fight.difficulty >= 10 ? 'Mythic+' : difficultyMap[fight.difficulty] || 'Normal';
        const durationMs = (fight.endTime || 0) - (fight.startTime || 0);

        const [storedFight] = await tx
          .insert(fights)
          .values({
            reportId: txReport.id,
            wclFightId: fight.id,
            encounterId: fight.encounterID,
            bossName: fight.name || 'Unknown',
            difficulty,
            isKill: fight.kill || false,
            startTime: fight.startTime,
            endTime: fight.endTime,
            durationMs,
          })
          .onConflictDoNothing()
          .returning();

        if (storedFight) {
          txFightMappings.push({ wclFightId: fight.id, storedFightId: storedFight.id, durationMs });
        }
      }

      return { report: txReport, fightMappings: txFightMappings };
    });

    // Performance data processing (outside transaction — tolerant of partial failure)
    if (fightMappings.length > 0) {
      const allFightIds = fightMappings.map((f) => f.wclFightId);
      try {
        const [batchBasicStats, batchExtStats] = await Promise.all([
          retryWithBackoff(
            () => getBatchFightStats(reportCode, allFightIds),
            `getBatchFightStats(${reportCode})`,
          ),
          retryWithBackoff(
            () => getBatchExtendedFightStats(reportCode, allFightIds),
            `getBatchExtendedFightStats(${reportCode})`,
          ),
        ]);

        for (const mapping of fightMappings) {
          const basicStats = batchBasicStats.get(mapping.wclFightId);
          const extStats = batchExtStats.get(mapping.wclFightId);
          if (basicStats && extStats) {
            try {
              const count = await processExtendedFightData(
                mapping.storedFightId,
                mapping.durationMs,
                basicStats,
                extStats,
                charMap,
              );
              performanceCount += count;
            } catch (statsErr) {
              log.warn(`Stats failed for fight ${mapping.wclFightId}`, statsErr.message);
            }
          }
        }
      } catch (statsErr) {
        log.warn('Batch stats fetch failed', statsErr.message);
      }
    }

    // Invalidate analysis cache for affected characters
    for (const charId of Object.values(charMap)) {
      invalidateAnalysisCache(charId);
    }

    res.status(201).json({
      report: {
        id: report.id,
        wclCode: reportCode,
        title: report.title,
        zoneName: report.zoneName,
      },
      stats: {
        fightsProcessed: fightMappings.length,
        performanceRecords: performanceCount,
      },
    });
  } catch (err) {
    log.error('Import failed', err);
    const status = err.response?.status;
    if (status >= 500 || status === 429 || err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return res.status(502).json({ error: 'Warcraft Logs API is temporarily unavailable. Please try again later.' });
    }
    if (err.message?.includes('WCL')) {
      return res.status(502).json({ error: 'Failed to fetch from Warcraft Logs API' });
    }
    res.status(500).json({ error: 'Import failed' });
  }
});

// GET /api/v1/reports — list my reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userReports = await db
      .select()
      .from(reports)
      .where(eq(reports.importedBy, req.user.id))
      .orderBy(desc(reports.processedAt))
      .all();

    res.json(userReports);
  } catch (err) {
    log.error('Get reports failed', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

// GET /api/v1/reports/:code — report detail with fights (visibility-aware)
router.get('/:code', optionalAuth, async (req, res) => {
  try {
    const report = await db
      .select()
      .from(reports)
      .where(eq(reports.wclCode, req.params.code))
      .get();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Visibility checks
    if (report.visibility === 'private') {
      if (!req.user || req.user.id !== report.importedBy) {
        return res.status(404).json({ error: 'Report not found' });
      }
    } else if (report.visibility === 'guild') {
      if (!req.user) {
        return res.status(404).json({ error: 'Report not found' });
      }
      if (req.user.id !== report.importedBy && report.guildId) {
        const membership = await db
          .select({ role: guildMembers.role })
          .from(guildMembers)
          .where(
            and(eq(guildMembers.guildId, report.guildId), eq(guildMembers.userId, req.user.id)),
          )
          .get();
        if (!membership) {
          return res.status(404).json({ error: 'Report not found' });
        }
      } else if (req.user.id !== report.importedBy) {
        return res.status(404).json({ error: 'Report not found' });
      }
    }

    const reportFights = await db.select().from(fights).where(eq(fights.reportId, report.id)).all();

    res.json({ ...report, fights: reportFights });
  } catch (err) {
    log.error('Get report failed', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

export default router;
