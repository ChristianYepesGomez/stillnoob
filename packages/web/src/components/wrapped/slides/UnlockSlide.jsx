import { motion } from 'framer-motion';
import { SLIDE_COPY } from '../shared/wrappedCopy';

/**
 * Slide 10: Unlock Animation - Transition to Explorer Mode
 * Also used as CTA slide for public/unauthenticated users.
 */
export default function UnlockSlide({ isInView, isPublic, onComplete }) {
  const copy = isPublic ? SLIDE_COPY.cta : SLIDE_COPY.unlock;

  return (
    <div className="text-center max-w-md px-6">
      {/* Key icon */}
      {!isPublic && (
        <motion.div
          initial={{ opacity: 0, rotate: 0 }}
          animate={isInView ? { opacity: 1, rotate: 360 } : {}}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="mb-8"
        >
          <i className="fas fa-key text-5xl text-void-accent" />
        </motion.div>
      )}

      {/* Headline */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: isPublic ? 0.2 : 0.6 }}
        className="font-cinzel text-2xl sm:text-3xl font-bold text-white"
      >
        {copy.headline}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: isPublic ? 0.5 : 0.9 }}
        className="mt-3 text-sm text-void-secondary"
      >
        {copy.subtitle}
      </motion.p>

      {/* Public CTA button */}
      {isPublic && (
        <motion.a
          href="/register"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="mt-8 inline-block px-8 py-3 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-cinzel font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          {copy.button}
        </motion.a>
      )}

      {/* Auto-transition for authenticated users */}
      {!isPublic && isInView && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0 }}
          onAnimationComplete={onComplete}
          className="mt-8"
        >
          <div className="w-8 h-8 mx-auto border-2 border-void-bright border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  );
}
