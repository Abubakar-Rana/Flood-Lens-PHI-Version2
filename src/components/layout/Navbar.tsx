'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(n.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(n.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const bg = isDark ? '#111111' : '#ffffff';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#c0c0c0' : '#555';
  const tm = isDark ? '#666' : '#888';
  const btnBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  return (
    <nav style={{ height: 56, background: bg, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/floodlens-logo.png"
          alt="FloodLens"
          style={{
            width: 40, height: 40, flexShrink: 0,
            objectFit: 'contain',
            borderRadius: 8,
            // Subtle backdrop only in dark mode so the mark stays readable
            background: isDark ? 'rgba(255,255,255,0.04)' : 'transparent',
            padding: 2,
          }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: tp, fontWeight: 800, fontSize: 15, letterSpacing: '0.01em' }}>FloodLens</span>
            <span style={{ color: tm, fontSize: 13, fontWeight: 300 }}>·</span>
            <span style={{ color: ts, fontWeight: 400, fontSize: 12 }}>South Asia Flood Atlas</span>
          </div>
          <div style={{ color: tm, fontSize: 9, letterSpacing: '0.07em', marginTop: 1 }}>
            PHI LAB · UNIVERSITY OF OXFORD · PLANETARY HEALTH INFORMATICS LAB
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ padding: '4px 10px', borderRadius: 6, background: btnBg, border: `1px solid ${border}`, textAlign: 'right' }}>
          <div style={{ color: tp, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1.2 }}>{time}</div>
          <div style={{ color: tm, fontSize: 9, lineHeight: 1 }}>{date}</div>
        </div>

        <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}
          style={{ padding: 7, borderRadius: 6, cursor: 'pointer',
            background: isDark ? 'rgba(200,169,81,0.08)' : 'rgba(200,169,81,0.15)',
            border: '1px solid rgba(200,169,81,0.25)', color: '#c8a951',
            display: 'flex', alignItems: 'center' }}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </nav>
  );
}
