'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider, useTheme } from '@/lib/theme';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import StatsPanel from '@/components/stats/StatsPanel';
import MapOverlay from '@/components/map/MapOverlay';
import { AdminLevel, RiskData, RiskType, SelectedRegion } from '@/lib/types';

const MapComponent = dynamic(() => import('@/components/map/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080e1c', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #182d4a', borderTopColor: '#c8a951', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#c8a951', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>LOADING MAP</p>
      <p style={{ color: '#3f5272', fontSize: 9 }}>Initialising geospatial layers</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

const PROVINCES = [
  'PUNJAB', 'SINDH', 'KHYBER PAKHTUNKHWA', 'BALOCHISTAN',
  'GILGIT BALTISTAN', 'AZAD KASHMIR', 'FATA', 'FEDERAL CAPITAL TERRITORY',
  'INDIAN OCCUPIED KASHMIR',
];

const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'PUNJAB': ['LAHORE','FAISALABAD','RAWALPINDI','GUJRANWALA','MULTAN','SHEIKHUPURA','SIALKOT','BAHAWALPUR','SARGODHA','DG KHAN','GUJRAT','JHANG','KASUR','RAHIM YAR KHAN','SAHIWAL','OKARA','CHINIOT','HAFIZABAD','MANDI BAHAUDDIN','NAROWAL','NANKANA SAHIB','PAKPATTAN','BAHAWALNAGAR','MUZAFFARGARH','LODHRAN','VEHARI','KHANEWAL','TOBA TEK SINGH','KHUSHAB','MIANWALI','BHAKKAR','LAYYAH','JHELUM','CHAKWAL','ATTOCK'],
  'SINDH': ['KARACHI','HYDERABAD','SUKKUR','LARKANA','MIRPURKHAS','NAWABSHAH','JACOBABAD','SHIKARPUR','KHAIRPUR','GHOTKI','DADU','SANGHAR','THARPARKAR','BADIN'],
  'KHYBER PAKHTUNKHWA': ['PESHAWAR','MARDAN','SWAT','ABBOTTABAD','MANSEHRA','KOHAT','NOWSHERA','CHARSADDA'],
  'BALOCHISTAN': ['QUETTA','GWADAR','TURBAT','KHUZDAR','KALAT','ZHOB'],
  'GILGIT BALTISTAN': ['GILGIT','SKARDU'],
  'AZAD KASHMIR': ['MUZAFFARABAD','MIRPUR','BAGH','BHIMBER','HATTIAN BALA','HAVELI','KOTLI','NEELUM','POONCH','SUDHNOTI'],
};

function Dashboard() {
  const { isDark } = useTheme();
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [adminLevel, setAdminLevel] = useState<AdminLevel>('province');
  const [riskType, setRiskType] = useState<RiskType>('flood');
  const [predictionOffset, setPredictionOffset] = useState(0);

  useEffect(() => {
    fetch('/risk_data.json').then(r => r.json()).then(setRiskData).catch(console.error);
  }, []);

  const handleRegionSelect = useCallback((r: SelectedRegion | null) => setSelectedRegion(r), []);
  const handleAdminLevelChange = useCallback((l: AdminLevel) => { setAdminLevel(l); setSelectedRegion(null); }, []);
  const handleRiskTypeChange = useCallback((t: RiskType) => { setRiskType(t); setSelectedRegion(null); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: isDark ? '#080e1c' : '#f2f5f9', transition: 'background 0.25s' }}>
      <Navbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel */}
        <Sidebar
          riskType={riskType}
          onRiskTypeChange={handleRiskTypeChange}
          adminLevel={adminLevel}
          onAdminLevelChange={handleAdminLevelChange}
          selectedRegion={selectedRegion}
          onRegionSelect={handleRegionSelect}
          provinces={PROVINCES}
          districtsByProvince={DISTRICTS_BY_PROVINCE}
          predictionOffset={predictionOffset}
          onPredictionOffsetChange={setPredictionOffset}
        />

        {/* Center map */}
        <main style={{ position: 'relative', flex: 1, overflow: 'hidden' }} className="instrument-grid">
          <MapComponent
            riskType={riskType}
            adminLevel={adminLevel}
            selectedRegion={selectedRegion}
            onRegionSelect={handleRegionSelect}
            riskData={riskData}
            isDark={isDark}
          />
          <MapOverlay
            riskType={riskType}
            selectedRegion={selectedRegion}
            onReset={() => setSelectedRegion(null)}
            isDark={isDark}
          />
        </main>

        {/* Right panel */}
        <StatsPanel
          selectedRegion={selectedRegion}
          riskData={riskData}
          riskType={riskType}
          predictionOffset={predictionOffset}
          onReset={() => setSelectedRegion(null)}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
