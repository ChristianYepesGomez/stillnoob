/**
 * Tone-adaptive copy for each wrapped slide.
 * Each entry has variants for: celebratory, positive, neutral, constructive.
 */

export const SLIDE_COPY = {
  title: {
    subtitle: "Let's see how you're doing",
  },

  journey: {
    label: 'fights analyzed',
  },

  power: {
    celebratory: { headline: 'Crushing it', subtitle: 'You outperform most of your raid' },
    positive: { headline: 'Above average', subtitle: "You're pulling your weight and then some" },
    neutral: { headline: 'Room to grow', subtitle: 'Solid foundation, keep pushing' },
    constructive: { headline: 'Your journey starts here', subtitle: "Every pro started where you are" },
  },

  survival: {
    celebratory: { headline: 'Unkillable', icon: 'fa-shield-halved', subtitle: 'Death barely knows your name' },
    positive: { headline: 'Staying alive', icon: 'fa-shield-halved', subtitle: 'Good awareness, few mistakes' },
    neutral: { headline: 'Watch your step', icon: 'fa-skull-crossbones', subtitle: 'Some fights are costing you' },
    constructive: { headline: 'Glass cannon', icon: 'fa-skull-crossbones', subtitle: "Can't DPS if you're dead" },
  },

  preparation: {
    celebratory: { headline: 'Always prepared', subtitle: 'Your raid leader loves you' },
    positive: { headline: 'Well stocked', subtitle: 'Almost perfect preparation' },
    neutral: { headline: 'Room for improvement', subtitle: "A few consumables could make the difference" },
    constructive: { headline: 'Your raid leader is watching', subtitle: 'Consumables are free performance' },
  },

  bossSpotlight: {
    domain: 'YOUR DOMAIN',
    nemesis: 'YOUR NEMESIS',
  },

  growth: {
    celebratory: { headline: 'On the rise', subtitle: 'Your numbers are trending up across the board' },
    positive: { headline: 'Steady progress', subtitle: 'Improvement in key areas' },
    neutral: { headline: 'Mixed signals', subtitle: 'Some areas up, some down' },
    constructive: { headline: 'Time to refocus', subtitle: "Let's find what's holding you back" },
  },

  mythicPlus: {
    headline: 'Keystone Identity',
  },

  scoreReveal: {
    subtitle: 'Your StillNoob Score',
  },

  coachingPath: {
    headline: 'Your Path Forward',
    exploreButton: 'Explore Full Analysis',
    rewatchButton: 'Watch Again',
  },

  unlock: {
    headline: 'Explorer Mode Unlocked',
    subtitle: 'Dive deeper into your data',
  },

  cta: {
    headline: 'Want the full picture?',
    subtitle: 'Register free for detailed fight analysis and coaching tips',
    button: 'Get Started Free',
  },
};

/**
 * Get the copy for a slide + tone.
 */
export function getSlideCopy(slideKey, tone = 'neutral') {
  const copy = SLIDE_COPY[slideKey];
  if (!copy) return {};
  // If the copy has tone variants, pick the right one
  if (copy[tone]) return { ...copy, ...copy[tone] };
  return copy;
}
