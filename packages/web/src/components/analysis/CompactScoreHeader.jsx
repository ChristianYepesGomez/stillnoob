/**
 * Compact score display for Explorer view header.
 * Shows a small ring + score number + tier badge inline.
 */
export default function CompactScoreHeader({ score, character, onRewatch }) {
  if (!score) return null;

  const tierColor = score.tier?.color || '#888';
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.total / 100) * circumference;

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-xl bg-void-mid/50 border border-void-bright/10">
      <div className="flex items-center gap-4">
        {/* Mini score ring */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg width={48} height={48} className="absolute -rotate-90">
            <circle
              cx={24} cy={24} r={radius}
              fill="none" stroke="rgba(92,79,115,0.3)" strokeWidth={4}
            />
            <circle
              cx={24} cy={24} r={radius}
              fill="none" stroke={tierColor} strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="relative font-orbitron text-sm font-bold text-white">
            {Math.round(score.total)}
          </span>
        </div>

        {/* Character info + tier */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-cinzel text-lg font-bold text-white">
              {character?.name}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-lg font-semibold"
              style={{ backgroundColor: tierColor + '20', color: tierColor }}
            >
              {score.tier?.label}
            </span>
          </div>
          {character?.spec && (
            <p className="text-xs text-void-secondary">
              {character.spec} {character.className}
            </p>
          )}
        </div>
      </div>

      {/* Re-watch button */}
      {onRewatch && (
        <button
          onClick={onRewatch}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-void-muted hover:text-void-accent border border-void-bright/15 hover:border-void-bright/30 rounded-lg transition-all"
        >
          <i className="fas fa-play text-[10px]" />
          Re-watch Wrapped
        </button>
      )}
    </div>
  );
}
