import { useState } from 'react';
import HomeTab from './components/HomeTab';
import MapTab from './components/MapTab';
import AnalyticsTab from './components/AnalyticsTab';
import RecommendTab from './components/RecommendTab';

const TABS = [
  { id: 'home', label: 'ホーム', emoji: '🌿' },
  { id: 'map', label: 'マップ', emoji: '🗺️' },
  { id: 'analytics', label: '分析', emoji: '📊' },
  { id: 'recommend', label: 'おすすめ', emoji: '✨' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="max-w-md mx-auto relative min-h-screen bg-gray-950">
      {activeTab === 'home' && <HomeTab />}
      {activeTab === 'map' && <MapTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'recommend' && <RecommendTab />}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-900/95 backdrop-blur border-t border-gray-800 flex z-[2000]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 transition-all ${
              activeTab === tab.id ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-xl leading-none">{tab.emoji}</span>
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
