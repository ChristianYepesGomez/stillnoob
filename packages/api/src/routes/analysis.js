import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rateLimit.js';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterBlizzardProfile, saveScoreSnapshot } from '../services/characterProfile.js';
import { analyzeMythicPlus } from '../services/mythicPlusAnalysis.js';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { mplusSnapshots } from '../db/schema.js';
import { getCharacterEquipment, transformEquipment } from '../services/blizzard.js';
import { analyzeCharacterBuild } from '../services/buildAnalysis.js';
import { getMetaWithFreshness } from '../services/metaRefreshManager.js';
import { getSpecData } from '@stillnoob/shared';
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
    const char = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Fetch Raider.io + equipment in parallel first (fast), then analysis with raiderIO context
    const [raiderIO, equipment] = await Promise.all([
      getCharacterBlizzardProfile(char.region, char.realmSlug, char.name),
      getCharacterEquipment(char.name, char.realmSlug, char.region).catch((err) => {
        log.warn('Failed to fetch equipment', err.message);
        return null;
      }),
    ]);

    // Look up spec-specific CPM baseline
    const specInfo = char.className && char.spec ? getSpecData(char.className, char.spec) : null;

    // Fetch specMeta with freshness check (prefers M+ meta, auto-refreshes if stale)
    let specMeta = null;
    let metaStatus = null;
    if (char.className && char.spec) {
      const metaResult = await getMetaWithFreshness(char.className, char.spec, 'world');
      specMeta = metaResult.meta;
      metaStatus = metaResult.status;
    }

    const data = await getCharacterPerformance(charId, {
      weeks,
      bossId,
      difficulty,
      characterInfo: { name: char.name, realmSlug: char.realmSlug, region: char.region },
      raiderIO,
      specCpmBaseline: specInfo?.expectedCpm || null,
      className: char.className,
      spec: char.spec,
      specMeta,
    });

    // M+ visual analysis (charts, brackets, trends)
    const mplusAnalysis = raiderIO ? analyzeMythicPlus(raiderIO) : null;

    // Snapshot M+ score (fire-and-forget)
    if (raiderIO?.mythicPlus?.score) {
      saveScoreSnapshot(charId, raiderIO).catch((err) => log.warn('Failed to save M+ snapshot', err.message));
    }

    // Build / gear analysis
    let buildAnalysis = null;
    if (equipment) {
      const transformed = transformEquipment(equipment);
      buildAnalysis = analyzeCharacterBuild(transformed, char.className, char.spec, specMeta);
    }

    res.json({
      ...data,
      raiderIO,
      mplusAnalysis: mplusAnalysis
        ? {
            dungeonAnalysis: mplusAnalysis.dungeonAnalysis,
            scoreAnalysis: mplusAnalysis.scoreAnalysis,
            timingAnalysis: mplusAnalysis.timingAnalysis,
            upgradeAnalysis: mplusAnalysis.upgradeAnalysis,
            pushTargets: mplusAnalysis.pushTargets,
          }
        : null,
      buildAnalysis,
      metaStatus,
    });
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
    const userChars = await db
      .select()
      .from(characters)
      .where(eq(characters.userId, req.user.id))
      .all();

    if (userChars.length === 0) {
      return res.json({ characters: [], summary: null });
    }

    // Get analysis for each character in parallel
    const results = await Promise.all(
      userChars.map(async (char) => {
        try {
          const data = await getCharacterPerformance(char.id, {
            weeks,
            characterInfo: { name: char.name, realmSlug: char.realmSlug, region: char.region },
          });
          return {
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
          };
        } catch (err) {
          log.warn(`Overview: analysis failed for character ${char.id}`, err.message);
          return {
            character: {
              id: char.id,
              name: char.name,
              realm: char.realm,
              className: char.className,
              spec: char.spec,
              isPrimary: char.isPrimary,
            },
            summary: null,
            totalFights: 0,
          };
        }
      }),
    );

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
    const char = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    const snapshots = await db
      .select()
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
      trend = {
        change: Math.round(change),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      };
    }

    res.json({ snapshots, trend });
  } catch (err) {
    log.error('M+ history failed', err);
    res.status(500).json({ error: 'Failed to get M+ history' });
  }
});

// GET /api/v1/analysis/character/:id/build — character build analysis
router.get('/character/:id/build', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
    if (isNaN(charId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }

    // Verify ownership
    const char = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const equipment = await getCharacterEquipment(char.name, char.realmSlug, char.region);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment data not available' });
    }

    const transformed = transformEquipment(equipment);

    // Fetch specMeta with freshness check
    let specMeta = null;
    if (char.className && char.spec) {
      const metaResult = await getMetaWithFreshness(char.className, char.spec, 'world');
      specMeta = metaResult.meta;
    }

    const result = analyzeCharacterBuild(transformed, char.className, char.spec, specMeta);
    res.json(result);
  } catch (err) {
    log.error('Build analysis failed', err);
    res.status(500).json({ error: 'Failed to get build analysis' });
  }
});

export default router;
