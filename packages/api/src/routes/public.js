import { Router } from 'express';
import { db } from '../db/client.js';
import { characters, specMetaCache } from '../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterEquipment, transformEquipment } from '../services/blizzard.js';
import { analyzeCharacterBuild } from '../services/buildAnalysis.js';
import { getCharacterRaiderIO, saveScoreSnapshot } from '../services/raiderio.js';
import { analyzeMythicPlus } from '../services/mythicPlusAnalysis.js';
import { mplusSnapshots } from '../db/schema.js';
import { getSpecMeta } from '../services/metaAggregation.js';
import { getSpecData } from '@stillnoob/shared';
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

    // Fetch WCL analysis + Raider.io data + equipment in parallel
    const [data, raiderIO, equipment] = await Promise.all([
      getCharacterPerformance(match.id, { weeks, visibilityFilter: 'public', characterInfo: { name: match.name, realmSlug: match.realmSlug, region: match.region } }),
      getCharacterRaiderIO(match.region, match.realmSlug, match.name),
      getCharacterEquipment(match.name, match.realmSlug, match.region).catch(() => null),
    ]);

    // Build / gear analysis
    let buildAnalysis = null;
    if (equipment) {
      const transformed = transformEquipment(equipment);

      // Try to get specMeta from cache
      let specMeta = null;
      if (match.className && match.spec) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const cached = await db.select()
          .from(specMetaCache)
          .where(and(
            eq(specMetaCache.className, match.className),
            eq(specMetaCache.spec, match.spec),
            eq(specMetaCache.region, 'world'),
            gte(specMetaCache.lastUpdated, sevenDaysAgo),
          ))
          .get();
        if (cached) {
          specMeta = {
            avgStats: JSON.parse(cached.avgStats || '{}'),
            avgItemLevel: cached.avgItemLevel,
            commonEnchants: JSON.parse(cached.commonEnchants || '{}'),
            commonGems: JSON.parse(cached.commonGems || '{}'),
            sampleSize: cached.sampleSize,
          };
        }
      }

      buildAnalysis = analyzeCharacterBuild(transformed, match.className, match.spec, specMeta);
    }

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
        const mpa = analyzeMythicPlus(raiderIO);
        return mpa ? {
          dungeonAnalysis: mpa.dungeonAnalysis,
          scoreAnalysis: mpa.scoreAnalysis,
          timingAnalysis: mpa.timingAnalysis,
          upgradeAnalysis: mpa.upgradeAnalysis,
          pushTargets: mpa.pushTargets,
        } : null;
      })() : null,
      buildAnalysis,
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

// GET /api/v1/public/character/:region/:realm/:name/build — public build analysis
router.get('/character/:region/:realm/:name/build', async (req, res) => {
  try {
    const { region, realm, name } = req.params;

    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');

    // Find the character (case-insensitive name match)
    const allChars = await db.select()
      .from(characters)
      .where(
        and(
          eq(characters.realmSlug, realmSlug),
          eq(characters.region, region.toLowerCase()),
        )
      )
      .all();

    const normalizedName = name.normalize('NFC').toLowerCase();
    const match = allChars.find(c => c.name.normalize('NFC').toLowerCase() === normalizedName);

    if (!match) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const equipment = await getCharacterEquipment(match.name, match.realmSlug, match.region);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment data not available' });
    }

    const transformed = transformEquipment(equipment);

    // Try to get specMeta from cache
    let specMeta = null;
    if (match.className && match.spec) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const cached = await db.select()
        .from(specMetaCache)
        .where(and(
          eq(specMetaCache.className, match.className),
          eq(specMetaCache.spec, match.spec),
          eq(specMetaCache.region, 'world'),
          gte(specMetaCache.lastUpdated, sevenDaysAgo),
        ))
        .get();
      if (cached) {
        specMeta = {
          avgStats: JSON.parse(cached.avgStats || '{}'),
          avgItemLevel: cached.avgItemLevel,
          commonEnchants: JSON.parse(cached.commonEnchants || '{}'),
          commonGems: JSON.parse(cached.commonGems || '{}'),
          sampleSize: cached.sampleSize,
        };
      }
    }

    const result = analyzeCharacterBuild(transformed, match.className, match.spec, specMeta);
    res.json(result);
  } catch (err) {
    log.error('Public build analysis failed', err);
    res.status(500).json({ error: 'Failed to get build analysis' });
  }
});

// GET /api/v1/public/meta/:className/:spec — public spec meta data
router.get('/meta/:className/:spec', async (req, res) => {
  try {
    const { className, spec } = req.params;

    const [specMeta, specData] = await Promise.all([
      getSpecMeta(className, spec),
      Promise.resolve(getSpecData(className, spec)),
    ]);

    res.json({
      specData: specData || null,
      meta: specMeta || null,
    });
  } catch (err) {
    log.error('Public meta failed', err);
    res.status(500).json({ error: 'Failed to get spec meta data' });
  }
});

export default router;
