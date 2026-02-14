import { useState, useEffect, useRef } from 'react';

/**
 * Animated count-up number using requestAnimationFrame.
 * Props:
 *   end - target number
 *   duration - animation duration in ms (default 1200)
 *   formatter - optional function to format the displayed value
 *   trigger - whether to start the animation (default true)
 *   className - CSS classes for the number element
 */
export default function CountUp({
  end,
  duration = 1200,
  formatter,
  trigger = true,
  className = '',
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!trigger) {
      setDisplay(0);
      return;
    }

    const startTime = performance.now();
    const startVal = 0;

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (end - startVal) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update);
      }
    }

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration, trigger]);

  const formatted = formatter ? formatter(display) : Math.round(display);

  return <span className={className}>{formatted}</span>;
}
