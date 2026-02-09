import { Router } from 'express';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getCharacterPerformance } from '../services/analysis.js';

const router = Router();

/**
 * GET /api/v1/public/character/:region/:realm/:name
 * Public character profile — no auth required, SEO-indexable.
 * Returns score, summary, and boss breakdown for any registered character.
 */
router.get('/character/:region/:realm/:name', async (req, res) => {
  try {
    const { region, realm, name } = req.params;
    const weeks = parseInt(req.query.weeks) || 8;

    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');

    // Find the character (case-insensitive name match)
    const char = await db.select()
      .from(characters)
      .where(
        and(
          eq(characters.realmSlug, realmSlug),
          eq(characters.region, region.toLowerCase()),
        )
      )
      .all();

    // Filter by name case-insensitively (SQLite collation may vary)
    const match = char.find(c => c.name.toLowerCase() === name.toLowerCase());

    if (!match) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Only include data from public reports (private/guild reports excluded)
    const data = await getCharacterPerformance(match.id, { weeks, visibilityFilter: 'public' });

    // Return public-safe subset (no detailed consumable breakdown per fight)
    res.json({
      character: {
        name: match.name,
        realm: match.realm,
        realmSlug: match.realmSlug,
        region: match.region,
        className: match.className,
        spec: match.spec,
        raidRole: match.raidRole,
      },
      score: data.score,
      summary: {
        totalFights: data.summary.totalFights,
        avgDps: data.summary.avgDps,
        avgHps: data.summary.avgHps,
        deathRate: data.summary.deathRate,
        consumableScore: data.summary.consumableScore,
        dpsVsMedianPct: data.summary.dpsVsMedianPct,
      },
      bossBreakdown: data.bossBreakdown.map(b => ({
        bossName: b.bossName,
        difficulty: b.difficulty,
        fights: b.fights,
        avgDps: b.avgDps,
        bestDps: b.bestDps,
        deathRate: b.deathRate,
        dpsVsMedian: b.dpsVsMedian,
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public character error:', err);
    res.status(500).json({ error: 'Failed to get character data' });
  }
});

export default router;
