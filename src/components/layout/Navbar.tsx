'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Bell, ChevronDown, LayoutDashboard, FileText, BarChart2, Settings, BookOpen } from 'lucide-react';
import { useTheme } from '@/lib/theme';

const NAV_TABS = [
  { label: 'Dashboard',  icon: LayoutDashboard },
  { label: 'Predictions', icon: BarChart2 },
  { label: 'Reports',    icon: FileText },
  { label: 'About',      icon: BookOpen },
];

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');

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

  // Theme-aware tokens
  const bg          = isDark ? '#111111'                 : '#ffffff';
  const border      = isDark ? '#2e2e2e'                 : '#e0e0e0';
  const textPrimary = isDark ? '#ffffff'                 : '#111111';
  const textSecond  = isDark ? '#c0c0c0'                 : '#555555';
  const textMuted   = isDark ? '#666666'                 : '#888888';
  const textDim     = isDark ? '#555555'                 : '#aaaaaa';
  const btnBg       = isDark ? 'rgba(255,255,255,0.04)'  : 'rgba(0,0,0,0.04)';
  const inactiveTab = isDark ? '#888888'                 : '#666666';

  return (
    <nav
      style={{
        height: 56,
        background: bg,
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      {/* ── Branding ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Oxford shield mark */}
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(145deg, #002147 0%, #003d80 100%)',
          border: '1px solid #1a4a7a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0,33,71,0.5)',
        }}>
          <svg viewBox="0 0 22 24" width="14" height="15" fill="none">
            <path d="M11 1L2 5v7c0 5.25 3.8 9.85 9 11 5.2-1.15 9-5.75 9-11V5L11 1z" fill="#c8a951" fillOpacity="0.9"/>
            <path d="M8 12l2.5 2.5 4-5" stroke="#002147" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: textPrimary, fontWeight: 800, fontSize: 14, letterSpacing: '0.02em' }}>
              PHI Lab
            </span>
            <span style={{ color: textDim, fontSize: 13, fontWeight: 300 }}>·</span>
            <span style={{ color: textSecond, fontWeight: 400, fontSize: 12 }}>
              Risk Predictor
            </span>
            <span style={{
              background: 'rgba(200,169,81,0.12)',
              border: '1px solid rgba(200,169,81,0.3)',
              color: '#c8a951',
              fontSize: 8, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              letterSpacing: '0.1em',
            }}>BETA</span>
          </div>
          <div style={{ color: textMuted, fontSize: 9, letterSpacing: '0.07em', marginTop: 1 }}>
            UNIVERSITY OF OXFORD · PLANETARY HEALTH INFORMATICS LAB
          </div>
        </div>

      </div>

      {/* ── Beta notice ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 20,
        background: 'rgba(200,169,81,0.07)',
        border: '1px solid rgba(200,169,81,0.18)',
        color: '#c8a951', fontSize: 10,
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c8a951' }} className="anim-blink" />
        Soft launch — data validation in progress
      </div>

      {/* ── Nav Tabs ── */}
      <div style={{ display: 'flex', gap: 2 }}>
        {NAV_TABS.map(({ label, icon: Icon }) => {
          const active = activeTab === label;
          return (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 6,
                background: active ? '#c8a951' : 'transparent',
                color: active ? '#111111' : inactiveTab,
                border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: active ? 700 : 500,
                letterSpacing: '0.02em', transition: 'all 0.15s',
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Right Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Clock */}
        <div style={{
          padding: '4px 10px', borderRadius: 6,
          background: btnBg, border: `1px solid ${border}`,
          textAlign: 'right',
        }}>
          <div style={{ color: textPrimary, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1.2 }}>{time}</div>
          <div style={{ color: textMuted, fontSize: 9, lineHeight: 1 }}>{date}</div>
        </div>

        {/* Notifications */}
        <button style={{
          position: 'relative', padding: 7, borderRadius: 6,
          background: btnBg, border: `1px solid ${border}`,
          color: textSecond, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={14} />
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 6, height: 6, borderRadius: '50%',
            background: '#c8a951', boxShadow: '0 0 6px rgba(200,169,81,0.6)',
          }} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            padding: 7, borderRadius: 6, cursor: 'pointer',
            background: isDark ? 'rgba(200,169,81,0.08)' : 'rgba(200,169,81,0.15)',
            border: '1px solid rgba(200,169,81,0.25)',
            color: '#c8a951',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Settings */}
        <button style={{
          padding: 7, borderRadius: 6, background: btnBg,
          border: `1px solid ${border}`, color: textSecond, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={14} />
        </button>

        {/* User */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 4px 6px', borderRadius: 6,
          background: btnBg, border: `1px solid ${border}`, cursor: 'pointer',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'linear-gradient(135deg, #002147, #1a4a7a)',
            border: '1px solid #c8a951',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#c8a951', fontSize: 10, fontWeight: 700,
          }}>A</div>
          <span style={{ color: textSecond, fontSize: 11 }}>Abubakar</span>
          <ChevronDown size={10} style={{ color: textMuted }} />
        </button>
      </div>
    </nav>
  );
}
