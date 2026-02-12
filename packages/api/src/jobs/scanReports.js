import { db } from '../db/client.js';
import { characters, reports, fights } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getCharacterReports, getReportData, getBatchFightStats, getBatchExtendedFightStats } from '../services/wcl.js';
import { processExtendedFightData, invalidateAnalysisCache } from '../services/analysis.js';
import { acquireToken } from '../services/rateLimiter.js';

/**
 * Scan WCL for new reports for all registered characters.
 * Called periodically by the scheduler.
 */
export async function scanForNewReports() {
  console.log('[Scanner] Starting WCL report scan...');

  // Get all characters grouped by user
  const allChars = await db.select().from(characters).all();

  if (allChars.length === 0) {
    console.log('[Scanner] No characters registered, skipping scan');
    return;
  }

  let totalNew = 0;

  for (const char of allChars) {
    try {
      await acquireToken();

      const wclReports = await getCharacterReports(
        char.name,
        char.realmSlug,
        char.region,
        5 // Last 5 reports
      );

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
          const reportData = await getReportData(wclReport.code);
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
            charMap[c.name.toLowerCase()] = c.id;
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
                console.warn(`[Scanner] Fight error:`, fightErr.message);
              }
            }
          }

          // Step 2: Batch fetch stats for ALL fights (2 API calls instead of 2*N)
          if (fightMappings.length > 0) {
            await acquireToken();
            const allFightIds = fightMappings.map(f => f.wclFightId);
            const [batchBasicStats, batchExtStats] = await Promise.all([
              getBatchFightStats(wclReport.code, allFightIds),
              getBatchExtendedFightStats(wclReport.code, allFightIds),
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
                  console.warn(`[Scanner] Stats failed for fight ${mapping.wclFightId}:`, statsErr.message);
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
          console.warn(`[Scanner] Failed to import ${wclReport.code}:`, importErr.message);
        }
      }
    } catch (err) {
      console.warn(`[Scanner] Error scanning ${char.name}-${char.realmSlug}:`, err.message);
    }
  }

  console.log(`[Scanner] Scan complete. ${totalNew} new reports imported.`);
}
