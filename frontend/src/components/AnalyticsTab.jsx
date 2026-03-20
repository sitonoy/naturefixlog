import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ACTION_LABEL = { walk: '🚶 歩きながら', stay: '🪑 座って', pass: '🧍 立ち止まって' };
const PIE_COLORS = ['#4ade80', '#60a5fa', '#fbbf24'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white shadow">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsTab() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  // Time of day: show every 3 hours
  const hourData = Array.from({ length: 8 }, (_, i) => {
    const startH = i * 3;
    const cnt = stats.by_hour
      .filter(h => h.hour >= startH && h.hour < startH + 3)
      .reduce((s, h) => s + h.cnt, 0);
    return { hour: `${startH}時`, cnt };
  });

  const actionData = stats.by_action.map(a => ({
    name: ACTION_LABEL[a.action_type] || a.action_type,
    value: a.cnt,
    avg: Number(a.avg_intensity).toFixed(1),
  }));

  const weatherData = stats.by_weather.map(w => ({
    name: w.weather_main,
    cnt: w.cnt,
  }));

  const bestAction = stats.by_action.reduce(
    (a, b) => (a.avg_intensity > b.avg_intensity ? a : b),
    { avg_intensity: 0, action_type: null }
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 pb-24">
      <h1 className="text-xl font-bold text-green-400 pt-10 mb-6">記録パターン分析</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-800/70 rounded-xl p-3 text-center border border-gray-700">
          <p className="text-2xl font-bold text-green-400">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">総記録数</p>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-3 text-center border border-gray-700">
          <p className="text-2xl font-bold text-blue-400">{stats.streak}</p>
          <p className="text-xs text-gray-400 mt-1">連続日数</p>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-3 text-center border border-gray-700">
          <p className="text-base font-bold text-yellow-400 leading-tight">
            {bestAction.action_type ? ACTION_LABEL[bestAction.action_type] : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">最強タイプ</p>
        </div>
      </div>

      {/* Time of day chart */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
        <h2 className="text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">時間帯別 回復数</h2>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={hourData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cnt" name="回復数" fill="#4ade80" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Action type pie */}
      {actionData.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
          <h2 className="text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">行動タイプ別</h2>
          <div className="flex items-center">
            <ResponsiveContainer width="45%" height={140}>
              <PieChart>
                <Pie
                  data={actionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {actionData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 pl-3 space-y-2">
              {actionData.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-xs text-gray-300 flex-1">{a.name}</span>
                  <span className="text-xs text-gray-500">{a.value}回</span>
                  <span className="text-xs text-yellow-500">{a.avg}⭐</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weather chart */}
      {weatherData.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
          <h2 className="text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">天気別 回復数</h2>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weatherData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cnt" name="回復数" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🌱</p>
          <p className="text-gray-400 text-sm">まだデータがありません</p>
          <p className="text-gray-600 text-xs mt-1">回復を記録するとグラフが現れます</p>
        </div>
      )}
    </div>
  );
}
