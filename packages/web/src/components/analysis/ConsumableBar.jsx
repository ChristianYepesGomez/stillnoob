export default function ConsumableBar({ label, pct }) {
  const val = Math.round(pct || 0);
  const color = val >= 80 ? '#22c55e' : val >= 50 ? '#eab308' : '#ef4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-void-text truncate">{label}</span>
        <span className="text-[10px] font-bold" style={{ color }}>{val}%</span>
      </div>
      <div className="h-2 bg-void-surface/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
