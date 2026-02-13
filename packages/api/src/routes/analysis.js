import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rateLimit.js';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterRaiderIO, saveScoreSnapshot } from '../services/raiderio.js';
import { analyzeMythicPlus, mergeMPlusTips } from '../services/mythicPlusAnalysis.js';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { mplusSnapshots } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Route:Analysis');
const router = Router();
router.use(authenticateToken);
router.use(analysisLimiter);

// GET /api/v1/analysis/character/:id — per-character full analysis
router.get('/character/:id', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
    if (isNaN(charId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }
    const weeks = parseInt(req.query.weeks) || 8;
    const bossId = req.query.bossId ? parseInt(req.query.bossId) : undefined;
    const difficulty = req.query.difficulty || undefined;

    // Verify ownership
    const char = await db.select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Fetch WCL analysis + Raider.io data in parallel
    const [data, raiderIO] = await Promise.all([
      getCharacterPerformance(charId, { weeks, bossId, difficulty, characterInfo: { name: char.name, realmSlug: char.realmSlug, region: char.region } }),
      getCharacterRaiderIO(char.region, char.realmSlug, char.name),
    ]);

    // M+ coaching analysis
    const mplusAnalysis = raiderIO ? analyzeMythicPlus(raiderIO, data.recommendations?.playerLevel) : null;
    if (mplusAnalysis?.mplusTips?.length) {
      mergeMPlusTips(data.recommendations, mplusAnalysis.mplusTips);
    }

    // Snapshot M+ score (fire-and-forget)
    if (raiderIO?.mythicPlus?.score) {
      saveScoreSnapshot(charId, raiderIO).catch(() => {});
    }

    res.json({ ...data, raiderIO, mplusAnalysis: mplusAnalysis ? {
      dungeonAnalysis: mplusAnalysis.dungeonAnalysis,
      scoreAnalysis: mplusAnalysis.scoreAnalysis,
      timingAnalysis: mplusAnalysis.timingAnalysis,
      upgradeAnalysis: mplusAnalysis.upgradeAnalysis,
      pushTargets: mplusAnalysis.pushTargets,
    } : null });
  } catch (err) {
    log.error('Analysis failed', err);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

// GET /api/v1/analysis/overview — summary across all characters
router.get('/overview', async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 8;

    // Get all user's characters
    const userChars = await db.select()
      .from(characters)
      .where(eq(characters.userId, req.user.id))
      .all();

    if (userChars.length === 0) {
      return res.json({ characters: [], summary: null });
    }

    // Get analysis for each character
    const results = [];
    for (const char of userChars) {
      const data = await getCharacterPerformance(char.id, { weeks, characterInfo: { name: char.name, realmSlug: char.realmSlug, region: char.region } });
      results.push({
        character: {
          id: char.id,
          name: char.name,
          realm: char.realm,
          className: char.className,
          spec: char.spec,
          isPrimary: char.isPrimary,
        },
        summary: data.summary,
        totalFights: data.summary?.totalFights || 0,
      });
    }

    res.json({ characters: results });
  } catch (err) {
    log.error('Overview failed', err);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

// GET /api/v1/analysis/character/:id/mplus-history — M+ score history
router.get('/character/:id/mplus-history', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
    if (isNaN(charId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }
    const weeks = parseInt(req.query.weeks) || 12;

    // Verify ownership
    const char = await db.select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    const snapshots = await db.select()
      .from(mplusSnapshots)
      .where(and(eq(mplusSnapshots.characterId, charId), gte(mplusSnapshots.snapshotAt, cutoff)))
      .orderBy(desc(mplusSnapshots.snapshotAt))
      .all();

    // Compute trend
    let trend = null;
    if (snapshots.length >= 2) {
      const newest = snapshots[0].score;
      const oldest = snapshots[snapshots.length - 1].score;
      const change = newest - oldest;
      trend = { change: Math.round(change), direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
    }

    res.json({ snapshots, trend });
  } catch (err) {
    log.error('M+ history failed', err);
    res.status(500).json({ error: 'Failed to get M+ history' });
  }
});

export default router;
