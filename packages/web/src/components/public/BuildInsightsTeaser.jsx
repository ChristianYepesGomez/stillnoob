import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function BuildInsightsTeaser({ buildAnalysis, mplusAnalysis }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Count detected issues across all analysis areas
  let insightCount = 0;
  const categories = [];

  if (buildAnalysis?.statAnalysis?.alignment !== 'good') {
    insightCount++;
    categories.push({ icon: 'fa-chart-pie', color: 'text-purple-400', label: 'Stats' });
  }
  if (buildAnalysis?.gearTips) {
    const gearIssues = buildAnalysis.gearTips.filter((tip) => tip.severity !== 'positive').length;
    if (gearIssues > 0) {
      insightCount += gearIssues;
      categories.push({ icon: 'fa-shield-halved', color: 'text-amber-400', label: 'Gear' });
    }
  }
  if (mplusAnalysis?.pushTargets?.length > 0) {
    insightCount++;
    categories.push({ icon: 'fa-dungeon', color: 'text-blue-400', label: 'M+' });
  }
  if (mplusAnalysis?.upgradeAnalysis?.untimed > 0) {
    insightCount++;
  }

  if (insightCount === 0) return null;

  return (
    <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5 animate-fade-in">
      <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
        <i className="fas fa-microscope mr-2 text-void-accent" />
        {t('public.buildInsights')}
      </h2>

      {/* Big insight count */}
      <div className="text-center py-4">
        <span className="font-orbitron text-4xl font-bold text-sunwell-amber">
          {insightCount}
        </span>
        <p className="text-sm text-void-secondary mt-1">
          {t('public.buildInsightsCount', { count: insightCount })}
        </p>
      </div>

      {/* Category breakdown — vague, no details */}
      {categories.length > 0 && (
        <div className="flex justify-center gap-3 mb-4">
          {categories.map((cat) => (
            <div key={cat.label} className="text-center px-4 py-2 rounded-lg bg-void-deep/50">
              <i className={`fas ${cat.icon} ${cat.color} mb-1`} />
              <p className="text-[10px] text-void-muted">{cat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lock CTA */}
      <Link
        to={user ? '/dashboard' : '/register'}
        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-void-glow/10 border border-void-glow/25 text-sm text-void-accent hover:bg-void-glow/20 transition-colors"
      >
        <i className="fas fa-lock-open text-xs" />
        {t('public.buildInsightsCTA')}
      </Link>
    </div>
  );
}
