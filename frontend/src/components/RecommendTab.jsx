import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MOODS = [
  { id: '疲労', label: '疲れた', emoji: '😴' },
  { id: 'ストレス', label: 'ストレス', emoji: '😤' },
  { id: '思考', label: '考えすぎ', emoji: '🌀' },
];

const ACTION_LABEL = { walk: '🚶 歩く', stay: '🪑 座る', pass: '✨ ふと' };

const weatherCodeToMain = (code) => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Clouds';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  return 'Other';
};

export default function RecommendTab() {
  const [mood, setMood] = useState('疲労');
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentWeather, setCurrentWeather] = useState('Clear');
  const [currentHour] = useState(new Date().getHours());

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weathercode`
      )
        .then(r => r.json())
        .then(data => setCurrentWeather(weatherCodeToMain(data.current.weathercode)))
        .catch(() => {});
    });
  }, []);

  const fetchRecommend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/recommend?mood=${encodeURIComponent(mood)}&hour=${currentHour}&weather=${encodeURIComponent(currentWeather)}`
      );
      const data = await res.json();
      setSpots(data);
    } catch {
      setSpots([]);
    }
    setLoading(false);
  }, [mood, currentHour, currentWeather]);

  useEffect(() => {
    fetchRecommend();
  }, [fetchRecommend]);

  const weatherLabel = {
    Clear: '☀️ 晴れ',
    Clouds: '⛅ 曇り',
    Rain: '🌧️ 雨',
    Fog: '🌫️ 霧',
    Snow: '❄️ 雪',
    Other: '🌤️ その他',
  }[currentWeather] || currentWeather;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 pb-24">
      <h1 className="text-xl font-bold text-green-400 pt-10 mb-1">今どこへ行く？</h1>
      <p className="text-gray-500 text-xs mb-6">過去の回復データから最適スポットを提案</p>

      {/* Mood selector */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2 tracking-widest uppercase">今の状態</p>
        <div className="flex gap-3">
          {MOODS.map(m => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`flex-1 flex flex-col items-center py-3 rounded-xl border transition-all ${
                mood === m.id
                  ? 'bg-green-500/15 border-green-500 text-green-400'
                  : 'bg-gray-800/60 border-gray-700 text-gray-400'
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-xs mt-1">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Current conditions */}
      <div className="bg-gray-800/50 rounded-xl px-4 py-3 mb-6 flex gap-5 text-sm border border-gray-700/50">
        <span className="text-gray-400">🕐 {currentHour}時台</span>
        <span className="text-gray-400">{weatherLabel}</span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">分析中...</div>
      ) : spots.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🗺️</p>
          <p className="text-gray-400 text-sm">提案できるデータが不足しています</p>
          <p className="text-gray-600 text-xs mt-2">
            強度2以上のログを溜めると提案が表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">おすすめスポット TOP{spots.length}</p>
          {spots.map((spot, i) => (
            <div
              key={i}
              className="bg-gray-800/60 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-bold text-lg">#{i + 1}</span>
                  <span className="text-sm text-gray-200">
                    {ACTION_LABEL[spot.action_type] || spot.action_type}
                  </span>
                </div>
                <div className="text-sm">
                  {'⭐'.repeat(Math.round(spot.avg_i))}
                  <span className="text-gray-500 text-xs ml-1">({Number(spot.avg_i).toFixed(1)})</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">{spot.reason}</p>
              <div className="flex gap-2">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${spot.lat}&mlon=${spot.lng}&zoom=17`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-green-500/10 border border-green-600/30 text-green-400 rounded-lg py-2 text-xs font-medium"
                >
                  📍 OSMで開く
                </a>
                <a
                  href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-blue-500/10 border border-blue-600/30 text-blue-400 rounded-lg py-2 text-xs font-medium"
                >
                  🗺️ Google Maps
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
