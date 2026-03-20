import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ACTION_TYPES = [
  { id: 'walk', label: '歩きながら', emoji: '🚶' },
  { id: 'stay', label: '座って', emoji: '🪑' },
  { id: 'pass', label: '立ち止まって', emoji: '🧍' },
];

const weatherCodeToInfo = (code) => {
  if (code === 0) return { main: 'Clear', label: '快晴', emoji: '☀️' };
  if (code <= 3) return { main: 'Clouds', label: '曇り', emoji: '⛅' };
  if (code <= 48) return { main: 'Fog', label: '霧', emoji: '🌫️' };
  if (code <= 67) return { main: 'Rain', label: '雨', emoji: '🌧️' };
  if (code <= 77) return { main: 'Snow', label: '雪', emoji: '❄️' };
  if (code <= 82) return { main: 'Rain', label: '小雨', emoji: '🌦️' };
  return { main: 'Thunder', label: '雷雨', emoji: '⛈️' };
};

// 画像を最大800pxにリサイズしてJPEG base64で返す（エラー時は元データにフォールバック）
const resizeImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onerror = () => resolve(null);
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onerror = () => resolve(dataUrl); // HEIC等で失敗した場合は元データを使用
    img.onload = () => {
      try {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

export default function HomeTab() {
  const [actionType, setActionType] = useState('walk');
  const [intensity, setIntensity] = useState(2);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(false);
  const [weather, setWeather] = useState(null);
  const [note, setNote] = useState('');
  const [imageData, setImageData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [totalCount, setTotalCount] = useState(0);
  const [backendReady, setBackendReady] = useState(false);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const fetchWeather = useCallback((lat, lng) => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode`
    )
      .then(r => r.json())
      .then(data => {
        const code = data.current.weathercode;
        const temp = data.current.temperature_2m;
        setWeather({ ...weatherCodeToInfo(code), temp });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          setLocation({ lat: latitude, lng: longitude });
          fetchWeather(latitude, longitude);
        },
        () => setLocError(true)
      );
    }

    fetch(`${API}/stats`)
      .then(r => r.json())
      .then(d => { setTotalCount(d.total); setBackendReady(true); })
      .catch(() => setBackendReady(true));
  }, [fetchWeather]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    if (resized) setImageData(resized);
    e.target.value = '';
  };

  const handleLog = async () => {
    if (!location) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch(`${API}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          action_type: actionType,
          intensity,
          weather_main: weather?.main ?? null,
          weather_desc: weather?.label ?? null,
          weather_temp: weather?.temp ?? null,
          note: note || null,
          image_data: imageData || null,
        }),
      });
      if (res.ok) {
        setStatus('success');
        setTotalCount(c => c + 1);
        setNote('');
        setImageData(null);
        setTimeout(() => setStatus('idle'), 2500);
      } else {
        throw new Error();
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const isReady = backendReady && (location !== null || locError);

  const btnStyle =
    !isReady
      ? 'bg-gray-700 animate-pulse cursor-not-allowed'
      : status === 'success'
      ? 'bg-green-400 scale-110 shadow-green-400/60'
      : status === 'loading'
      ? 'bg-green-700 animate-pulse cursor-not-allowed'
      : status === 'error'
      ? 'bg-red-500 shadow-red-500/40'
      : 'bg-green-500 hover:bg-green-400 hover:scale-105 active:scale-95 shadow-green-500/40';

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-950 text-white px-5 pb-24">
      {/* Header */}
      <div className="w-full text-center pt-10 mb-6">
        <h1 className="text-2xl font-bold text-green-400 tracking-wide">NatureFixログ</h1>
        <p className="text-xs text-gray-500 mt-1 tracking-widest uppercase">リラックスできる場所の記録</p>
      </div>

      {/* Location & Weather chips */}
      <div className="flex gap-2 mb-8 flex-wrap justify-center">
        <span className={`px-3 py-1 rounded-full text-xs ${location ? 'bg-green-900/40 text-green-400 border border-green-800' : locError ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-gray-800 text-gray-500'}`}>
          {location ? '📍 位置取得済み' : locError ? '📍 位置取得失敗' : '📍 取得中...'}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs ${weather ? 'bg-blue-900/40 text-blue-300 border border-blue-800' : 'bg-gray-800 text-gray-500'}`}>
          {weather ? `${weather.emoji} ${weather.label} ${weather.temp}°C` : '🌤️ 天気取得中...'}
        </span>
      </div>

      {/* Main Button */}
      <button
        onClick={handleLog}
        disabled={!isReady || status === 'loading'}
        className={`w-44 h-44 rounded-full text-xl font-bold shadow-2xl transition-all duration-300 mb-10 ${btnStyle}`}
      >
        {!isReady ? '準備中...' : status === 'success' ? '✓ 記録完了' : status === 'error' ? '❌ 失敗' : '位置を記録'}
      </button>

      {/* Action Type */}
      <div className="w-full mb-6">
        <p className="text-gray-400 text-xs mb-3 text-center tracking-widest uppercase">行動タイプ</p>
        <div className="flex gap-3">
          {ACTION_TYPES.map(a => (
            <button
              key={a.id}
              onClick={() => setActionType(a.id)}
              className={`flex-1 flex flex-col items-center py-3 rounded-xl border transition-all ${
                actionType === a.id
                  ? 'bg-green-500/15 border-green-500 text-green-400'
                  : 'bg-gray-800/60 border-gray-700 text-gray-400'
              }`}
            >
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-xs mt-1">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Intensity */}
      <div className="w-full mb-6">
        <p className="text-gray-400 text-xs mb-3 text-center tracking-widest uppercase">回復強度</p>
        <div className="flex gap-3">
          {[
            { v: 1, label: 'やや', stars: '⭐' },
            { v: 2, label: 'まあまあ', stars: '⭐⭐' },
            { v: 3, label: 'とても', stars: '⭐⭐⭐' },
          ].map(({ v, label, stars }) => (
            <button
              key={v}
              onClick={() => setIntensity(v)}
              className={`flex-1 py-3 rounded-xl border transition-all text-center ${
                intensity === v
                  ? 'bg-yellow-500/15 border-yellow-500 text-yellow-400'
                  : 'bg-gray-800/60 border-gray-700 text-gray-500'
              }`}
            >
              <div className="text-sm">{stars}</div>
              <div className="text-xs mt-1">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="w-full mb-4">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="メモ（任意）— どんな環境だった？"
          className="w-full bg-gray-800/60 text-white rounded-xl p-3 text-sm placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-green-600 resize-none"
          rows={2}
        />
      </div>

      {/* Photo */}
      <div className="w-full">
        <p className="text-gray-400 text-xs mb-2 tracking-widest uppercase">写真（任意・1枚）</p>
        {imageData ? (
          <div className="relative">
            <img src={imageData} className="w-full rounded-xl object-cover max-h-48" alt="preview" />
            <button
              onClick={() => setImageData(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >✕</button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 py-3 rounded-xl border border-gray-700 bg-gray-800/60 text-gray-400 text-sm flex flex-col items-center gap-1"
            >
              <span className="text-xl">📷</span>
              <span className="text-xs">カメラ</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex-1 py-3 rounded-xl border border-gray-700 bg-gray-800/60 text-gray-400 text-sm flex flex-col items-center gap-1"
            >
              <span className="text-xl">🖼️</span>
              <span className="text-xs">フォルダ</span>
            </button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>
    </div>
  );
}
