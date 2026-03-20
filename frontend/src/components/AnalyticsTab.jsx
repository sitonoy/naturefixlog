import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Dot,
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

function computeHourData(logs) {
  return Array.from({ length: 8 }, (_, i) => {
    const startH = i * 3;
    const cnt = logs.filter(l => {
      const h = new Date(l.timestamp).getHours();
      return h >= startH && h < startH + 3;
    }).length;
    return { hour: `${startH}時`, cnt };
  });
}

function computeActionData(logs) {
  const map = {};
  logs.forEach(l => {
    if (!map[l.action_type]) map[l.action_type] = { cnt: 0, total: 0 };
    map[l.action_type].cnt++;
    map[l.action_type].total += l.intensity;
  });
  return Object.entries(map).map(([k, v]) => ({
    name: ACTION_LABEL[k] || k,
    value: v.cnt,
    avg: (v.total / v.cnt).toFixed(1),
  }));
}

export default function AnalyticsTab() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/logs`).then(r => r.json()).then(setLogs).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  // Monthly trend data
  const monthCounts = {};
  logs.forEach(log => {
    const m = log.timestamp.substring(0, 7);
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const monthlyData = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cnt]) => {
      const [y, mo] = month.split('-');
      return { month, label: `${y.slice(2)}/${mo}`, cnt };
    });

  const filteredLogs = selectedMonth
    ? logs.filter(l => l.timestamp.startsWith(selectedMonth))
    : logs;

  const hourData = computeHourData(filteredLogs);
  const actionData = computeActionData(filteredLogs);

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
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">総記録数</p>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-3 text-center border border-gray-700">
          <p className="text-2xl font-bold text-white">{stats.streak}</p>
          <p className="text-xs text-gray-400 mt-1">連続記録日数</p>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-3 text-center border border-gray-700">
          <p className="text-sm font-bold text-white leading-tight">
            {bestAction.action_type ? ACTION_LABEL[bestAction.action_type] : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">行動トレンド</p>
        </div>
      </div>

      {/* Monthly trend */}
      {monthlyData.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 tracking-wider uppercase">月別 記録推移</h2>
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-xs text-gray-500 underline"
              >
                {selectedMonth} ✕
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={monthlyData}
              onClick={e => e?.activePayload && setSelectedMonth(e.activePayload[0].payload.month)}
            >
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                dataKey="cnt"
                name="記録数"
                stroke="#4ade80"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const sel = payload.month === selectedMonth;
                  return (
                    <circle
                      key={`dot-${payload.month}`}
                      cx={cx}
                      cy={cy}
                      r={sel ? 7 : 4}
                      fill={sel ? '#22c55e' : '#4ade80'}
                      stroke={sel ? '#fff' : 'none'}
                      strokeWidth={sel ? 2 : 0}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 mt-1 text-center">ポイントをタップすると月別データを表示</p>
        </div>
      )}

      {/* Hourly chart */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
        <h2 className="text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">
          時間帯別 記録数{selectedMonth ? ` (${selectedMonth})` : ''}
        </h2>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={hourData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cnt" name="記録数" fill="#4ade80" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Action type pie */}
      {actionData.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
          <h2 className="text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">
            行動タイプ別{selectedMonth ? ` (${selectedMonth})` : ''}
          </h2>
          <div className="flex items-center">
            <ResponsiveContainer width="45%" height={140}>
              <PieChart>
                <Pie data={actionData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
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
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-gray-300 flex-1">{a.name}</span>
                  <span className="text-xs text-gray-500">{a.value}回</span>
                  <span className="text-xs text-yellow-500">{a.avg}⭐</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🌱</p>
          <p className="text-gray-400 text-sm">まだデータがありません</p>
          <p className="text-gray-600 text-xs mt-1">記録するとグラフが現れます</p>
        </div>
      )}
    </div>
  );
}
