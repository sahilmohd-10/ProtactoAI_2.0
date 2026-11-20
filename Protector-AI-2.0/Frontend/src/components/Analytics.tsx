import React, { useState } from 'react';
import type { AnalyticsData, PPEStats } from '../types';
import { api } from '../services/api';

interface AnalyticsProps {
  analytics: AnalyticsData | null;
  stats: PPEStats | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({ analytics }) => {
  const [selectedRange, setSelectedRange] = useState<number>(7);

  const metrics = analytics?.historical_metrics || [];
  const categories = analytics?.category_distribution || {
    'Missing Hardhat': 14,
    'Missing Safety Vest': 9,
    'Missing Mask': 5,
    'Missing Gloves': 7,
    'Zone Breach': 3
  };
  const hourly = analytics?.hourly_distribution || [];

  const handleExportReport = () => {
    window.open(`${api.baseUrl}/api/incidents/export?format=csv&period=${selectedRange}d`, '_blank');
  };

  const renderTrendChart = () => {
    if (!metrics || metrics.length === 0) return null;

    const width = 600;
    const height = 180;
    const padding = 30;
    const minRate = 85;
    const maxRate = 100;

    const points = metrics.map((m, i) => {
      const x = padding + (i / (metrics.length - 1)) * (width - padding * 2);
      const y = height - padding - ((m.compliance_rate - minRate) / (maxRate - minRate)) * (height - padding * 2);
      return { x, y, rate: m.compliance_rate, date: m.date };
    });

    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '220px', overflow: 'visible' }}>
        {[90, 95, 100].map((val) => {
          const y = height - padding - ((val - minRate) / (maxRate - minRate)) * (height - padding * 2);
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <text x={padding - 8} y={y + 4} fill="var(--text-tertiary)" fontSize="9.5" fontFamily="var(--font-mono)" textAnchor="end">
                {val}%
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="citronGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-citron)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent-citron)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="url(#citronGradient)"
        />

        <path d={pathD} fill="none" stroke="var(--accent-citron)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="var(--bg-app)" stroke="var(--accent-citron)" strokeWidth="2" />
            <text x={pt.x} y={height - 10} fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">
              {pt.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const totalViolations = Object.values(categories).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Compliance Analytics & Trends
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Comprehensive safety performance indicators, PPE compliance metrics, and risk distributions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '2px'
          }}>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedRange(d)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: selectedRange === d ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: selectedRange === d ? 'var(--accent-citron)' : 'var(--text-tertiary)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: selectedRange === d ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                {d}D
              </button>
            ))}
          </div>

          <button
            onClick={handleExportReport}
            className="btn-secondary"
          >
            Export CSV Report
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="precision-surface" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Mean Compliance
            </span>
            <span className="status-pill status-pill-safe">+1.4% WoW</span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--safety-safe)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {analytics ? `${analytics.average_compliance}%` : '95.6%'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Rolling fleet camera average
          </div>
        </div>

        <div className="precision-surface" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Peak Risk Hours
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            14:00 – 16:00
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Shift changeover interval
          </div>
        </div>

        <div className="precision-surface" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Top Infraction Category
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--safety-violation)', marginTop: '6px' }}>
            Missing Hardhat (37%)
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Primary optical detector flag
          </div>
        </div>

        <div className="precision-surface" style={{ padding: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Resolution Rate
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            92.8%
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Within 5-minute standard
          </div>
        </div>
      </div>

      {/* Trajectory Curve & Category Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Compliance Trend Chart */}
        <div className="precision-surface" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              7-Day Compliance Trajectory
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              OSHA Standard: 95%
            </span>
          </div>

          {renderTrendChart()}
        </div>

        {/* Category Breakdown */}
        <div className="precision-surface" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Infractions by Category
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(categories).map(([cat, count]) => {
              const pct = totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cat}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--bg-surface-elevated)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: cat.includes('Hardhat') ? 'var(--safety-violation)' : (cat.includes('Vest') ? 'var(--safety-warning)' : 'var(--accent-citron)'),
                        borderRadius: '2px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly Intensity Bar Chart */}
      <div className="precision-surface" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Hourly Incident Intensity (24-Hour Cycle)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', gap: '12px' }}>
          {hourly.map((h) => {
            const maxVal = Math.max(...hourly.map(x => x.count), 1);
            const heightPct = (h.count / maxVal) * 100;

            return (
              <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {h.count}
                </span>
                <div style={{
                  width: '100%',
                  maxWidth: '32px',
                  height: `${Math.max(6, heightPct)}%`,
                  backgroundColor: h.count > 5 ? 'var(--safety-violation)' : (h.count > 2 ? 'var(--safety-warning)' : 'var(--border-medium)'),
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s ease'
                }} />
                <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {h.hour}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
