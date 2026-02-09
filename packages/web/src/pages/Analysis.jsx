import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analysisAPI, charactersAPI } from '../services/api';
import OverviewSection from '../components/analysis/OverviewSection';
import BossesSection from '../components/analysis/BossesSection';
import TrendsSection from '../components/analysis/TrendsSection';
import RecommendationsSection from '../components/analysis/RecommendationsSection';
import RecentFightsSection from '../components/analysis/RecentFightsSection';
import MythicPlusSection from '../components/analysis/MythicPlusSection';

const BASE_TABS = ['overview', 'bosses', 'trends', 'recentFights', 'recommendations'];
const PERIODS = [4, 8, 12, 52];

export default function Analysis() {
  const { t } = useTranslation();
  const { characterId } = useParams();
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState(characterId ? parseInt(characterId) : null);
  const [activeTab, setActiveTab] = useState('overview');
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load characters
  useEffect(() => {
    charactersAPI.list().then(r => {
      setCharacters(r.data);
      if (!selectedCharId && r.data.length > 0) {
        const primary = r.data.find(c => c.isPrimary);
        setSelectedCharId((primary || r.data[0]).id);
      }
    });
  }, []);

  // Load analysis data
  useEffect(() => {
    if (!selectedCharId) return;
    setLoading(true);
    analysisAPI.character(selectedCharId, weeks)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedCharId, weeks]);

  const selectedChar = useMemo(
    () => characters.find(c => c.id === selectedCharId),
    [characters, selectedCharId]
  );

  // Show M+ tab only when raiderIO data exists
  const TABS = useMemo(() => {
    if (data?.raiderIO) {
      return ['overview', 'mythicPlus', 'bosses', 'trends', 'recentFights', 'recommendations'];
    }
    return BASE_TABS;
  }, [data?.raiderIO]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-cinzel text-2xl font-bold text-white">
          {t('analysis.characterAnalysis')}
        </h1>

        <div className="flex items-center gap-3">
          {/* Character selector */}
          {characters.length > 1 && (
            <select
              value={selectedCharId || ''}
              onChange={(e) => setSelectedCharId(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-void-deep border border-void-bright/20 rounded-lg text-sm text-white focus:outline-none"
            >
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.realm}</option>
              ))}
            </select>
          )}

          {/* Period selector */}
          <div className="flex bg-void-deep rounded-lg border border-void-bright/20 overflow-hidden">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setWeeks(p)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  weeks === p
                    ? 'bg-void-bright text-white'
                    : 'text-void-text hover:text-white'
                }`}
              >
                {p === 52 ? t('analysis.periodAll') : t('analysis.periodWeeks', { count: p })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* No character selected */}
      {!selectedCharId && (
        <div className="text-center py-20 text-void-text/60">
          <i className="fas fa-user-slash text-4xl mb-4" />
          <p>{t('analysis.selectCharacter')}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-void-bright border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* No data */}
      {!loading && selectedCharId && (!data || !data.summary?.totalFights) && (
        <div className="text-center py-20 text-void-text/60">
          <i className="fas fa-chart-bar text-4xl mb-4" />
          <p>{t('analysis.noFightsYet')}</p>
        </div>
      )}

      {/* Analysis content */}
      {!loading && data && data.summary?.totalFights > 0 && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-void-mid/50 rounded-xl p-1 border border-void-bright/10">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-void-bright text-white'
                    : 'text-void-text hover:text-white hover:bg-white/5'
                }`}
              >
                {tab === 'mythicPlus' ? t('raiderio.mythicPlus') : t(`analysis.${tab}`)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {activeTab === 'overview' && <OverviewSection data={data} />}
            {activeTab === 'mythicPlus' && <MythicPlusSection raiderIO={data.raiderIO} />}
            {activeTab === 'bosses' && <BossesSection data={data} />}
            {activeTab === 'trends' && <TrendsSection data={data} />}
            {activeTab === 'recentFights' && <RecentFightsSection data={data} />}
            {activeTab === 'recommendations' && <RecommendationsSection data={data} />}
          </div>
        </>
      )}
    </div>
  );
}
