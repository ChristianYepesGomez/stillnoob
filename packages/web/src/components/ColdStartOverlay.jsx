import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function ColdStartOverlay() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const handleDetected = () => setVisible(true);
    const handleResolved = () => {
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        setFading(false);
      }, 500);
    };

    window.addEventListener('coldstart:detected', handleDetected);
    window.addEventListener('coldstart:resolved', handleResolved);
    return () => {
      window.removeEventListener('coldstart:detected', handleDetected);
      window.removeEventListener('coldstart:resolved', handleResolved);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-void-deep/95 flex items-center justify-center px-4 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="text-center max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-6">
          <span className="font-cinzel text-2xl font-bold">
            <span className="text-void-accent">Still</span>
            <span className="text-white">Noob</span>
          </span>
        </div>

        {/* Dual spinner */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-void-surface" />
          <div className="absolute inset-0 rounded-full border-4 border-void-bright border-t-transparent animate-spin" />
          <div
            className="absolute inset-1 rounded-full border-4 border-void-glow/30 border-b-transparent animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
        </div>

        {/* Cold start messages */}
        <p className="text-void-text font-rajdhani text-base mb-2">{t('loading.wakingUp')}</p>
        <p className="text-void-muted text-xs">{t('loading.firstVisit')}</p>
      </div>
    </div>
  );
}
