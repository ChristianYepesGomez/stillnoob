import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicAPI } from '../services/api';
import { CLASS_COLORS, DIFFICULTY_COLORS } from '@stillnoob/shared';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import ScoreBadge from '../components/analysis/ScoreBadge';
import MythicPlusSection from '../components/analysis/MythicPlusSection';

function formatDps(val) {
  if (!val) return '0';
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : Math.round(val);
}

export default function CharacterPublic() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { region, realm, name } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    publicAPI
      .character(region, realm, name)
      .then((r) => setData(r.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('not_found');
        } else {
          setError('server_error');
        }
      })
      .finally(() => setLoading(false));
  }, [region, realm, name]);

  if (loading) {
    return <LoadingScreen message={t('loading.analyzing', { name })} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void-deep flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Link to="/" className="block mb-8">
            <span className="font-cinzel text-3xl font-bold">
              <span className="text-void-accent">Still</span>
              <span className="text-white">Noob</span>
            </span>
          </Link>
          <i className="fas fa-ghost text-5xl text-void-muted mb-4" />
          <h2 className="text-xl font-cinzel text-white mb-2">
            {error === 'not_found' ? 'Character Not Found' : 'Something went wrong'}
          </h2>
          <p className="text-void-secondary mb-6">
            {error === 'not_found'
              ? `We don't have data for ${name} on ${realm}-${region.toUpperCase()} yet. Import a Warcraft Logs report to get started.`
              : 'Failed to load character data. Please try again later.'}
          </p>
          <Link
            to="/register"
            className="inline-block px-6 py-3 bg-void-bright hover:bg-void-glow text-white rounded-xl font-semibold transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    );
  }

  const {
    character,
    score,
    summary,
    bossBreakdown,
    raiderIO,
    mplusAnalysis,
    buildAnalysis,
    source,
  } = data;
  const isLive = source === 'live';
  const classColor = CLASS_COLORS[character.className] || '#fff';

  return (
    <div className="min-h-screen bg-void-deep">
      {/* Navbar */}
      <nav className="bg-void-mid/80 backdrop-blur-sm border-b border-void-bright/15 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-cinzel text-xl font-bold text-void-accent">
            StillNoob
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-1.5 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {t('nav.dashboard')}
            </Link>
          ) : (
            <Link
              to="/register"
              className="px-4 py-1.5 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {t('auth.register')}
            </Link>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
        {/* Character header */}
        <div className="flex items-center gap-4 flex-wrap">
          {isLive && character.media?.avatar && (
            <img
              src={character.media.avatar}
              alt={character.name}
              className="w-14 h-14 rounded-xl border-2"
              style={{ borderColor: classColor }}
            />
          )}
          <h1 className="font-cinzel text-3xl font-bold" style={{ color: classColor }}>
            {character.name}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-void-secondary">{character.realm}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-void-surface text-void-muted uppercase">
              {character.region}
            </span>
          </div>
          {character.spec && (
            <span className="text-sm text-void-secondary">
              {character.spec} {character.className}
            </span>
          )}
          {isLive && character.equippedItemLevel && (
            <span className="text-sm font-orbitron text-sunwell-gold">
              {character.equippedItemLevel} ilvl
            </span>
          )}
        </div>

        {/* Score */}
        {score && <ScoreBadge score={score} />}

        {/* Live data banner */}
        {isLive && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-void-glow/10 to-void-bright/5 border border-void-glow/25">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-fel-green rounded-full animate-pulse" />
              <h2 className="font-cinzel text-lg font-bold text-white">Live Character Data</h2>
            </div>
            <p className="text-sm text-void-secondary mb-4">
              Showing real-time data from Blizzard API and Raider.io. Import your WarcraftLogs
              reports to unlock full coaching analysis with performance scores, boss breakdowns, and
              personalized improvement tips.
            </p>
            <Link
              to={user ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-cinzel font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <i className="fas fa-chart-line" />
              {user ? 'Import Logs in Dashboard' : 'Get Full Coaching Analysis'}
            </Link>
          </div>
        )}

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-3 rounded-xl bg-void-mid/50 border border-void-bright/10">
              <p className="font-orbitron text-xl font-bold text-blue-400">
                {formatDps(summary.avgDps)}
              </p>
              <p className="text-[10px] text-void-secondary mt-1">{t('analysis.avgDps')}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-void-mid/50 border border-void-bright/10">
              <p className="font-orbitron text-xl font-bold text-white">{summary.totalFights}</p>
              <p className="text-[10px] text-void-secondary mt-1">{t('analysis.totalFights')}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-void-mid/50 border border-void-bright/10">
              <p
                className={`font-orbitron text-xl font-bold ${summary.deathRate > 0.3 ? 'text-blood-red' : 'text-fel-green'}`}
              >
                {(summary.deathRate || 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-void-secondary mt-1">{t('analysis.deathsPerFight')}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-void-mid/50 border border-void-bright/10">
              <p
                className={`font-orbitron text-xl font-bold ${summary.consumableScore >= 70 ? 'text-fel-green' : 'text-sunwell-amber'}`}
              >
                {summary.consumableScore || 0}
              </p>
              <p className="text-[10px] text-void-secondary mt-1">
                {t('analysis.consumableScore')}
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-void-mid/50 border border-void-bright/10">
              <p
                className={`font-orbitron text-xl font-bold ${(summary.dpsVsMedianPct || 100) >= 100 ? 'text-fel-green' : 'text-blood-red'}`}
              >
                {Math.round(summary.dpsVsMedianPct || 100)}%
              </p>
              <p className="text-[10px] text-void-secondary mt-1">{t('analysis.vsMedian')}</p>
            </div>
          </div>
        )}

        {/* Mythic+ data from Raider.io */}
        {raiderIO && <MythicPlusSection raiderIO={raiderIO} compact />}

        {/* Raid progression (live mode) */}
        {isLive && raiderIO?.raidProgression?.length > 0 && (
          <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5">
            <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
              <i className="fas fa-dungeon mr-2 text-void-accent" />
              Raid Progression
            </h2>
            <div className="space-y-2">
              {raiderIO.raidProgression.map((raid) => (
                <div
                  key={raid.slug}
                  className="flex items-center justify-between p-3 rounded-xl bg-void-deep/50 border border-void-bright/5"
                >
                  <span className="text-sm text-white font-medium">
                    {raid.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-sm font-orbitron text-void-accent">{raid.raid}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boss breakdown */}
        {bossBreakdown?.length > 0 && (
          <div className="bg-void-mid/50 rounded-2xl border border-void-bright/10 p-5">
            <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
              <i className="fas fa-skull mr-2 text-void-accent" />
              {t('analysis.bosses')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-void-secondary/70 border-b border-void-bright/10 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Boss</th>
                    <th className="text-center py-2 px-3">Diff</th>
                    <th className="text-center py-2 px-3">{t('common.fights')}</th>
                    <th className="text-center py-2 px-3">{t('analysis.avgDps')}</th>
                    <th className="text-center py-2 px-3">{t('analysis.bestDps')}</th>
                    <th className="text-center py-2 px-3">{t('analysis.deathsPerFight')}</th>
                    <th className="text-center py-2 px-3 hidden sm:table-cell">
                      {t('analysis.vsMedian')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bossBreakdown.map((b, i) => (
                    <tr key={i} className="border-b border-void-bright/5 hover:bg-void-surface/30">
                      <td className="py-2.5 px-3 text-white font-medium">{b.bossName}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            backgroundColor: `${DIFFICULTY_COLORS[b.difficulty]}20`,
                            color: DIFFICULTY_COLORS[b.difficulty],
                          }}
                        >
                          {b.difficulty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-void-text">{b.fights}</td>
                      <td className="py-2.5 px-3 text-center font-orbitron text-blue-400">
                        {formatDps(b.avgDps)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-orbitron text-void-accent">
                        {formatDps(b.bestDps)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={b.deathRate > 0.3 ? 'text-blood-red' : 'text-fel-green'}>
                          {b.deathRate.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                        <span
                          className={
                            b.dpsVsMedian >= 100
                              ? 'text-fel-green'
                              : b.dpsVsMedian >= 80
                                ? 'text-sunwell-amber'
                                : 'text-blood-red'
                          }
                        >
                          {Math.round(b.dpsVsMedian || 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-8">
          <p className="text-void-secondary mb-4">
            Want detailed fight-by-fight analysis and coaching tips?
          </p>
          <Link
            to={user ? '/dashboard' : '/register'}
            className="inline-block px-8 py-3 bg-gradient-to-r from-void-glow to-void-bright text-white rounded-xl font-cinzel font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            {user ? 'Go to Dashboard' : 'Analyze Your Character Free'}
          </Link>
        </div>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-void-muted border-t border-void-bright/10">
          <p>
            {isLive
              ? 'Data from Blizzard API and Raider.io. Shown in real-time.'
              : `Data from public Warcraft Logs reports. Last updated: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : 'N/A'}`}
          </p>
          <p className="mt-1">
            StillNoob is not affiliated with Blizzard Entertainment or Warcraft Logs.
          </p>
        </footer>
      </main>
    </div>
  );
}
