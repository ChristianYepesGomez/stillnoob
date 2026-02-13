import { Router } from 'express';
import { db } from '../db/client.js';
import { characters, specMetaCache } from '../db/schema.js';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getCharacterPerformance } from '../services/analysis.js';
import { getCharacterEquipment, transformEquipment, getRealmList, getCharacterProfile, getCharacterMedia } from '../services/blizzard.js';
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
 * GET /api/v1/public/realms/:region
 * Returns the list of WoW realms for a region. Cached 24h server-side.
 */
router.get('/realms/:region', async (req, res) => {
  try {
    const region = req.params.region.toLowerCase();
    if (!['us', 'eu', 'kr', 'tw'].includes(region)) {
      return res.status(400).json({ error: 'Invalid region. Must be us, eu, kr, or tw.' });
    }
    const realms = await getRealmList(region);
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.json({ realms });
  } catch (err) {
    log.error('Realm list failed', err);
    res.status(500).json({ error: 'Failed to fetch realm list' });
  }
});

/**
 * GET /api/v1/public/character/:region/:realm/:name
 * Public character profile — no auth required, SEO-indexable.
 * Returns score, summary, and boss breakdown for any registered character.
 * Falls back to live Blizzard API + Raider.io if character not in local DB.
 */
router.get('/character/:region/:realm/:name', async (req, res) => {
  try {
    const { region, realm, name } = req.params;
    const weeks = parseInt(req.query.weeks) || 8;
    const realmSlug = realm.toLowerCase().replace(/\s+/g, '-');
    const regionLower = region.toLowerCase();

    // --- Try local DB first ---
    const char = await db.select()
      .from(characters)
      .where(
        and(
          eq(characters.realmSlug, realmSlug),
          eq(characters.region, regionLower),
        )
      )
      .all();

    const normalizedName = name.normalize('NFC').toLowerCase();
    const match = char.find(c => c.name.normalize('NFC').toLowerCase() === normalizedName);

    // Helper: fetch specMeta from cache
    const fetchSpecMeta = async (className, spec) => {
      if (!className || !spec) return null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const cached = await db.select()
        .from(specMetaCache)
        .where(and(
          eq(specMetaCache.className, className),
          eq(specMetaCache.spec, spec),
          eq(specMetaCache.region, 'world'),
          gte(specMetaCache.lastUpdated, sevenDaysAgo),
        ))
        .get();
      if (!cached) return null;
      return {
        avgStats: JSON.parse(cached.avgStats || '{}'),
        avgItemLevel: cached.avgItemLevel,
        commonEnchants: JSON.parse(cached.commonEnchants || '{}'),
        commonGems: JSON.parse(cached.commonGems || '{}'),
        sampleSize: cached.sampleSize,
      };
    };

    // Helper: build M+ analysis from raiderIO data
    const buildMplusAnalysis = (raiderIO) => {
      if (!raiderIO) return null;
      const mpa = analyzeMythicPlus(raiderIO);
      if (!mpa) return null;
      return {
        dungeonAnalysis: mpa.dungeonAnalysis,
        scoreAnalysis: mpa.scoreAnalysis,
        timingAnalysis: mpa.timingAnalysis,
        upgradeAnalysis: mpa.upgradeAnalysis,
        pushTargets: mpa.pushTargets,
      };
    };

    // --- DB match: return full WCL-enriched profile ---
    if (match) {
      const [data, raiderIO, equipment] = await Promise.all([
        getCharacterPerformance(match.id, { weeks, visibilityFilter: 'public', characterInfo: { name: match.name, realmSlug: match.realmSlug, region: match.region } }),
        getCharacterRaiderIO(match.region, match.realmSlug, match.name),
        getCharacterEquipment(match.name, match.realmSlug, match.region).catch(() => null),
      ]);

      let buildAnalysis = null;
      if (equipment) {
        const transformed = transformEquipment(equipment);
        const specMeta = await fetchSpecMeta(match.className, match.spec);
        buildAnalysis = analyzeCharacterBuild(transformed, match.className, match.spec, specMeta);
      }

      res.json({
        source: 'database',
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
        mplusAnalysis: buildMplusAnalysis(raiderIO),
        buildAnalysis,
        lastUpdated: new Date().toISOString(),
      });

      // Snapshot M+ score (fire-and-forget)
      if (raiderIO?.mythicPlus?.score && match.id) {
        saveScoreSnapshot(match.id, raiderIO).catch(() => {});
      }
      return;
    }

    // --- No DB match: live API fallback ---
    const profile = await getCharacterProfile(name, realmSlug, regionLower);
    if (!profile) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const [raiderIO, equipment, media] = await Promise.all([
      getCharacterRaiderIO(regionLower, realmSlug, profile.name),
      getCharacterEquipment(profile.name, realmSlug, regionLower).catch(() => null),
      getCharacterMedia(profile.name, realmSlug, regionLower),
    ]);

    let buildAnalysis = null;
    if (equipment) {
      const transformed = transformEquipment(equipment);
      const specMeta = await fetchSpecMeta(profile.className, profile.spec);
      buildAnalysis = analyzeCharacterBuild(transformed, profile.className, profile.spec, specMeta);
    }

    res.json({
      source: 'live',
      character: {
        name: profile.name,
        realm: profile.realm,
        realmSlug: profile.realmSlug || realmSlug,
        region: regionLower,
        className: profile.className,
        spec: profile.spec,
        raidRole: profile.raidRole,
        level: profile.level,
        equippedItemLevel: profile.equippedItemLevel,
        media,
      },
      score: null,
      summary: null,
      bossBreakdown: [],
      raiderIO,
      mplusAnalysis: buildMplusAnalysis(raiderIO),
      buildAnalysis,
      lastUpdated: new Date().toISOString(),
    });
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
