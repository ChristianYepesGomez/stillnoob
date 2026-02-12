import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rateLimit.js';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterRaiderIO } from '../services/raiderio.js';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();
router.use(authenticateToken);
router.use(analysisLimiter);

// GET /api/v1/analysis/character/:id — per-character full analysis
router.get('/character/:id', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
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
      getCharacterPerformance(charId, { weeks, bossId, difficulty }),
      getCharacterRaiderIO(char.region, char.realmSlug, char.name),
    ]);

    res.json({ ...data, raiderIO });
  } catch (err) {
    console.error('Analysis error:', err);
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
      const data = await getCharacterPerformance(char.id, { weeks });
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
    console.error('Overview error:', err);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

export default router;
