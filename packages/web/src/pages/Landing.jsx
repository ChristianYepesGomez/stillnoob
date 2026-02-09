import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-midnight-deepblue flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="font-cinzel text-5xl md:text-6xl font-bold mb-4">
            <span className="text-midnight-glow">Still</span>
            <span className="text-white">Noob</span>
          </h1>
          <p className="text-xl text-midnight-silver mb-2">
            WoW Performance Analyzer
          </p>
          <p className="text-midnight-silver/70 mb-8 max-w-lg mx-auto">
            Analyze your Warcraft Logs data. Get actionable insights on survivability,
            consumables, DPS, and utility. Track your progress week over week.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 bg-midnight-bright-purple hover:bg-midnight-accent text-white rounded-xl font-semibold transition-colors"
            >
              {t('auth.register')}
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-midnight-silver border border-midnight-bright-purple/30 rounded-xl font-semibold transition-colors"
            >
              {t('auth.login')}
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16">
            {[
              { icon: 'fa-chart-line', title: 'Performance', desc: 'DPS trends, boss breakdowns, raid median comparison' },
              { icon: 'fa-flask', title: 'Consumables', desc: 'Flask uptime, potion usage, food buff tracking' },
              { icon: 'fa-lightbulb', title: 'Smart Tips', desc: 'Personalized recommendations based on your data' },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl bg-midnight-spaceblue/50 border border-midnight-bright-purple/10">
                <i className={`fas ${f.icon} text-2xl text-midnight-glow mb-3`} />
                <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-midnight-silver/70">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-midnight-silver/40">
        StillNoob is not affiliated with Blizzard Entertainment or Warcraft Logs.
      </footer>
    </div>
  );
}
