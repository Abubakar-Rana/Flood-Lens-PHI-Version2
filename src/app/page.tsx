'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { AppStateProvider, useApp } from '@/lib/state';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import StatsPanel from '@/components/stats/StatsPanel';
import MapOverlay from '@/components/map/MapOverlay';

const MapComponent = dynamic(() => import('@/components/map/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080e1c', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #182d4a', borderTopColor: '#c8a951', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#c8a951', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>LOADING MAP</p>
      <p style={{ color: '#3f5272', fontSize: 9 }}>Initialising boundaries & stats</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

// Slim animated bar pinned under the navbar — visible whenever app.loading is true.
function LoadingBar() {
  const app = useApp();
  if (!app.loading) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
      background: 'rgba(200,169,81,0.15)', overflow: 'hidden', zIndex: 1100,
    }}>
      <div style={{
        height: '100%', width: '40%',
        background: 'linear-gradient(90deg, transparent, #c8a951, transparent)',
        animation: 'loading-slide 1.1s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes loading-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

function Dashboard() {
  const { isDark } = useTheme();
  const [statsVisible, setStatsVisible] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: isDark ? '#080e1c' : '#f2f5f9', transition: 'background .25s' }}>
      <Navbar />
      <div style={{ position: 'relative', display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LoadingBar />
        <Sidebar />

        <main style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <MapComponent isDark={isDark} />
          <MapOverlay isDark={isDark} />

          <button
            onClick={() => setStatsVisible(v => !v)}
            title={statsVisible ? 'Hide details' : 'Show details'}
            style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1000,
              width: 18, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#c8a951',
              borderTop: '1px solid #b8962f', borderBottom: '1px solid #b8962f', borderLeft: '1px solid #b8962f', borderRight: 'none',
              borderRadius: '6px 0 0 6px', cursor: 'pointer', color: '#1a1200',
              boxShadow: isDark ? '-2px 0 8px rgba(0,0,0,0.4)' : '-2px 0 8px rgba(0,0,0,0.12)',
            }}
          >
            {statsVisible ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>
        </main>

        <div style={{ width: statsVisible ? 320 : 0, minWidth: 0, overflow: 'hidden', transition: 'width .25s ease', flexShrink: 0, height: '100%', display: 'flex' }}>
          <StatsPanel />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <Dashboard />
      </AppStateProvider>
    </ThemeProvider>
  );
}
