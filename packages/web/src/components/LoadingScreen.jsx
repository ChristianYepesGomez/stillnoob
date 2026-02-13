import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SLOW_THRESHOLD_MS = 4000;
const VERY_SLOW_THRESHOLD_MS = 12000;

export default function LoadingScreen({ message }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('loading'); // loading | slow | verySlow

  useEffect(() => {
    const slowTimer = setTimeout(() => setPhase('slow'), SLOW_THRESHOLD_MS);
    const verySlowTimer = setTimeout(() => setPhase('verySlow'), VERY_SLOW_THRESHOLD_MS);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(verySlowTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-void-deep flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Animated logo */}
        <div className="mb-6">
          <span className="font-cinzel text-2xl font-bold">
            <span className="text-void-accent">Still</span>
            <span className="text-white">Noob</span>
          </span>
        </div>

        {/* Spinner ring */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-void-surface" />
          <div className="absolute inset-0 rounded-full border-4 border-void-bright border-t-transparent animate-spin" />
          {phase !== 'loading' && (
            <div
              className="absolute inset-1 rounded-full border-4 border-void-glow/30 border-b-transparent animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
          )}
        </div>

        {/* Primary message */}
        <p className="text-void-text font-rajdhani text-base mb-2">
          {message || t('common.loading')}
        </p>

        {/* Cold start messages */}
        {phase === 'slow' && (
          <p className="text-void-secondary text-sm animate-fade-in">{t('loading.wakingUp')}</p>
        )}
        {phase === 'verySlow' && (
          <div className="animate-fade-in space-y-2">
            <p className="text-void-secondary text-sm">{t('loading.wakingUp')}</p>
            <p className="text-void-muted text-xs">{t('loading.firstVisit')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
