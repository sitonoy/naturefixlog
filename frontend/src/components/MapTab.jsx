import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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

// ─── BottomSheetCard ─────────────────────────────────────────────────────────
function BottomSheetCard({ log, onDelete, onUpdate }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'confirm-delete'
  const [editAction, setEditAction] = useState(log.action_type);
  const [editNote, setEditNote] = useState(log.note || '');
  const [editImage, setEditImage] = useState(log.image_data || null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setEditAction(log.action_type);
    setEditNote(log.note || '');
    setEditImage(log.image_data || null);
    setMode('view');
  }, [log.id]);

  const enterEdit = () => {
    setEditAction(log.action_type);
    setEditNote(log.note || '');
    setEditImage(log.image_data || null);
    setMode('edit');
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImage(await resizeImage(file));
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
        body: JSON.stringify({ action_type: editAction, note: editNote, image_data: editImage || '' }),
      });
      onUpdate(await res.json());
      setMode('view');
    } catch {}
    setBusy(false);
  };

  const btn = { border: 'none', borderRadius: 6, cursor: 'pointer', padding: '5px 10px', fontSize: 12 };

  if (mode === 'confirm-delete') return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 'bold', color: '#ef4444' }}>削除しますか？</p>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9ca3af' }}>この操作は元に戻せません</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMode('view')} style={{ ...btn, flex: 1, background: '#374151', color: '#d1d5db' }}>キャンセル</button>
        <button onClick={handleDelete} disabled={busy} style={{ ...btn, flex: 1, background: '#dc2626', color: 'white' }}>削除する</button>
      </div>
    </div>
  );

  if (mode === 'edit') return (
    <div style={{ padding: '12px 16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 'bold', color: 'white' }}>編集</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {ACTION_TYPES.map(a => (
          <button key={a.id} onClick={() => setEditAction(a.id)} style={{
            flex: 1, padding: '4px 2px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${editAction === a.id ? '#22c55e' : '#374151'}`,
            background: editAction === a.id ? '#14532d' : '#1f2937',
            color: editAction === a.id ? '#4ade80' : '#9ca3af',
          }}>{a.label}</button>
        ))}
      </div>
      <textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="メモ" rows={2}
        style={{ width: '100%', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: 4, padding: '4px 6px', fontSize: 12, resize: 'none', boxSizing: 'border-box', marginBottom: 6 }}
      />
      {editImage ? (
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <img src={editImage} style={{ width: '100%', maxHeight: 72, objectFit: 'cover', borderRadius: 4 }} alt="" />
          <button onClick={() => setEditImage(null)} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 10 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => imgRef.current?.click()} style={{ width: '100%', padding: '4px', background: '#1f2937', color: '#9ca3af', border: '1px dashed #374151', borderRadius: 4, cursor: 'pointer', fontSize: 11, marginBottom: 6 }}>📷 写真を追加</button>
      )}
      <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMode('view')} style={{ ...btn, flex: 1, background: '#374151', color: '#d1d5db' }}>キャンセル</button>
        <button onClick={handleSave} disabled={busy} style={{ ...btn, flex: 1, background: '#16a34a', color: 'white' }}>保存</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '12px 16px', display: 'flex', gap: 10, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {log.image_data && (
        <img src={log.image_data} style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} alt="" />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 'bold', color: 'white' }}>
          {ACTION_LABEL[log.action_type] || log.action_type}
        </p>
        <p style={{ margin: '0 0 2px', fontSize: 12, color: '#d1d5db' }}>
          {'⭐'.repeat(log.intensity)}{log.weather_desc ? ` · ${log.weather_desc}` : ''}
        </p>
        {log.note && <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>{log.note}</p>}
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280' }}>
          {new Date(log.timestamp).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={enterEdit} style={{ ...btn, background: '#1e3a8a', color: '#93c5fd' }}>編集</button>
          <button onClick={() => setMode('confirm-delete')} style={{ ...btn, background: '#450a0a', color: '#fca5a5' }}>削除</button>
          <a href={`https://maps.google.com/?q=${log.lat},${log.lng}`} target="_blank" rel="noopener noreferrer"
            style={{ ...btn, background: '#1f2937', color: '#60a5fa', textDecoration: 'none', display: 'inline-block' }}>地図</a>
        </div>
      </div>
    </div>
  );
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────
function BottomSheet({ logs, onClose, onDelete, onUpdate }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (index >= logs.length && logs.length > 0) setIndex(logs.length - 1);
  }, [logs.length, index]);

  const goTo = useCallback((i) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIndex(i);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '35vh',
      background: '#111827', zIndex: 1500,
      borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 7px', borderBottom: '1px solid #1f2937', flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, background: '#374151', borderRadius: 2 }} />
        <span style={{ fontSize: 12, color: '#9ca3af', flex: 1, marginTop: 6 }}>
          {logs.length > 1 ? `${index + 1} / ${logs.length} スポット` : '1 スポット'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, padding: 0, marginTop: 4 }}>✕</button>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="no-scrollbar"
        style={{ flex: 1, display: 'flex', overflowX: 'scroll', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {logs.map((l) => (
          <div key={l.id} style={{ minWidth: '100%', scrollSnapAlign: 'start', overflowY: 'auto' }}>
            <BottomSheetCard log={l} onDelete={onDelete} onUpdate={onUpdate} />
          </div>
        ))}
      </div>

      {/* Dot nav */}
      {logs.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0', borderTop: '1px solid #1f2937', flexShrink: 0 }}>
          {logs.map((_, i) => (
            <div key={i} onClick={() => goTo(i)} style={{
              width: i === index ? 18 : 6, height: 6, borderRadius: 3, cursor: 'pointer', transition: 'all 0.2s',
              background: i === index ? '#4ade80' : '#374151',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ClusterLayer（MapContainer内） ────────────────────────────────────────
function ClusterLayer({ logs, onSelect }) {
  const map = useMap();
  const [clusters, setClusters] = useState([]);

  const recompute = useCallback(() => {
    if (!map || !logs.length) { setClusters([]); return; }
    const THRESHOLD = 38;
    const points = logs.map(l => ({ ...l, px: map.latLngToLayerPoint([l.lat, l.lng]) }));
    const result = [];
    const assigned = new Set();

    for (let i = 0; i < points.length; i++) {
      if (assigned.has(i)) continue;
      const group = [points[i]];
      assigned.add(i);
      for (let j = i + 1; j < points.length; j++) {
        if (assigned.has(j)) continue;
        const dx = points[i].px.x - points[j].px.x;
        const dy = points[i].px.y - points[j].px.y;
        if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) {
          group.push(points[j]);
          assigned.add(j);
        }
      }
      result.push(group);
    }
    setClusters(result);
  }, [logs, map]);

  useEffect(() => { recompute(); }, [recompute]);
  useMapEvents({ zoomend: recompute, moveend: recompute });

  return (
    <>
      {clusters.map((group, i) => {
        if (group.length === 1) {
          const log = group[0];
          return (
            <CircleMarker
              key={log.id}
              center={[log.lat, log.lng]}
              radius={6 + log.intensity * 3}
              pathOptions={{ color: INTENSITY_COLOR[log.intensity], fillColor: INTENSITY_COLOR[log.intensity], fillOpacity: 0.75, weight: 2 }}
              eventHandlers={{ click: () => onSelect(group) }}
            />
          );
        }
        const lat = group.reduce((s, l) => s + l.lat, 0) / group.length;
        const lng = group.reduce((s, l) => s + l.lng, 0) / group.length;
        const icon = L.divIcon({
          html: `<div style="width:36px;height:36px;background:#15803d;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:15px;border:2px solid #4ade80;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${group.length}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        return (
          <Marker
            key={`cl-${i}-${lat.toFixed(4)}-${lng.toFixed(4)}`}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{ click: () => onSelect(group) }}
          />
        );
      })}
    </>
  );
}

function RecenterOnLoad({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 14); }, [center, map]);
  return null;
}

// ─── MapTab ───────────────────────────────────────────────────────────────────
export default function MapTab({ isActive }) {
  const [logs, setLogs] = useState([]);
  const [center, setCenter] = useState([35.6762, 139.6503]);
  const [filter, setFilter] = useState('all');
  const [recentered, setRecentered] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [bottomSheetLogs, setBottomSheetLogs] = useState(null);
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

  const handleDelete = (id) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    setBottomSheetLogs(prev => {
      if (!prev) return null;
      const updated = prev.filter(l => l.id !== id);
      return updated.length > 0 ? updated : null;
    });
  };

  const handleUpdate = (updated) => {
    setLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
    setBottomSheetLogs(prev => prev ? prev.map(l => l.id === updated.id ? updated : l) : null);
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action_type === filter);

  return (
    <div className="relative" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Filter bar */}
      <div className="absolute top-3 left-0 right-0 z-[1000] flex justify-center gap-2 px-4">
        {FILTER_OPTIONS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium shadow transition-all ${filter === f.id ? 'bg-green-500 text-white' : 'bg-gray-900/90 text-gray-300 border border-gray-700'}`}
          >{f.label}</button>
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
        onClick={() => currentPos && mapRef.current?.setView(currentPos, 16)}
        className="absolute bottom-6 right-4 z-[1000] bg-gray-900/90 text-green-400 text-xs font-medium px-3 py-2 rounded-full border border-green-800 shadow-lg"
      >現在地</button>

      <MapContainer ref={mapRef} center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <RecenterOnLoad center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {currentPos && (
          <CircleMarker center={currentPos} radius={10}
            pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.9, weight: 3 }}
          >
            <Popup><div style={{ minWidth: 80 }}><p style={{ margin: 0, fontWeight: 'bold' }}>📍 現在地</p></div></Popup>
          </CircleMarker>
        )}
        <ClusterLayer logs={filtered} onSelect={setBottomSheetLogs} />
      </MapContainer>

      {/* Bottom sheet */}
      {bottomSheetLogs && (
        <BottomSheet
          logs={bottomSheetLogs}
          onClose={() => setBottomSheetLogs(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}

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
