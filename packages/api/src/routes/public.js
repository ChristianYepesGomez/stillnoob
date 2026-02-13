import { Router } from 'express';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterRaiderIO } from '../services/raiderio.js';

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

    // Filter by name case-insensitively with Unicode normalization
    const normalizedName = name.normalize('NFC').toLowerCase();
    const match = char.find(c => c.name.normalize('NFC').toLowerCase() === normalizedName);

    if (!match) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Fetch WCL analysis + Raider.io data in parallel
    const [data, raiderIO] = await Promise.all([
      getCharacterPerformance(match.id, { weeks, visibilityFilter: 'public', characterInfo: { name: match.name, realmSlug: match.realmSlug, region: match.region } }),
      getCharacterRaiderIO(match.region, match.realmSlug, match.name),
    ]);

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
        avgActiveTime: data.summary.avgActiveTime,
        avgCpm: data.summary.avgCpm,
        avgParsePercentile: data.summary.avgParsePercentile,
      },
      bossBreakdown: data.bossBreakdown.map(b => ({
        bossName: b.bossName,
        difficulty: b.difficulty,
        fights: b.fights,
        avgDps: b.avgDps,
        bestDps: b.bestDps,
        deathRate: b.deathRate,
        dpsVsMedian: b.dpsVsMedian,
        parsePercentile: b.parsePercentile,
        avgActiveTime: b.avgActiveTime,
        avgCpm: b.avgCpm,
      })),
      raiderIO,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public character error:', err);
    res.status(500).json({ error: 'Failed to get character data' });
  }
});

export default router;
