import { CLASS_COLORS, WCL_PARSE_COLORS, MPLUS_BRACKETS } from '@stillnoob/shared';

/**
 * Compute a simple hash of the data to detect meaningful changes.
 * Changes in total fights, DPS (rounded to 100), or score trigger re-wrapped.
 */
export function computeDataHash(data) {
  const fights = data.summary?.totalFights || 0;
  const dps = Math.round((data.summary?.avgDps || 0) / 100);
  const score = data.score?.total || 0;
  return `${fights}-${dps}-${score}`;
}

/**
 * Get the localStorage key for wrapped state.
 */
function getWrappedKey(identifier) {
  return `stillnoob-wrapped-${identifier}`;
}

/**
 * Check if wrapped should be shown for this data.
 * Returns true on first visit or when data changed significantly.
 */
export function shouldShowWrapped(identifier, data) {
  try {
    const raw = localStorage.getItem(getWrappedKey(identifier));
    if (!raw) return true;
    const state = JSON.parse(raw);
    const currentHash = computeDataHash(data);
    return state.dataHash !== currentHash;
  } catch {
    return true;
  }
}

/**
 * Mark wrapped as completed for this identifier.
 */
export function markWrappedComplete(identifier, data) {
  try {
    localStorage.setItem(
      getWrappedKey(identifier),
      JSON.stringify({
        completedAt: new Date().toISOString(),
        dataHash: computeDataHash(data),
      }),
    );
  } catch {
    // localStorage unavailable, silently fail
  }
}

/**
 * Get the tone for a metric based on thresholds.
 * Returns: 'celebratory' | 'positive' | 'neutral' | 'constructive'
 */
export function getTone(value, thresholds) {
  const { celebratory, positive, neutral } = thresholds;
  if (value >= celebratory) return 'celebratory';
  if (value >= positive) return 'positive';
  if (value >= neutral) return 'neutral';
  return 'constructive';
}

/** Tone colors for accents */
export const TONE_COLORS = {
  celebratory: '#00ff88',
  positive: '#60a5fa',
  neutral: '#9a8bb5',
  constructive: '#ff9f1c',
};

/**
 * Get class color with fallback.
 */
export function getClassColor(className) {
  return CLASS_COLORS[className] || '#9d5cff';
}

/**
 * Get the WCL parse color for a percentile value.
 */
export function getParseColor(percentile) {
  if (percentile == null) return '#666666';
  for (const tier of Object.values(WCL_PARSE_COLORS)) {
    if (percentile >= tier.min && percentile <= tier.max) return tier.color;
  }
  return '#666666';
}

/**
 * Get M+ bracket for a score.
 */
export function getMPlusBracket(score) {
  for (const bracket of MPLUS_BRACKETS) {
    if (score >= bracket.min && score <= bracket.max) return bracket;
  }
  return MPLUS_BRACKETS[0];
}

/**
 * Determine the player's role from available data.
 */
export function getPlayerRole(data) {
  if (data.raiderIO?.profile?.role) return data.raiderIO.profile.role.toLowerCase();
  // Fallback: check if HPS >> DPS
  if (data.summary?.avgHps > data.summary?.avgDps) return 'healer';
  return 'dps';
}

/**
 * Build the list of slides to show based on available data.
 * Returns array of slide keys.
 */
export function getSlideSequence(data, isPublicLive = false) {
  const slides = ['title'];

  if (isPublicLive) {
    // Limited data: gear + M+ focused
    if (data.buildAnalysis) slides.push('build-check');
    if (data.raiderIO) slides.push('mythicPlus');
    slides.push('cta');
    return slides;
  }

  // Full or public-db flow
  if (data.summary) {
    slides.push('journey', 'power', 'survival', 'preparation');
  }
  if (data.bossBreakdown?.length >= 2) {
    slides.push('bossSpotlight');
  }
  if (data.weeklyTrends?.length >= 2) {
    slides.push('growth');
  }
  if (data.raiderIO) {
    slides.push('mythicPlus');
  }
  if (data.score) {
    slides.push('scoreReveal');
  }
  if (data.recommendations?.primaryTips?.length > 0) {
    slides.push('coachingPath');
  }
  slides.push('unlock');

  return slides;
}

/**
 * Format a large number with K suffix.
 */
export function formatBigNumber(val) {
  if (!val) return '0';
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return Math.round(val).toString();
}
