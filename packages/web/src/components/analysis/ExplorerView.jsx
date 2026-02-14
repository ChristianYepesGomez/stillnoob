import CompactScoreHeader from './CompactScoreHeader';
import OverviewSection from './OverviewSection';
import BossesSection from './BossesSection';
import TrendsSection from './TrendsSection';
import RecommendationsSection from './RecommendationsSection';
import RecentFightsSection from './RecentFightsSection';
import MythicPlusSection from './MythicPlusSection';
import BuildSection from './BuildSection';

/**
 * Explorer View — the reimagined post-wrapped dashboard.
 * Replaces the old tabbed layout with a single-page, two-column grid.
 * All sections visible at once, organized by priority.
 *
 * Props:
 *   data - full analysis data object
 *   characterId - selected character ID (for BuildSection API call)
 *   onRewatch - callback to re-trigger wrapped experience
 */
export default function ExplorerView({ data, characterId, onRewatch }) {
  const hasRaiderIO = !!data.raiderIO;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Compact score header */}
      <CompactScoreHeader
        score={data.score}
        character={data.character}
        onRewatch={onRewatch}
      />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Performance data */}
        <div className="space-y-6">
          <OverviewSection data={data} />
          <BossesSection data={data} />
          {data.weeklyTrends?.length > 0 && <TrendsSection data={data} />}
        </div>

        {/* Right column: Coaching + Build */}
        <div className="space-y-6">
          <RecommendationsSection data={data} />
          <BuildSection characterId={characterId} />
          {hasRaiderIO && (
            <MythicPlusSection
              raiderIO={data.raiderIO}
              mplusAnalysis={data.mplusAnalysis}
              characterId={characterId}
            />
          )}
        </div>
      </div>

      {/* Full-width: Recent Fights */}
      {data.recentFights?.length > 0 && <RecentFightsSection data={data} />}
    </div>
  );
}
