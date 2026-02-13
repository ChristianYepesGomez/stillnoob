import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { analysisAPI, publicAPI } from '../../services/api';
import { SEVERITY_STYLES, CATEGORY_STYLES } from '@stillnoob/shared';

const STAT_COLORS = {
  prioritized: '#22c55e', // green-500
  secondary: '#f59e0b', // amber-500
  low: '#6b7280', // gray-500
};

/** Map enchantable slot key to a display-friendly name */
const SLOT_LABELS = {
  head: 'Head',
  neck: 'Neck',
  shoulder: 'Shoulder',
  back: 'Back',
  chest: 'Chest',
  wrist: 'Wrist',
  hands: 'Hands',
  waist: 'Waist',
  legs: 'Legs',
  feet: 'Feet',
  finger1: 'Ring 1',
  finger2: 'Ring 2',
  trinket1: 'Trinket 1',
  trinket2: 'Trinket 2',
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
};

function getStatColor(stat, specPriority) {
  if (!specPriority) return STAT_COLORS.low;
  const rank = specPriority.indexOf(stat);
  if (rank === 0 || rank === 1) return STAT_COLORS.prioritized;
  if (rank === 2) return STAT_COLORS.secondary;
  return STAT_COLORS.low;
}

function getAlignmentStyle(alignment) {
  switch (alignment) {
    case 'good':
      return 'bg-green-900/30 text-green-400 border-green-500/30';
    case 'mixed':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30';
    case 'poor':
      return 'bg-red-900/30 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-900/30 text-gray-400 border-gray-500/30';
  }
}

function TipCard({ tip, t }) {
  const sevStyle = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${sevStyle.bg} ${sevStyle.border}`}
    >
      <i className={`fas ${sevStyle.icon} ${sevStyle.color} mt-0.5`} />
      <div className="flex-1">
        <p className="text-sm text-white">{t(`rec.${tip.key}`, tip.data)}</p>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sevStyle.color}`}>
        {t(`severity.${tip.severity}`)}
      </span>
    </div>
  );
}

function StatDistributionSection({ statAnalysis, t }) {
  const chartData = useMemo(() => {
    if (!statAnalysis?.distribution) return [];
    const { distribution, specPriority } = statAnalysis;
    return Object.entries(distribution).map(([stat, pct]) => ({
      stat: stat.charAt(0).toUpperCase() + stat.slice(1),
      statKey: stat,
      pct: Math.round(pct * 10) / 10,
      color: getStatColor(stat, specPriority),
    }));
  }, [statAnalysis]);

  const priorityText = useMemo(() => {
    if (!statAnalysis?.specPriority) return '';
    return statAnalysis.specPriority.join(' > ');
  }, [statAnalysis?.specPriority]);

  if (!statAnalysis) return null;

  return (
    <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          <i className="fas fa-chart-bar mr-2 text-blue-400" />
          {t('analysis.statDistribution')}
        </h3>
        {statAnalysis.alignment && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getAlignmentStyle(statAnalysis.alignment)}`}
          >
            {t(
              `analysis.alignment${statAnalysis.alignment.charAt(0).toUpperCase() + statAnalysis.alignment.slice(1)}`,
            )}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a0f2e" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="stat"
            tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'Orbitron' }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d0a1a',
              border: '1px solid #2d1f4e',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fff', fontFamily: 'Orbitron' }}
            formatter={(value) => [`${value}%`, 'Distribution']}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {priorityText && (
        <p className="text-xs text-void-secondary mt-3">
          {t('analysis.specPriority', { priority: priorityText })}
        </p>
      )}
    </div>
  );
}

function EnchantAuditSection({ enchantAudit, t }) {
  if (!enchantAudit) return null;

  const allSlots = [...(enchantAudit.present || []), ...(enchantAudit.missing || [])];

  return (
    <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          <i className="fas fa-magic mr-2 text-purple-400" />
          {t('analysis.enchantAudit')}
        </h3>
        <span className="font-orbitron text-sm text-white">
          {enchantAudit.enchanted}/{enchantAudit.total}{' '}
          <span className="text-void-secondary text-xs">{t('analysis.enchanted')}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {allSlots.map((slot) => {
          const isPresent = enchantAudit.present?.includes(slot);
          return (
            <div
              key={slot}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                isPresent
                  ? 'bg-green-900/10 border-green-500/20'
                  : 'bg-red-900/10 border-red-500/20'
              }`}
            >
              <i
                className={`fas ${isPresent ? 'fa-check-circle text-green-400' : 'fa-times-circle text-red-400'} text-sm`}
              />
              <span className={`text-sm ${isPresent ? 'text-gray-400' : 'text-white'}`}>
                {SLOT_LABELS[slot] || slot}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GemAuditSection({ gemAudit, t }) {
  if (!gemAudit) return null;

  return (
    <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          <i className="fas fa-gem mr-2 text-cyan-400" />
          {t('analysis.gemAudit')}
        </h3>
        <span className="font-orbitron text-sm text-white">
          {gemAudit.filled}/{gemAudit.totalSockets}{' '}
          <span className="text-void-secondary text-xs">{t('analysis.filled')}</span>
        </span>
      </div>

      {gemAudit.totalSockets === 0 ? (
        <p className="text-sm text-void-secondary">{t('common.noData')}</p>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filled sockets */}
          {Array.from({ length: gemAudit.filled }).map((_, i) => (
            <div
              key={`filled-${i}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-900/10 border border-green-500/20"
            >
              <i className="fas fa-gem text-green-400 text-sm" />
              <span className="text-sm text-gray-400">{t('analysis.filled')}</span>
            </div>
          ))}
          {/* Empty sockets */}
          {(gemAudit.emptySlots || []).map((slot) => (
            <div
              key={`empty-${slot}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/10 border border-red-500/20"
            >
              <i className="far fa-gem text-red-400 text-sm" />
              <span className="text-sm text-white">{SLOT_LABELS[slot] || slot}</span>
              <span className="text-[10px] text-red-400">{t('analysis.empty')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GearTipsSection({ gearTips, t }) {
  const sortedTips = useMemo(() => {
    if (!gearTips?.length) return [];
    const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
    return [...gearTips].sort(
      (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4),
    );
  }, [gearTips]);

  if (!sortedTips.length) return null;

  return (
    <div className="bg-void-mid/30 rounded-xl border border-void-bright/10 p-4">
      <div className="flex items-center gap-2 mb-4">
        <i
          className={`fas ${CATEGORY_STYLES.gear?.icon || 'fa-shield-halved'} ${CATEGORY_STYLES.gear?.color || 'text-amber-400'}`}
        />
        <h3 className="text-sm font-semibold text-void-text uppercase tracking-wider">
          {t('categories.gear')}
        </h3>
      </div>

      <div className="space-y-2">
        {sortedTips.map((tip, i) => (
          <TipCard key={i} tip={tip} t={t} />
        ))}
      </div>
    </div>
  );
}

export default function BuildSection({ characterId, publicCharacter }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBuild = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = characterId
          ? await analysisAPI.build(characterId)
          : await publicAPI.build(
              publicCharacter.region,
              publicCharacter.realm,
              publicCharacter.name,
            );
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load build data');
      } finally {
        setLoading(false);
      }
    };
    if (characterId || publicCharacter) fetchBuild();
  }, [characterId, publicCharacter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-12 text-gray-400">{error}</div>;
  }

  if (!data) {
    return <p className="text-center py-10 text-void-text/60">{t('common.noData')}</p>;
  }

  const { statAnalysis, enchantAudit, gemAudit, gearTips } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <StatDistributionSection statAnalysis={statAnalysis} t={t} />
      <EnchantAuditSection enchantAudit={enchantAudit} t={t} />
      <GemAuditSection gemAudit={gemAudit} t={t} />
      <GearTipsSection gearTips={gearTips} t={t} />
    </div>
  );
}
