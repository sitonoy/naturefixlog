import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const INTENSITY_COLOR = { 1: '#86efac', 2: '#4ade80', 3: '#16a34a' };
const ACTION_LABEL = { walk: '🚶 歩きながら', stay: '🪑 座って', pass: '🧍 立ち止まって' };
const ACTION_TYPES = [
  { id: 'walk', label: '歩きながら' },
  { id: 'stay', label: '座って' },
  { id: 'pass', label: '立ち止まって' },
];
const FILTER_OPTIONS = [
  { id: 'all', label: 'すべて' },
  { id: 'walk', label: '🚶' },
  { id: 'stay', label: '🪑' },
  { id: 'pass', label: '🧍' },
];

const resizeImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// ポップアップ内容コンポーネント（削除確認・編集・写真表示）
function LogPopup({ log, onDelete, onUpdate }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'confirm-delete'
  const [editAction, setEditAction] = useState(log.action_type);
  const [editNote, setEditNote] = useState(log.note || '');
  const [editImage, setEditImage] = useState(log.image_data || null);
  const [busy, setBusy] = useState(false);
  const imgInputRef = useRef(null);

  const enterEdit = () => {
    setEditAction(log.action_type);
    setEditNote(log.note || '');
    setEditImage(log.image_data || null);
    setMode('edit');
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setEditImage(resized);
    e.target.value = '';
  };

  const handleDelete = async () => {
    setBusy(true);
    await fetch(`${API}/logs/${log.id}`, { method: 'DELETE' });
    onDelete(log.id);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/logs/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: editAction,
          note: editNote,
          image_data: editImage || '',
        }),
      });
      const updated = await res.json();
      onUpdate(updated);
      setMode('view');
    } catch {}
    setBusy(false);
  };

  const baseStyle = { minWidth: 200, fontFamily: 'sans-serif' };
  const btnBase = { border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '6px 0' };

  if (mode === 'confirm-delete') {
    return (
      <div style={baseStyle}>
        <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#ef4444', fontSize: 13 }}>削除しますか？</p>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af' }}>この操作は元に戻せません</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMode('view')}
            style={{ ...btnBase, flex: 1, background: '#374151', color: '#d1d5db' }}
          >キャンセル</button>
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{ ...btnBase, flex: 1, background: '#dc2626', color: 'white' }}
          >削除する</button>
        </div>
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div style={baseStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 'bold', fontSize: 13 }}>編集</p>

        {/* 行動タイプ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {ACTION_TYPES.map(a => (
            <button
              key={a.id}
              onClick={() => setEditAction(a.id)}
              style={{
                ...btnBase,
                flex: 1,
                fontSize: 10,
                borderRadius: 4,
                border: '1px solid',
                borderColor: editAction === a.id ? '#22c55e' : '#374151',
                background: editAction === a.id ? '#14532d' : '#1f2937',
                color: editAction === a.id ? '#4ade80' : '#9ca3af',
              }}
            >{a.label}</button>
          ))}
        </div>

        {/* メモ */}
        <textarea
          value={editNote}
          onChange={e => setEditNote(e.target.value)}
          placeholder="メモ"
          rows={2}
          style={{
            width: '100%', background: '#1f2937', color: 'white',
            border: '1px solid #374151', borderRadius: 4, padding: '4px 6px',
            fontSize: 12, resize: 'none', boxSizing: 'border-box', marginBottom: 6,
          }}
        />

        {/* 写真 */}
        {editImage ? (
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <img src={editImage} style={{ width: '100%', borderRadius: 4, display: 'block' }} alt="" />
            <button
              onClick={() => setEditImage(null)}
              style={{
                position: 'absolute', top: 3, right: 3,
                background: 'rgba(0,0,0,0.7)', color: 'white',
                border: 'none', borderRadius: '50%', width: 22, height: 22,
                cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() => imgInputRef.current?.click()}
            style={{
              width: '100%', padding: '5px', background: '#1f2937', color: '#9ca3af',
              border: '1px dashed #374151', borderRadius: 4, cursor: 'pointer',
              fontSize: 11, marginBottom: 6,
            }}
          >📷 写真を追加</button>
        )}
        <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />

        {/* 保存/キャンセル */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMode('view')}
            style={{ ...btnBase, flex: 1, background: '#374151', color: '#d1d5db' }}
          >キャンセル</button>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{ ...btnBase, flex: 1, background: '#16a34a', color: 'white' }}
          >保存</button>
        </div>
      </div>
    );
  }

  // view mode
  return (
    <div style={baseStyle}>
      {log.image_data && (
        <img src={log.image_data} style={{ width: '100%', borderRadius: 4, marginBottom: 8, display: 'block' }} alt="" />
      )}
      <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>
        {ACTION_LABEL[log.action_type] || log.action_type}
      </p>
      <p style={{ margin: '0 0 2px' }}>強度: {'⭐'.repeat(log.intensity)}</p>
      {log.weather_desc && <p style={{ margin: '0 0 2px' }}>天気: {log.weather_desc}</p>}
      {log.note && <p style={{ margin: '0 0 2px', fontStyle: 'italic', color: '#d1d5db' }}>{log.note}</p>}
      <p style={{ margin: '4px 0 6px', fontSize: 11, color: '#9ca3af' }}>
        {new Date(log.timestamp).toLocaleString('ja-JP', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </p>
      <a
        href={`https://maps.google.com/?q=${log.lat},${log.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, color: '#3b82f6', display: 'block', marginBottom: 10 }}
      >🗺️ Google Maps で開く</a>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={enterEdit}
          style={{ ...btnBase, flex: 1, background: '#1e3a8a', color: '#93c5fd' }}
        >編集</button>
        <button
          onClick={() => setMode('confirm-delete')}
          style={{ ...btnBase, flex: 1, background: '#450a0a', color: '#fca5a5' }}
        >削除</button>
      </div>
    </div>
  );
}

function RecenterOnLoad({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function MapTab({ isActive }) {
  const [logs, setLogs] = useState([]);
  const [center, setCenter] = useState([35.6762, 139.6503]);
  const [filter, setFilter] = useState('all');
  const [recentered, setRecentered] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => mapRef.current?.invalidateSize(), 50);
      return () => clearTimeout(t);
    }
  }, [isActive]);

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
      const { latitude, longitude } = pos.coords;
      setCurrentPos([latitude, longitude]);
      setCenter([latitude, longitude]);
      setRecentered(true);
    });
  }, []);

  const handleDelete = (id) => setLogs(prev => prev.filter(l => l.id !== id));
  const handleUpdate = (updated) => setLogs(prev => prev.map(l => l.id === updated.id ? updated : l));

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action_type === filter);

  const handleLocate = () => {
    if (currentPos && mapRef.current) mapRef.current.setView(currentPos, 16);
  };

  return (
    <div className="relative" style={{ height: 'calc(100dvh - 64px)' }}>
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

      {/* Locate button */}
      <button
        onClick={handleLocate}
        className="absolute bottom-6 right-4 z-[1000] bg-gray-900/90 text-green-400 text-xs font-medium px-3 py-2 rounded-full border border-green-800 shadow-lg"
      >
        現在地
      </button>

      <MapContainer
        ref={mapRef}
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <RecenterOnLoad center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {currentPos && (
          <CircleMarker
            center={currentPos}
            radius={10}
            pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.9, weight: 3 }}
          >
            <Popup>
              <div style={{ minWidth: 100 }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>📍 現在地</p>
              </div>
            </Popup>
          </CircleMarker>
        )}
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
            <Popup maxWidth={240}>
              <LogPopup log={log} onDelete={handleDelete} onUpdate={handleUpdate} />
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
