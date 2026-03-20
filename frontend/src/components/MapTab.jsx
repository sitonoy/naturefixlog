import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const INTENSITY_COLOR = { 1: '#86efac', 2: '#4ade80', 3: '#16a34a' };
const ACTION_LABEL = { walk: '🚶 歩く', stay: '🪑 座る', pass: '✨ ふと' };
const FILTER_OPTIONS = [
  { id: 'all', label: 'すべて' },
  { id: 'walk', label: '🚶' },
  { id: 'stay', label: '🪑' },
  { id: 'pass', label: '✨' },
];

function RecenterOnLoad({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function MapTab() {
  const [logs, setLogs] = useState([]);
  const [center, setCenter] = useState([35.6762, 139.6503]);
  const [filter, setFilter] = useState('all');
  const [recentered, setRecentered] = useState(false);

  useEffect(() => {
    fetch(`${API}/logs`)
      .then(r => r.json())
      .then(data => {
        setLogs(data);
        if (data.length > 0 && !recentered) {
          setCenter([data[0].lat, data[0].lng]);
          setRecentered(true);
        }
      })
      .catch(() => {});

    navigator.geolocation?.getCurrentPosition(pos => {
      setCenter([pos.coords.latitude, pos.coords.longitude]);
      setRecentered(true);
    });
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action_type === filter);

  return (
    <div className="relative pb-16" style={{ height: '100dvh' }}>
      {/* Filter bar */}
      <div className="absolute top-3 left-0 right-0 z-[1000] flex justify-center gap-2 px-4">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium shadow transition-all ${
              filter === f.id
                ? 'bg-green-500 text-white'
                : 'bg-gray-900/90 text-gray-300 border border-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Count badge */}
      <div className="absolute top-14 right-4 z-[1000]">
        <span className="bg-gray-900/90 text-gray-400 text-xs px-2 py-1 rounded-full border border-gray-700">
          {filtered.length} スポット
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <RecenterOnLoad center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {filtered.map(log => (
          <CircleMarker
            key={log.id}
            center={[log.lat, log.lng]}
            radius={6 + log.intensity * 3}
            pathOptions={{
              color: INTENSITY_COLOR[log.intensity],
              fillColor: INTENSITY_COLOR[log.intensity],
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>
                  {ACTION_LABEL[log.action_type] || log.action_type}
                </p>
                <p style={{ margin: '0 0 2px' }}>
                  強度: {'⭐'.repeat(log.intensity)}
                </p>
                {log.weather_desc && (
                  <p style={{ margin: '0 0 2px' }}>天気: {log.weather_desc}</p>
                )}
                {log.note && (
                  <p style={{ margin: '0 0 2px', fontStyle: 'italic' }}>{log.note}</p>
                )}
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  {new Date(log.timestamp).toLocaleString('ja-JP', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {logs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
          <div className="bg-gray-900/90 rounded-xl px-5 py-4 text-center border border-gray-700">
            <p className="text-gray-300 text-sm">まだログがありません</p>
            <p className="text-gray-500 text-xs mt-1">ホームで「回復した」を記録してみましょう</p>
          </div>
        </div>
      )}
    </div>
  );
}
