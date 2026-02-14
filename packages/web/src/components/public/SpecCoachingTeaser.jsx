import { useTranslation } from 'react-i18next';
import { getSpecCoaching } from '@stillnoob/shared';

export default function SpecCoachingTeaser({ className, spec }) {
  const { t } = useTranslation();
  const coaching = getSpecCoaching(className, spec);

  if (!coaching) return null;

  return (
    <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5 animate-fade-in">
      <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
        <i className="fas fa-graduation-cap mr-2 text-void-accent" />
        {t('public.specCoaching', { spec, className })}
      </h2>

      {/* Sample coaching tip */}
      <div className="p-4 rounded-xl bg-void-deep/50 border border-void-glow/15 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-void-glow/20 text-void-accent font-semibold uppercase">
            {t('public.specCoachingSample')}
          </span>
        </div>
        <p className="text-sm text-void-text leading-relaxed">
          <i className="fas fa-bolt text-blue-400 mr-2" />
          {coaching.lowCpm}
        </p>
      </div>

      {/* Locked hints */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-void-accent/40" />
          <span className="w-2 h-2 rounded-full bg-void-accent/40" />
        </div>
        <p className="text-xs text-void-muted">
          <i className="fas fa-lock text-void-muted/60 mr-1" />
          {t('public.specCoachingMore')}
        </p>
      </div>
    </div>
  );
}
