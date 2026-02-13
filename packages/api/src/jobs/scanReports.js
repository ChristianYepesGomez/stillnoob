import { db } from '../db/client.js';
import { characters, reports, fights } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  getCharacterReports,
  getReportData,
  getBatchFightStats,
  getBatchExtendedFightStats,
} from '../services/wcl.js';
import { processExtendedFightData, invalidateAnalysisCache } from '../services/analysis.js';
import { getCharacterRaiderIO, saveScoreSnapshot } from '../services/raiderio.js';
import { acquireToken } from '../services/rateLimiter.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Scanner');

// ── Retry / Circuit Breaker config ──
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s → 4s → 8s
const CIRCUIT_BREAKER_THRESHOLD = 5; // consecutive WCL failures to abort scan

/**
 * Returns true if the error is transient and worth retrying.
 */
function isTransientError(err) {
  if (err.response) {
    const status = err.response.status;
    return status === 429 || status >= 500;
  }
  // Network errors, timeouts
  return (
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ENOTFOUND' ||
    err.message?.includes('timeout')
  );
}

/**
 * Retry an async function with exponential backoff.
 * Only retries on transient errors (429, 5xx, network).
 */
async function retryWithBackoff(fn, label) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        const status = err.response?.status || err.code || 'unknown';
        log.warn(`${label} failed (${status}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

/**
 * Scan WCL for new reports for all registered characters.
 * Includes retry with exponential backoff and circuit breaker.
 */
export async function scanForNewReports() {
  log.info('Starting WCL report scan...');

  const allChars = await db.select().from(characters).all();

  if (allChars.length === 0) {
    log.info('No characters registered, skipping scan');
    return { scanned: 0, imported: 0, failed: 0 };
  }

  let totalNew = 0;
  let totalFailed = 0;
  let consecutiveWclFailures = 0;

  for (const char of allChars) {
    // Circuit breaker: if WCL is consistently failing, abort early
    if (consecutiveWclFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      log.error(
        `Circuit breaker triggered after ${CIRCUIT_BREAKER_THRESHOLD} consecutive WCL failures — aborting scan`,
      );
      break;
    }

    try {
      await acquireToken();

      const wclReports = await retryWithBackoff(
        () => getCharacterReports(char.name, char.realmSlug, char.region, 5),
        `getCharacterReports(${char.name})`,
      );

      // WCL responded — reset circuit breaker
      consecutiveWclFailures = 0;

      for (const wclReport of wclReports) {
        // Check if already imported
        const existing = await db
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.wclCode, wclReport.code))
          .get();

        if (existing) continue;

        // Import new report
        try {
          await acquireToken();
          const reportData = await retryWithBackoff(
            () => getReportData(wclReport.code),
            `getReportData(${wclReport.code})`,
          );
          if (!reportData) continue;

          // Build char map for this user (before transaction)
          const userChars = await db
            .select()
            .from(characters)
            .where(eq(characters.userId, char.userId))
            .all();
          const charMap = {};
          for (const c of userChars) {
            charMap[c.name.normalize('NFC').toLowerCase()] = c.id;
          }

          const encounterFights = (reportData.fights || []).filter((f) => f.encounterID > 0);

          // Transaction: insert report + all fights atomically
          const { fightMappings } = await db.transaction(async (tx) => {
            const [txReport] = await tx
              .insert(reports)
              .values({
                wclCode: wclReport.code,
                title: reportData.title,
                startTime: reportData.startTime,
                endTime: reportData.endTime,
                region: reportData.region,
                guildName: reportData.guild?.name || null,
                zoneName: reportData.zone?.name || null,
                participantsCount: reportData.participants?.length || 0,
                importedBy: char.userId,
                importSource: 'auto',
              })
              .returning();

            const txFightMappings = [];
            for (const fight of encounterFights) {
              const difficultyMap = {
                1: 'LFR',
                2: 'Normal',
                3: 'Heroic',
                4: 'Heroic',
                5: 'Mythic',
              };
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
                txFightMappings.push({
                  wclFightId: fight.id,
                  storedFightId: storedFight.id,
                  durationMs,
                });
              }
            }

            return { report: txReport, fightMappings: txFightMappings };
          });

          // Performance data (outside transaction — tolerant of partial failure)
          if (fightMappings.length > 0) {
            await acquireToken();
            const allFightIds = fightMappings.map((f) => f.wclFightId);
            const [batchBasicStats, batchExtStats] = await Promise.all([
              retryWithBackoff(
                () => getBatchFightStats(wclReport.code, allFightIds),
                `getBatchFightStats(${wclReport.code})`,
              ),
              retryWithBackoff(
                () => getBatchExtendedFightStats(wclReport.code, allFightIds),
                `getBatchExtendedFightStats(${wclReport.code})`,
              ),
            ]);

            for (const mapping of fightMappings) {
              const basicStats = batchBasicStats.get(mapping.wclFightId);
              const extStats = batchExtStats.get(mapping.wclFightId);
              if (basicStats && extStats) {
                try {
                  await processExtendedFightData(
                    mapping.storedFightId,
                    mapping.durationMs,
                    basicStats,
                    extStats,
                    charMap,
                  );
                } catch (statsErr) {
                  log.warn(
                    `Stats processing failed for fight ${mapping.wclFightId}`,
                    statsErr.message,
                  );
                }
              }
            }

            // Invalidate analysis cache for affected characters
            for (const charId of Object.values(charMap)) {
              invalidateAnalysisCache(charId);
            }
          }

          totalNew++;
          log.info(`Imported report ${wclReport.code} for ${char.name}`);
        } catch (importErr) {
          totalFailed++;
          if (isTransientError(importErr)) consecutiveWclFailures++;
          log.error(`Failed to import ${wclReport.code} after retries`, importErr.message);
        }
      }
      // Snapshot M+ score from Raider.IO
      try {
        const raiderIO = await getCharacterRaiderIO(char.region, char.realmSlug, char.name);
        if (raiderIO?.mythicPlus?.score) {
          await saveScoreSnapshot(char.id, raiderIO);
        }
      } catch (rioErr) {
        log.warn(`RaiderIO snapshot failed for ${char.name}`, rioErr.message);
      }
    } catch (err) {
      totalFailed++;
      if (isTransientError(err)) {
        consecutiveWclFailures++;
      }
      log.error(`Error scanning ${char.name}-${char.realmSlug}`, err.message);
    }
  }

  const summary = { scanned: allChars.length, imported: totalNew, failed: totalFailed };
  if (totalFailed > 0) {
    log.warn(
      `Scan complete with errors — ${totalNew} imported, ${totalFailed} failed out of ${allChars.length} characters`,
    );
  } else {
    log.info(`Scan complete — ${totalNew} new reports imported from ${allChars.length} characters`);
  }

  return summary;
}
