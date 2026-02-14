import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CLASS_COLORS } from '@stillnoob/shared';
import WrappedSlide from './WrappedSlide';
import SlideIndicator from './shared/SlideIndicator';
import { getSlideSequence, getPlayerRole, markWrappedComplete, getClassColor } from './shared/wrappedUtils';

// Slide components
import TitleSlide from './slides/TitleSlide';
import JourneySlide from './slides/JourneySlide';
import PowerSlide from './slides/PowerSlide';
import SurvivalSlide from './slides/SurvivalSlide';
import PreparationSlide from './slides/PreparationSlide';
import BossSpotlightSlide from './slides/BossSpotlightSlide';
import GrowthSlide from './slides/GrowthSlide';
import MythicPlusSlide from './slides/MythicPlusSlide';
import ScoreRevealSlide from './slides/ScoreRevealSlide';
import CoachingPathSlide from './slides/CoachingPathSlide';
import UnlockSlide from './slides/UnlockSlide';
import BuildCheckSlide from './slides/BuildCheckSlide';

/**
 * Main Wrapped Experience orchestrator.
 *
 * Props:
 *   data - analysis data object
 *   identifier - localStorage key identifier (characterId or region-realm-name)
 *   isPublicLive - whether this is a public live (Blizzard) data view
 *   isPublic - whether this is any public view (no auth)
 *   onComplete - callback when wrapped finishes → transition to Explorer
 *   onSkip - callback to skip wrapped immediately
 */
export default function WrappedExperience({
  data,
  identifier,
  isPublicLive = false,
  isPublic = false,
  onComplete,
  onSkip,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef(null);

  const slides = getSlideSequence(data, isPublicLive);
  const role = getPlayerRole(data);
  const classColor = getClassColor(data.character?.className);

  const handleSlideEnter = useCallback((index) => {
    setCurrentSlide(index);
  }, []);

  const handleComplete = useCallback(() => {
    markWrappedComplete(identifier, data);
    onComplete?.();
  }, [identifier, data, onComplete]);

  const handleRewatch = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleExplore = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (!containerRef.current) return;
      const slideElements = containerRef.current.querySelectorAll('[data-slide]');
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        const next = Math.min(currentSlide + 1, slideElements.length - 1);
        slideElements[next]?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(currentSlide - 1, 0);
        slideElements[prev]?.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'Escape') {
        onSkip?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, onSkip]);

  // Render the right component for each slide key
  function renderSlide(key, index) {
    const isInView = currentSlide === index;

    const slideMap = {
      title: (
        <TitleSlide character={data.character} isInView={isInView} />
      ),
      journey: (
        <JourneySlide
          summary={data.summary}
          weeklyTrends={data.weeklyTrends}
          isInView={isInView}
        />
      ),
      power: (
        <PowerSlide summary={data.summary} role={role} isInView={isInView} />
      ),
      survival: (
        <SurvivalSlide
          summary={data.summary}
          bossBreakdown={data.bossBreakdown}
          isInView={isInView}
        />
      ),
      preparation: (
        <PreparationSlide summary={data.summary} isInView={isInView} />
      ),
      bossSpotlight: (
        <BossSpotlightSlide bossBreakdown={data.bossBreakdown} isInView={isInView} />
      ),
      growth: (
        <GrowthSlide weeklyTrends={data.weeklyTrends} isInView={isInView} />
      ),
      mythicPlus: (
        <MythicPlusSlide
          raiderIO={data.raiderIO}
          mplusAnalysis={data.mplusAnalysis}
          isInView={isInView}
        />
      ),
      scoreReveal: (
        <ScoreRevealSlide score={data.score} isInView={isInView} />
      ),
      coachingPath: (
        <CoachingPathSlide
          recommendations={data.recommendations}
          isInView={isInView}
          onExplore={handleExplore}
          onRewatch={handleRewatch}
        />
      ),
      unlock: (
        <UnlockSlide
          isInView={isInView}
          isPublic={isPublic}
          onComplete={handleComplete}
        />
      ),
      'build-check': (
        <BuildCheckSlide buildAnalysis={data.buildAnalysis} isInView={isInView} />
      ),
      cta: (
        <UnlockSlide isInView={isInView} isPublic onComplete={handleComplete} />
      ),
    };

    return slideMap[key] || null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-40"
      >
        {/* Skip button */}
        <button
          onClick={onSkip || handleExplore}
          className="fixed top-4 right-16 z-50 px-3 py-1.5 text-xs text-void-muted hover:text-white bg-void-deep/80 backdrop-blur-sm rounded-lg border border-void-bright/10 hover:border-void-bright/30 transition-all"
        >
          Skip <span className="text-void-muted/50 ml-1">ESC</span>
        </button>

        {/* Slide indicators */}
        <SlideIndicator total={slides.length} current={currentSlide} color={classColor} />

        {/* Scroll container */}
        <div
          ref={containerRef}
          className="wrapped-container"
          style={{ '--class-color': classColor }}
        >
          {slides.map((key, i) => (
            <WrappedSlide
              key={key}
              index={i}
              onEnterView={handleSlideEnter}
            >
              {renderSlide(key, i)}
            </WrappedSlide>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
