import { motion } from 'framer-motion';
import CountUp from '../shared/CountUp';

/**
 * Slide 1: The Journey - Total fights analyzed
 */
export default function JourneySlide({ summary, weeklyTrends, isInView }) {
  const totalFights = summary?.totalFights || 0;

  // Date range from weekly trends
  const firstWeek = weeklyTrends?.[0]?.weekStart;
  const lastWeek = weeklyTrends?.[weeklyTrends.length - 1]?.weekStart;
  const dateRange = firstWeek && lastWeek
    ? `${new Date(firstWeek).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(lastWeek).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : null;

  return (
    <div className="text-center max-w-md px-6">
      {/* Big number */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <CountUp
          end={totalFights}
          duration={1200}
          trigger={isInView}
          className="font-orbitron text-6xl sm:text-8xl font-bold text-white"
        />
      </motion.div>

      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-4 font-rajdhani text-xl sm:text-2xl text-void-secondary tracking-wider uppercase"
      >
        fights analyzed
      </motion.p>

      {/* Date range */}
      {dateRange && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="mt-6 text-sm text-void-muted"
        >
          {dateRange}
        </motion.p>
      )}
    </div>
  );
}
