/**
 * Dot indicators showing wrapped progress (fixed position).
 * Props:
 *   total - total number of slides
 *   current - current active slide index
 *   color - active dot color (default void-bright)
 */
export default function SlideIndicator({ total, current, color = '#9d5cff' }) {
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all duration-300"
          style={{
            backgroundColor: i === current ? color : 'rgba(154, 139, 181, 0.3)',
            transform: i === current ? 'scale(1.4)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}
