import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { analysisAPI, publicAPI } from '../../services/api';

export default function MPlusScoreTrend({ characterId, publicInfo, weeks = 12 }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetchHistory = publicInfo
      ? publicAPI.mplusHistory(publicInfo.region, publicInfo.realm, publicInfo.name, weeks)
      : analysisAPI.mplusHistory(characterId, weeks);

    fetchHistory
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [characterId, publicInfo, weeks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-void-bright border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.snapshots?.length) {
    return (
      <div className="text-center py-6 text-void-text/50 text-xs">{t('raiderio.noHistory')}</div>
    );
  }

  const chartData = [...data.snapshots].reverse().map((s) => ({
    date: new Date(s.snapshotAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: Math.round(s.score),
    itemLevel: s.itemLevel ? Math.round(s.itemLevel) : null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-void-text font-semibold uppercase tracking-wider">
          {t('raiderio.scoreTrend')}
        </p>
        {data.trend && (
          <span
            className={`text-xs font-bold ${
              data.trend.direction === 'up'
                ? 'text-green-400'
                : data.trend.direction === 'down'
                  ? 'text-red-400'
                  : 'text-void-text'
            }`}
          >
            {data.trend.direction === 'up' ? '+' : ''}
            {data.trend.change} pts
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="#1a0f2e" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            domain={['dataMin - 50', 'dataMax + 50']}
          />
          <Tooltip
            contentStyle={{
              background: '#0d0a1a',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#c084fc"
            strokeWidth={2}
            dot={{ r: 3, fill: '#c084fc' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
