import { Router } from 'express';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterRaiderIO, saveScoreSnapshot } from '../services/raiderio.js';
import { analyzeMythicPlus } from '../services/mythicPlusAnalysis.js';
import { mplusSnapshots } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Route:Public');
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
      mplusAnalysis: raiderIO ? (() => {
        const mpa = analyzeMythicPlus(raiderIO, data.recommendations?.playerLevel);
        return mpa ? {
          dungeonAnalysis: mpa.dungeonAnalysis,
          scoreAnalysis: mpa.scoreAnalysis,
          timingAnalysis: mpa.timingAnalysis,
          upgradeAnalysis: mpa.upgradeAnalysis,
          pushTargets: mpa.pushTargets,
        } : null;
      })() : null,
      lastUpdated: new Date().toISOString(),
    });

    // Snapshot M+ score (fire-and-forget)
    if (raiderIO?.mythicPlus?.score && match.id) {
      saveScoreSnapshot(match.id, raiderIO).catch(() => {});
    }
  } catch (err) {
    log.error('Public character failed', err);
    res.status(500).json({ error: 'Failed to get character data' });
  }
});

// GET /api/v1/public/character/:region/:realm/:name/mplus-history
router.get('/character/:region/:realm/:name/mplus-history', async (req, res) => {
  try {
    const { region, realm, name } = req.params;
    const weeks = parseInt(req.query.weeks) || 12;

    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const allChars = await db.select()
      .from(characters)
      .where(and(eq(characters.realmSlug, realmSlug), eq(characters.region, region.toLowerCase())))
      .all();

    const normalizedName = name.normalize('NFC').toLowerCase();
    const match = allChars.find(c => c.name.normalize('NFC').toLowerCase() === normalizedName);

    if (!match) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    const snapshots = await db.select()
      .from(mplusSnapshots)
      .where(and(eq(mplusSnapshots.characterId, match.id), gte(mplusSnapshots.snapshotAt, cutoff)))
      .orderBy(desc(mplusSnapshots.snapshotAt))
      .all();

    let trend = null;
    if (snapshots.length >= 2) {
      const newest = snapshots[0].score;
      const oldest = snapshots[snapshots.length - 1].score;
      const change = newest - oldest;
      trend = { change: Math.round(change), direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
    }

    res.json({ snapshots, trend });
  } catch (err) {
    log.error('Public M+ history failed', err);
    res.status(500).json({ error: 'Failed to get M+ history' });
  }
});

export default router;
