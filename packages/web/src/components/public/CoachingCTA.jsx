import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function CoachingCTA({ issues, user, characterName }) {
  const { t } = useTranslation();
  const hasIssues = issues > 0;

  return (
    <div className="text-center py-8">
      <p className="text-lg font-cinzel font-bold text-white mb-2">
        {hasIssues
          ? t('public.ctaIssues', { count: issues, name: characterName })
          : t('public.ctaOptimized', { name: characterName })}
      </p>
      <p className="text-sm text-void-secondary mb-5">
        {hasIssues ? t('public.ctaRegister') : t('public.ctaOptimizedSub')}
      </p>
      <Link
        to={user ? '/dashboard' : '/register'}
        className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-cinzel font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
      >
        <i className="fas fa-chart-line" />
        {user ? t('nav.dashboard') : t('auth.register')}
      </Link>
    </div>
  );
}
