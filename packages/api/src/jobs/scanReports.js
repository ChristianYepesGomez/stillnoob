import { db } from '../db/client.js';
import { characters, reports, fights } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getCharacterReports, getReportData, getBatchFightStats, getBatchExtendedFightStats } from '../services/wcl.js';
import { processExtendedFightData, invalidateAnalysisCache } from '../services/analysis.js';
import { acquireToken } from '../services/rateLimiter.js';

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
  return err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' ||
    err.message?.includes('timeout');
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
        console.warn(`[Scanner] ${label} failed (${status}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
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
  console.log('[Scanner] Starting WCL report scan...');

  const allChars = await db.select().from(characters).all();

  if (allChars.length === 0) {
    console.log('[Scanner] No characters registered, skipping scan');
    return { scanned: 0, imported: 0, failed: 0 };
  }

  let totalNew = 0;
  let totalFailed = 0;
  let consecutiveWclFailures = 0;

  for (const char of allChars) {
    // Circuit breaker: if WCL is consistently failing, abort early
    if (consecutiveWclFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.error(`[Scanner] Circuit breaker triggered after ${CIRCUIT_BREAKER_THRESHOLD} consecutive WCL failures — aborting scan`);
      break;
    }

    try {
      await acquireToken();

      const wclReports = await retryWithBackoff(
        () => getCharacterReports(char.name, char.realmSlug, char.region, 5),
        `getCharacterReports(${char.name})`
      );

      // WCL responded — reset circuit breaker
      consecutiveWclFailures = 0;

      for (const wclReport of wclReports) {
        // Check if already imported
        const existing = await db.select({ id: reports.id })
          .from(reports)
          .where(eq(reports.wclCode, wclReport.code))
          .get();

        if (existing) continue;

        // Import new report
        try {
          await acquireToken();
          const reportData = await retryWithBackoff(
            () => getReportData(wclReport.code),
            `getReportData(${wclReport.code})`
          );
          if (!reportData) continue;

          const [report] = await db.insert(reports).values({
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
          }).returning();

          // Build char map for this user
          const userChars = await db.select()
            .from(characters)
            .where(eq(characters.userId, char.userId))
            .all();
          const charMap = {};
          for (const c of userChars) {
            charMap[c.name.normalize('NFC').toLowerCase()] = c.id;
          }

          // Step 1: Insert all fights into DB and build mappings
          const encounterFights = (reportData.fights || []).filter(f => f.encounterID > 0);
          const fightMappings = [];
          for (const fight of encounterFights) {
            const difficultyMap = { 1: 'LFR', 2: 'Normal', 3: 'Heroic', 4: 'Heroic', 5: 'Mythic' };
            const difficulty = difficultyMap[fight.difficulty] || 'Normal';
            const durationMs = (fight.endTime || 0) - (fight.startTime || 0);

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

              fightMappings.push({ wclFightId: fight.id, storedFightId: storedFight.id, durationMs });
            } catch (fightErr) {
              if (!fightErr.message?.includes('UNIQUE')) {
                console.warn(`[Scanner] Fight insert error:`, fightErr.message);
              }
            }
          }

          // Step 2: Batch fetch stats for ALL fights (2 API calls instead of 2*N)
          if (fightMappings.length > 0) {
            await acquireToken();
            const allFightIds = fightMappings.map(f => f.wclFightId);
            const [batchBasicStats, batchExtStats] = await Promise.all([
              retryWithBackoff(
                () => getBatchFightStats(wclReport.code, allFightIds),
                `getBatchFightStats(${wclReport.code})`
              ),
              retryWithBackoff(
                () => getBatchExtendedFightStats(wclReport.code, allFightIds),
                `getBatchExtendedFightStats(${wclReport.code})`
              ),
            ]);

            // Step 3: Process each fight with its pre-fetched data
            for (const mapping of fightMappings) {
              const basicStats = batchBasicStats.get(mapping.wclFightId);
              const extStats = batchExtStats.get(mapping.wclFightId);
              if (basicStats && extStats) {
                try {
                  await processExtendedFightData(
                    mapping.storedFightId, mapping.durationMs, basicStats, extStats, charMap
                  );
                } catch (statsErr) {
                  console.warn(`[Scanner] Stats processing failed for fight ${mapping.wclFightId}:`, statsErr.message);
                }
              }
            }

            // Invalidate analysis cache for affected characters
            for (const charId of Object.values(charMap)) {
              invalidateAnalysisCache(charId);
            }
          }

          totalNew++;
          console.log(`[Scanner] Imported report ${wclReport.code} for ${char.name}`);
        } catch (importErr) {
          totalFailed++;
          if (isTransientError(importErr)) consecutiveWclFailures++;
          console.error(`[Scanner] Failed to import ${wclReport.code} after retries:`, importErr.message);
        }
      }
    } catch (err) {
      totalFailed++;
      if (isTransientError(err)) {
        consecutiveWclFailures++;
      }
      console.error(`[Scanner] Error scanning ${char.name}-${char.realmSlug}:`, err.message);
    }
  }

  const summary = { scanned: allChars.length, imported: totalNew, failed: totalFailed };
  if (totalFailed > 0) {
    console.warn(`[Scanner] Scan complete with errors — ${totalNew} imported, ${totalFailed} failed out of ${allChars.length} characters`);
  } else {
    console.log(`[Scanner] Scan complete — ${totalNew} new reports imported from ${allChars.length} characters`);
  }

  return summary;
}
