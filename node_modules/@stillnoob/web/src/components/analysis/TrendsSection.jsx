import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, AreaChart, BarChart, LineChart,
  CartesianGrid, XAxis, YAxis, Tooltip, Area, Bar, Line,
} from 'recharts';

function formatDps(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : Math.round(val);
}

export default function TrendsSection({ data }) {
  const { t } = useTranslation();
  const { weeklyTrends } = data;

  const chartData = useMemo(() => {
    if (!weeklyTrends) return [];
    return weeklyTrends.map(w => ({
      week: w.weekStart?.substring(5) || '',
      dps: Math.round(w.avgDps || 0),
      deaths: w.avgDeaths || 0,
      consumables: Math.round(w.consumableScore || 0),
      fights: w.fights || 0,
    }));
  }, [weeklyTrends]);

  if (!chartData.length) {
    return <p className="text-center py-10 text-midnight-silver/60">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* DPS trend */}
      <div className="bg-midnight-spaceblue/30 rounded-xl border border-midnight-bright-purple/10 p-4">
        <p className="text-xs text-midnight-silver mb-3 font-semibold uppercase tracking-wider">
          {t('analysis.dpsTrend')}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="dpsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => formatDps(v)} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="dps" stroke="#60a5fa" fill="url(#dpsFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Deaths trend */}
      <div className="bg-midnight-spaceblue/30 rounded-xl border border-midnight-bright-purple/10 p-4">
        <p className="text-xs text-midnight-silver mb-3 font-semibold uppercase tracking-wider">
          {t('analysis.deathTrend')}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="deaths" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Consumable trend */}
      <div className="bg-midnight-spaceblue/30 rounded-xl border border-midnight-bright-purple/10 p-4">
        <p className="text-xs text-midnight-silver mb-3 font-semibold uppercase tracking-wider">
          {t('analysis.consumableTrend')}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="consumables" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly summary table */}
      <div className="bg-midnight-spaceblue/30 rounded-xl border border-midnight-bright-purple/10 p-4">
        <p className="text-xs text-midnight-silver mb-3 font-semibold uppercase tracking-wider">
          {t('analysis.weeklySummary')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-midnight-silver/60 border-b border-midnight-bright-purple/10">
                <th className="text-left py-2 px-2">{t('analysis.week')}</th>
                <th className="text-center py-2 px-2">{t('common.fights')}</th>
                <th className="text-center py-2 px-2">DPS</th>
                <th className="text-center py-2 px-2">{t('analysis.deathsPerFight')}</th>
                <th className="text-center py-2 px-2">{t('categories.consumables')}</th>
              </tr>
            </thead>
            <tbody>
              {weeklyTrends.map((w, i) => (
                <tr key={i} className="border-b border-midnight-bright-purple/5">
                  <td className="py-2 px-2 text-midnight-silver">{w.weekStart}</td>
                  <td className="py-2 px-2 text-center text-white">{w.fights}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-blue-400">{formatDps(w.avgDps)}</span>
                    {w.dpsChange !== undefined && w.dpsChange !== 0 && (
                      <span className={`ml-1 ${w.dpsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {w.dpsChange > 0 ? '+' : ''}{w.dpsChange}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center text-white">{w.avgDeaths.toFixed(2)}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={w.consumableScore >= 70 ? 'text-green-400' : 'text-yellow-400'}>
                      {Math.round(w.consumableScore)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
