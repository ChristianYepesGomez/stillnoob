import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { charactersAPI, reportsAPI, authAPI } from '../services/api';
import { CLASS_COLORS } from '@stillnoob/shared';
import api from '../services/api';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [reports, setReports] = useState([]);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      charactersAPI.list().then((r) => setCharacters(r.data)),
      reportsAPI.list().then((r) => setReports(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await reportsAPI.import(importUrl.trim());
      setImportResult({ success: true, data });
      setImportUrl('');
      // Refresh reports list
      const { data: updated } = await reportsAPI.list();
      setReports(updated);
    } catch (err) {
      setImportResult({ success: false, error: err.response?.data?.error || t('common.error') });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-void-bright border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-cinzel text-2xl font-bold text-white">
        {t('dashboard.welcome', { name: user?.displayName || 'Player' })}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Report */}
        <div className="bg-void-mid/50 border border-void-bright/15 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-file-import mr-2 text-void-accent" />
            {t('reports.import')}
          </h2>
          <form onSubmit={handleImport} className="flex gap-2">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder={t('reports.urlPlaceholder')}
              className="flex-1 px-3 py-2 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white placeholder-void-text/40 focus:border-void-bright focus:outline-none"
            />
            <button
              type="submit"
              disabled={importing}
              className="px-4 py-2 bg-void-bright hover:bg-void-glow text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {importing ? (
                <i className="fas fa-spinner fa-spin" />
              ) : (
                <i className="fas fa-download" />
              )}
            </button>
          </form>

          {importResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-sm ${
                importResult.success
                  ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                  : 'bg-red-900/20 border border-red-500/30 text-red-400'
              }`}
            >
              {importResult.success
                ? `${t('reports.processed')} — ${t('reports.fights', { count: importResult.data.stats.fightsProcessed })}`
                : importResult.error}
            </div>
          )}
        </div>

        {/* My Characters */}
        <div className="bg-void-mid/50 border border-void-bright/15 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-users mr-2 text-void-accent" />
            {t('dashboard.myCharacters')}
          </h2>
          {characters.length === 0 ? (
            <p className="text-sm text-void-text/60">{t('dashboard.noCharacters')}</p>
          ) : (
            <div className="space-y-2">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => navigate(`/analysis/${char.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 hover:bg-void-surface/10 border border-void-bright/10 transition-colors text-left"
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: CLASS_COLORS[char.className] || '#fff' }}
                  >
                    {char.name}
                  </span>
                  <span className="text-xs text-void-text/60">{char.realm}</span>
                  <span className="text-xs text-void-text/40 ml-auto">
                    {char.spec || char.className}
                  </span>
                  {char.isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-void-bright/20 text-void-accent rounded">
                      {t('characters.primary')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <div className="bg-void-mid/50 border border-void-bright/15 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-scroll mr-2 text-void-accent" />
            {t('dashboard.recentReports')}
          </h2>
          {reports.length === 0 ? (
            <p className="text-sm text-void-text/60">{t('dashboard.noReports')}</p>
          ) : (
            <div className="space-y-2">
              {reports.slice(0, 10).map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-void-deep/50 border border-void-bright/10"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {report.title || report.wclCode}
                    </p>
                    <p className="text-xs text-void-text/60">{report.zoneName}</p>
                  </div>
                  <span className="text-xs text-void-text/40">
                    {report.processedAt ? new Date(report.processedAt).toLocaleDateString() : '—'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      report.importSource === 'auto'
                        ? 'bg-blue-900/20 text-blue-400'
                        : 'bg-void-surface/20 text-void-text'
                    }`}
                  >
                    {t(`reports.${report.importSource || 'manual'}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Linking */}
        <div className="bg-void-mid/50 border border-void-bright/15 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-void-text uppercase tracking-wider mb-4">
            <i className="fas fa-link mr-2 text-void-accent" />
            {t('auth.linkAccounts')}
          </h2>
          <div className="space-y-3">
            {/* WCL Link */}
            <button
              onClick={async () => {
                try {
                  const { data } = await api.get('/auth/wcl/link');
                  window.location.href = data.url;
                } catch {
                  /* WCL not configured */
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 border border-void-bright/10 hover:border-void-bright/30 transition-colors text-left"
            >
              <i className="fas fa-scroll text-orange-400 w-5 text-center" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{t('auth.linkWcl')}</p>
                <p className="text-[10px] text-void-secondary">{t('auth.linkWclDesc')}</p>
              </div>
              <i className="fas fa-external-link-alt text-void-muted text-xs" />
            </button>

            {/* Blizzard Link */}
            <button
              onClick={async () => {
                try {
                  const { data } = await api.get('/auth/blizzard/link');
                  window.location.href = data.url;
                } catch {
                  /* Blizzard not configured */
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-void-deep/50 border border-void-bright/10 hover:border-void-bright/30 transition-colors text-left"
            >
              <i className="fas fa-gamepad text-blue-400 w-5 text-center" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{t('auth.linkBlizzard')}</p>
                <p className="text-[10px] text-void-secondary">{t('auth.linkBlizzardDesc')}</p>
              </div>
              <i className="fas fa-external-link-alt text-void-muted text-xs" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
