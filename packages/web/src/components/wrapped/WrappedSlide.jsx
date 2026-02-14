import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';

/**
 * Generic wrapper for a single wrapped slide.
 * Handles viewport snapping, intersection detection, and background styling.
 *
 * Props:
 *   children - slide content (rendered only when in view or once triggered)
 *   index - slide index
 *   onEnterView - callback when slide enters viewport
 *   className - additional CSS classes
 *   bgClassName - background classes (default void-deep)
 */
export default function WrappedSlide({
  children,
  index,
  onEnterView,
  className = '',
  bgClassName = 'bg-void-deep',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.5, once: false });
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (isInView && onEnterView) {
      onEnterView(index);
    }
    if (isInView) {
      hasTriggered.current = true;
    }
  }, [isInView, index, onEnterView]);

  return (
    <div
      ref={ref}
      className={`wrapped-slide ${bgClassName} ${className}`}
      data-slide={index}
    >
      {(isInView || hasTriggered.current) ? children : null}
    </div>
  );
}
