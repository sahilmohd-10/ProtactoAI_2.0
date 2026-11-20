import React, { useState } from 'react';
import type { AnalyticsData, PPEStats } from '../types';
import { api } from '../services/api';
import { ArrowUpRight, Download, Filter, RefreshCw, Box } from 'lucide-react';
import { Analytics3DChart } from './Analytics3DChart';

interface AnalyticsProps {
  analytics: AnalyticsData | null;
  stats: PPEStats | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({ analytics, stats }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [hoveredMonth, setHoveredMonth] = useState<number>(4); // default May

  const complianceRate = stats?.compliance_rate ?? 98.4;
  const activeWorkers = stats?.active_workers_monitored ?? 360524;
  const activeViolations = stats?.active_violations ?? 4;
  const totalViolations = (stats as any)?.total_violations_today ?? 15491;

  const handleExport = () => {
    window.open(`${api.baseUrl}/api/attendance/export-csv`, '_blank');
  };

  // Monthly trend datapoints matching Image 2 dual-line graph
  const trendData = [
    { month: 'Jan', affected: 52000, safe: 88000, compliance: 92.4 },
    { month: 'Feb', affected: 64000, safe: 95000, compliance: 94.1 },
    { month: 'Mar', affected: 48000, safe: 104000, compliance: 95.8 },
    { month: 'Apr', affected: 72000, safe: 112000, compliance: 97.2 },
    { month: 'May', affected: 80174, safe: 124000, compliance: 98.4 },
    { month: 'Jun', affected: 59000, safe: 130000, compliance: 98.9 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        padding: '20px 24px',
        borderRadius: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#16A34A'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>
              PROTECTOR AI • WORKFORCE ANALYTICS
            </span>
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            margin: '4px 0 0 0'
          }}>
            Operational Safety & Incident Statistics
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Period selector */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '10px',
            gap: '2px'
          }}>
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: selectedPeriod === p ? 700 : 500,
                  backgroundColor: selectedPeriod === p ? '#FFFFFF' : 'transparent',
                  color: selectedPeriod === p ? '#1D4ED8' : '#64748B',
                  boxShadow: selectedPeriod === p ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: '#1D4ED8',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)'
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Top KPI Cards (Matching Image 2 Exactly) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px'
      }}>
        {/* Card 1: Total Workforce / Total Cases */}
        <div className="stat-card-modern">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Workforce</span>
            <span className="stat-card-arrow stat-card-arrow-red">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="stat-card-value">
            {activeWorkers.toLocaleString()}
          </div>
          <div className="stat-card-subtext">
            Active monitored personnel across sectors
          </div>
          {/* Smooth Red Sparkline */}
          <svg className="stat-card-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
            <path
              d="M0 32 Q 25 15, 50 35 T 100 20 T 150 38 T 200 25"
              fill="none"
              stroke="#F87171"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 2: PPE Compliance / Recovered */}
        <div className="stat-card-modern">
          <div className="stat-card-header">
            <span className="stat-card-title">PPE Compliance Rate</span>
            <span className="stat-card-arrow stat-card-arrow-green">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="stat-card-value" style={{ color: '#16A34A' }}>
            {complianceRate}%
          </div>
          <div className="stat-card-subtext">
            Verified hardhat, vest, and protective gear
          </div>
          {/* Smooth Green Sparkline */}
          <svg className="stat-card-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
            <path
              d="M0 38 Q 30 40, 60 22 T 120 28 T 160 12 T 200 16"
              fill="none"
              stroke="#22C55E"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 3: Active Hazards / Active Cases */}
        <div className="stat-card-modern">
          <div className="stat-card-header">
            <span className="stat-card-title">Active Hazards</span>
            <span className="stat-card-arrow stat-card-arrow-red">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="stat-card-value">
            244,375
          </div>
          <div className="stat-card-subtext">
            Monitored industrial zones & machines
          </div>
          {/* Smooth Red Sparkline */}
          <svg className="stat-card-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
            <path
              d="M0 40 Q 35 30, 70 38 T 130 18 T 170 32 T 200 20"
              fill="none"
              stroke="#F87171"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Card 4: Total Violations Logged */}
        <div className="stat-card-modern">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Violations Logged</span>
            <span className="stat-card-arrow stat-card-arrow-red">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="stat-card-value" style={{ color: '#DC2626' }}>
            {totalViolations.toLocaleString()}
          </div>
          <div className="stat-card-subtext">
            Historical safety infractions logged
          </div>
          {/* Smooth Red Sparkline */}
          <svg className="stat-card-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
            <path
              d="M0 35 Q 30 18, 60 32 T 110 16 T 150 30 T 200 22"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Interactive 3D Industrial Safety Analytics Visualizer */}
      <Analytics3DChart analytics={analytics} stats={stats} />

      {/* Middle Section: Ratio of Compliance + Dual Wavy Trend Line (Image 2 Exactly) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 380px) 1fr',
        gap: '24px'
      }}>
        {/* Left: Ratio of Compliance (Matching "Ratio of Recovery" in Image 2) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '28px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Ratio of Compliance
            </h2>
            <button
              type="button"
              onClick={() => alert('Detailed breakdown: 94.2% Protected, 4.6% Warning, 1.2% Infraction.')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View Details
            </button>
          </div>

          {/* Semicircular / Radial Donut Progress Meter */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '28px 0 20px 0',
            position: 'relative'
          }}>
            <svg viewBox="0 0 200 120" style={{ width: '220px', height: '130px', overflow: 'visible' }}>
              {/* Outer Red Arc */}
              <path
                d="M 20 110 A 80 80 0 0 1 180 110"
                fill="none"
                stroke="#FEE2E2"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <path
                d="M 20 110 A 80 80 0 0 1 180 110"
                fill="none"
                stroke="#EF4444"
                strokeWidth="18"
                strokeDasharray="251"
                strokeDashoffset="60"
                strokeLinecap="round"
              />
              {/* Inner Green Arc */}
              <path
                d="M 45 110 A 55 55 0 0 1 155 110"
                fill="none"
                stroke="#DCFCE7"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M 45 110 A 55 55 0 0 1 155 110"
                fill="none"
                stroke="#22C55E"
                strokeWidth="14"
                strokeDasharray="172"
                strokeDashoffset="35"
                strokeLinecap="round"
              />
            </svg>

            {/* Central Score Value */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              textAlign: 'center'
            }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 900,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                94.2%
              </span>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                Overall Compliance
              </div>
            </div>
          </div>

          {/* Breakdown Legend Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Fully Protected</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>94.2%</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Violations / Hazards</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>5.8%</span>
            </div>
          </div>
        </div>

        {/* Right: Workforce & Safety Trend Wavy Graph (Image 2 Right Graph) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '28px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* Header & Legend */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Workforce Safety & Incident Trajectory
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                Multi-month trajectory of verified safe personnel vs detected risk events
              </p>
            </div>

            {/* Legend matching Image 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Infractions</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Safe Compliance</span>
              </div>
            </div>
          </div>

          {/* SVG Wavy Dual-Line Chart with Interactive Floating Tooltip */}
          <div style={{ position: 'relative', width: '100%', height: '240px', marginTop: '10px' }}>
            <svg
              viewBox="0 0 600 200"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              {/* Subtle Horizontal Grid lines */}
              <line x1="0" y1="40" x2="600" y2="40" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="#F1F5F9" strokeWidth="1" />

              {/* Green Line: Safe Compliance Curve */}
              <path
                d="M 20 130 C 80 150, 130 90, 180 110 C 240 130, 280 80, 340 70 C 400 60, 460 30, 520 50 C 560 65, 580 40, 600 45"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Red Line: Hazard Infraction Curve */}
              <path
                d="M 20 160 C 70 190, 120 130, 180 170 C 230 195, 290 120, 350 140 C 410 160, 470 100, 530 130 C 570 145, 590 125, 600 135"
                fill="none"
                stroke="#EF4444"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Data points along curve */}
              {[
                { x: 20, yGreen: 130, yRed: 160 },
                { x: 140, yGreen: 95, yRed: 140 },
                { x: 260, yGreen: 90, yRed: 155 },
                { x: 380, yGreen: 65, yRed: 145 },
                { x: 490, yGreen: 38, yRed: 110 },
                { x: 580, yGreen: 42, yRed: 130 },
              ].map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.yGreen}
                    r={hoveredMonth === i ? 6 : 4}
                    fill="#FFFFFF"
                    stroke="#22C55E"
                    strokeWidth="3"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredMonth(i)}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.yRed}
                    r={hoveredMonth === i ? 6 : 4}
                    fill="#FFFFFF"
                    stroke="#EF4444"
                    strokeWidth="3"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredMonth(i)}
                  />
                </g>
              ))}
            </svg>

            {/* Interactive Floating Tooltip (Exact match to "Affected 80.174" in Image 2) */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '78%',
              transform: 'translateX(-50%)',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '10px 16px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              border: '1px solid #E2E8F0',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                May • Affected Personnel
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0F172A',
                marginTop: '2px'
              }}>
                80,174
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#16A34A',
                marginTop: '2px'
              }}>
                98.4% PPE Compliance
              </div>
            </div>
          </div>

          {/* Month labels along X axis */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px 0 16px',
            borderTop: '1px solid #F1F5F9'
          }}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, idx) => (
              <span
                key={m}
                onClick={() => setHoveredMonth(idx)}
                style={{
                  fontSize: '12px',
                  fontWeight: hoveredMonth === idx ? 700 : 500,
                  color: hoveredMonth === idx ? '#1D4ED8' : '#94A3B8',
                  cursor: 'pointer'
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
