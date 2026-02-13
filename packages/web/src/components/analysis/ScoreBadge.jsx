import { useTranslation } from 'react-i18next';
import { SCORE_WEIGHTS } from '@stillnoob/shared';

const BREAKDOWN_KEYS = ['performance', 'survival', 'preparation', 'utility', 'consistency'];
const BREAKDOWN_COLORS = {
  performance: '#60a5fa',
  survival: '#22c55e',
  preparation: '#c084fc',
  utility: '#f6c843',
  consistency: '#ff9f1c',
};

export default function ScoreBadge({ score }) {
  const { t } = useTranslation();

  if (!score || !score.tier) return null;

  const { total, tier, breakdown } = score;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (total / 100) * circumference;

  return (
    <div className="bg-void-mid/60 rounded-2xl border border-void-bright/15 p-6 animate-fade-in">
      <div className="flex items-center gap-8 flex-col sm:flex-row">
        {/* Score ring */}
        <div className="relative flex-shrink-0">
          <svg width="140" height="140" className="transform -rotate-90">
            <circle cx="70" cy="70" r="54" fill="none" stroke="#1a0f2e" strokeWidth="10" />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={tier.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-orbitron text-3xl font-bold" style={{ color: tier.color }}>
              {total}
            </span>
            <span className="text-[10px] text-void-secondary uppercase tracking-wider">/100</span>
          </div>
        </div>

        {/* Tier + breakdown */}
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="font-cinzel text-lg font-bold uppercase tracking-wider"
              style={{ color: tier.color }}
            >
              {t(`score.${tier.name.toLowerCase()}`)}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-semibold"
              style={{
                borderColor: `${tier.color}40`,
                color: tier.color,
                backgroundColor: `${tier.color}15`,
              }}
            >
              {t('analysis.stillnoobScore')}
            </span>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-2">
            {BREAKDOWN_KEYS.map((key) => {
              const value = breakdown?.[key] || 0;
              const weight = Math.round(SCORE_WEIGHTS[key] * 100);
              const color = BREAKDOWN_COLORS[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-void-secondary w-20 truncate uppercase tracking-wider">
                    {t(`analysis.score${key.charAt(0).toUpperCase() + key.slice(1)}`)}
                  </span>
                  <div className="flex-1 h-2 bg-void-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${value}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right" style={{ color }}>
                    {value}
                  </span>
                  <span className="text-[9px] text-void-muted w-8">{weight}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
