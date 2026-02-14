import { motion } from 'framer-motion';
import { getClassColor } from '../shared/wrappedUtils';
import { SLIDE_COPY } from '../shared/wrappedCopy';

/**
 * Slide 0: Title Card - Character portrait + name + class + spec
 * Auto-advances after 3 seconds.
 */
export default function TitleSlide({ character, isInView }) {
  const classColor = getClassColor(character?.className);
  const portraitUrl = character?.media?.inset || character?.media?.main || character?.media?.avatar;

  return (
    <>
      {/* Background radial glow */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${classColor}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 text-center max-w-3xl px-6">
        {/* Character portrait */}
        {portraitUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative inline-block mb-6"
          >
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-110"
              style={{ backgroundColor: classColor }}
            />
            <img
              src={portraitUrl}
              alt={character?.name}
              className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full object-cover object-top border-2 shadow-2xl"
              style={{ borderColor: classColor }}
            />
          </motion.div>
        )}

        {/* Character name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: portraitUrl ? 0.3 : 0, ease: 'easeOut' }}
          className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight"
        >
          {character?.name}
        </motion.h1>

        {/* Expanding line */}
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: '40%' } : {}}
          transition={{ duration: 0.6, delay: portraitUrl ? 0.5 : 0.3, ease: 'easeOut' }}
          className="h-px mx-auto mt-5 mb-5"
          style={{ backgroundColor: classColor }}
        />

        {/* Spec + realm */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: portraitUrl ? 0.7 : 0.6 }}
          className="font-rajdhani text-lg sm:text-xl text-void-secondary tracking-wide"
        >
          {character?.spec && (
            <span style={{ color: classColor }}>{character.spec} {character.className}</span>
          )}
          {character?.spec && character?.realm && <span className="mx-3 text-void-muted">|</span>}
          {character?.realm && <span>{character.realm}</span>}
        </motion.p>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: portraitUrl ? 1.1 : 1.0 }}
          className="mt-6 text-sm text-void-muted font-rajdhani tracking-widest uppercase"
        >
          {SLIDE_COPY.title.subtitle}
        </motion.p>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: portraitUrl ? 1.6 : 1.5 }}
          className="mt-10"
        >
          <motion.i
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="fas fa-chevron-down text-void-muted text-lg"
          />
        </motion.div>
      </div>
    </>
  );
}
