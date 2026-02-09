import { Router } from 'express';
import { db } from '../db/client.js';
import { reports, fights, characters, fightPerformance } from '../db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';
import { importLimiter } from '../middleware/rateLimit.js';
import { getReportData, getFightStats, getExtendedFightStats } from '../services/wcl.js';
import { processExtendedFightData } from '../services/analysis.js';

const router = Router();
router.use(authenticateToken);

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
router.post('/import', importLimiter, async (req, res) => {
  try {
    const { url } = req.body;
    const reportCode = extractReportCode(url);

    if (!reportCode) {
      return res.status(400).json({ error: 'Invalid Warcraft Logs URL or report code' });
    }

    // Check if already imported
    const existing = await db.select({ id: reports.id })
      .from(reports)
      .where(eq(reports.wclCode, reportCode))
      .get();

    if (existing) {
      return res.status(409).json({ error: 'Report already imported', reportId: existing.id });
    }

    // Fetch report data from WCL
    const reportData = await getReportData(reportCode);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found on Warcraft Logs' });
    }

    // Store the report
    const [report] = await db.insert(reports).values({
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
    }).returning();

    // Get user's characters for matching
    const userChars = await db.select()
      .from(characters)
      .where(eq(characters.userId, req.user.id))
      .all();

    // Build character name → id map (lowercase for matching)
    const charMap = {};
    for (const c of userChars) {
      charMap[c.name.toLowerCase()] = c.id;
    }

    // Process each boss encounter fight
    const encounterFights = (reportData.fights || []).filter(f => f.encounterID > 0);
    let processedCount = 0;
    let performanceCount = 0;

    for (const fight of encounterFights) {
      const difficultyMap = { 1: 'LFR', 2: 'Normal', 3: 'Heroic', 4: 'Heroic', 5: 'Mythic' };
      const difficulty = difficultyMap[fight.difficulty] || 'Normal';
      const durationMs = (fight.endTime || 0) - (fight.startTime || 0);

      // Store the fight
      try {
        const [storedFight] = await db.insert(fights).values({
          reportId: report.id,
          wclFightId: fight.id,
          encounterId: fight.encounterID,
          bossName: fight.name || 'Unknown',
          difficulty,
          isKill: fight.kill || false,
          startTime: fight.startTime,
          endTime: fight.endTime,
          durationMs,
        }).returning();

        processedCount++;

        // Fetch and process performance data for this fight
        try {
          const [basicStats, extStats] = await Promise.all([
            getFightStats(reportCode, [fight.id]),
            getExtendedFightStats(reportCode, [fight.id]),
          ]);

          const count = await processExtendedFightData(
            storedFight.id, durationMs, basicStats, extStats, charMap
          );
          performanceCount += count;
        } catch (statsErr) {
          console.warn(`Stats failed for fight ${fight.id}:`, statsErr.message);
        }
      } catch (fightErr) {
        if (!fightErr.message?.includes('UNIQUE')) {
          console.warn(`Fight insert failed:`, fightErr.message);
        }
      }
    }

    res.status(201).json({
      report: {
        id: report.id,
        wclCode: reportCode,
        title: report.title,
        zoneName: report.zoneName,
      },
      stats: {
        fightsProcessed: processedCount,
        performanceRecords: performanceCount,
      },
    });
  } catch (err) {
    console.error('Import error:', err);
    if (err.message?.includes('WCL')) {
      return res.status(502).json({ error: 'Failed to fetch from Warcraft Logs API' });
    }
    res.status(500).json({ error: 'Import failed' });
  }
});

// GET /api/v1/reports — list my reports
router.get('/', async (req, res) => {
  try {
    const userReports = await db.select()
      .from(reports)
      .where(eq(reports.importedBy, req.user.id))
      .orderBy(desc(reports.processedAt))
      .all();

    res.json(userReports);
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

// GET /api/v1/reports/:code — report detail with fights
router.get('/:code', async (req, res) => {
  try {
    const report = await db.select()
      .from(reports)
      .where(eq(reports.wclCode, req.params.code))
      .get();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportFights = await db.select()
      .from(fights)
      .where(eq(fights.reportId, report.id))
      .all();

    res.json({ ...report, fights: reportFights });
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

export default router;
