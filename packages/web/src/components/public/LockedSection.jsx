import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function LockedSection({ title, icon, description }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="relative rounded-2xl border border-void-bright/10 overflow-hidden">
      {/* Blurred mock content */}
      <div className="p-5 blur-[3px] opacity-30 pointer-events-none select-none" aria-hidden>
        {/* Fake score ring */}
        <div className="flex items-center gap-6 mb-5">
          <div className="w-24 h-24 rounded-full border-4 border-void-accent/40 flex items-center justify-center">
            <span className="font-orbitron text-2xl text-white">72</span>
          </div>
          <div className="space-y-2 flex-1">
            <div className="h-3 w-full bg-blue-400/30 rounded" />
            <div className="h-3 w-4/5 bg-green-400/30 rounded" />
            <div className="h-3 w-3/5 bg-purple-400/30 rounded" />
            <div className="h-3 w-2/3 bg-yellow-400/30 rounded" />
            <div className="h-3 w-4/5 bg-orange-400/30 rounded" />
          </div>
        </div>
        {/* Fake stat cards */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {['248K', '34', '0.12', '92', '108%'].map((v, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-void-deep/50">
              <p className="font-orbitron text-sm text-white">{v}</p>
            </div>
          ))}
        </div>
        {/* Fake boss table */}
        <div className="space-y-2">
          {['Vexie & the Geargrinders', 'Cauldron of Carnage', 'Rik Reverb'].map((b) => (
            <div key={b} className="flex justify-between p-2 rounded bg-void-deep/30">
              <span className="text-sm text-white">{b}</span>
              <span className="text-sm text-blue-400">185K</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-void-deep/80 via-void-mid/70 to-void-deep/90">
        <i className={`fas ${icon} text-3xl text-void-accent mb-3`} />
        <h3 className="font-cinzel text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-void-secondary text-center max-w-md px-4 mb-4">{description}</p>
        <Link
          to={user ? '/dashboard' : '/register'}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-cinzel font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          <i className="fas fa-lock-open" />
          {t('public.lockCTA')}
        </Link>
      </div>
    </div>
  );
}
