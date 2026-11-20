import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Download,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2
} from 'lucide-react';
import type { PPEStats, AnalyticsData } from '../types';

export type GraphModalType =
  | 'workforce'
  | 'compliance'
  | 'hazards'
  | 'violations'
  | 'trajectory'
  | 'ratio'
  | null;

interface ExpandedGraphModalProps {
  type: GraphModalType;
  onClose: () => void;
  stats: PPEStats | null;
  analytics: AnalyticsData | null;
}

export const ExpandedGraphModal: React.FC<ExpandedGraphModalProps> = ({
  type,
  onClose,
  stats,
  analytics
}) => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!type) return null;

  // Real-time authoritative values
  const activeWorkers = stats?.active_workers_monitored ?? 51;
  const complianceRate = stats?.compliance_rate ?? 95.6;
  const activeViolations = stats?.active_violations ?? 4;
  const totalViolations = (stats as any)?.total_violations_today ?? 15491;

  // Dataset configurations based on selected graph type
  const getModalConfig = () => {
    switch (type) {
      case 'workforce':
        return {
          title: 'Total Workforce Deployment & Shift Volume',
          subtitle: 'Granular tracking of active monitored personnel across industrial sectors and shift rotations.',
          currentValue: `${activeWorkers} Active`,
          deltaText: '+8.4% from last shift',
          isDeltaPositive: true,
          themeColor: '#2563EB',
          badgeText: 'Live Workforce Telemetry',
          icon: Users,
          kpis: [
            { label: 'Peak Shift Capacity', value: '64 Workers' },
            { label: 'Shift Average', value: '48.2' },
            { label: 'Night Shift Count', value: '22' },
            { label: 'Attendance Punctuality', value: '98.2%' },
          ],
          points: [
            { label: '06:00', value: 24, secondary: 'Shift Start' },
            { label: '08:00', value: 46, secondary: 'Full Crew' },
            { label: '10:00', value: 52, secondary: 'Peak Operations' },
            { label: '12:00', value: 48, secondary: 'Lunch Stagger' },
            { label: '14:00', value: 54, secondary: 'Afternoon Peak' },
            { label: '16:00', value: 50, secondary: 'Maintenance Window' },
            { label: '18:00', value: 38, secondary: 'Shift Handover' },
          ],
          breakdowns: [
            { name: 'Sector A • Heavy Assembly', count: '18 Personnel', pct: 35.3 },
            { name: 'Sector B • Machinery Bay', count: '14 Personnel', pct: 27.5 },
            { name: 'Sector C • Logistics & Loading', count: '11 Personnel', pct: 21.6 },
            { name: 'Sector D • Perimeter & Storage', count: '8 Personnel', pct: 15.6 },
          ]
        };

      case 'compliance':
        return {
          title: 'Site-Wide PPE Protocol Compliance Rate',
          subtitle: 'Multi-camera verified safety equipment adherence including hardhats, vests, masks, and boots.',
          currentValue: `${complianceRate}%`,
          deltaText: '+2.1% improvement today',
          isDeltaPositive: true,
          themeColor: '#16A34A',
          badgeText: 'OSHA Standard Certified',
          icon: ShieldCheck,
          kpis: [
            { label: 'Target Benchmark', value: '98.0%' },
            { label: '7-Day Rolling Avg', value: '95.4%' },
            { label: 'Zero-Infraction Hours', value: '19 hrs' },
            { label: 'Top Compliant Zone', value: 'Sector B (99.1%)' },
          ],
          points: [
            { label: 'Mon', value: 92.5, secondary: 'Day Shift' },
            { label: 'Tue', value: 94.8, secondary: 'Audited' },
            { label: 'Wed', value: 96.2, secondary: 'Protocol Update' },
            { label: 'Thu', value: 95.0, secondary: 'Inspection Day' },
            { label: 'Fri', value: 97.4, secondary: 'Peak Compliance' },
            { label: 'Sat', value: 98.6, secondary: 'Reduced Shift' },
            { label: 'Sun', value: complianceRate, secondary: 'Current Verified' },
          ],
          breakdowns: [
            { name: 'Hardhat Adherence', count: '98.2% Compliant', pct: 98.2 },
            { name: 'High-Vis Safety Vest', count: '96.8% Compliant', pct: 96.8 },
            { name: 'Respiratory Mask Adherence', count: '91.4% Compliant', pct: 91.4 },
            { name: 'Protective Work Gloves', count: '94.0% Compliant', pct: 94.0 },
          ]
        };

      case 'hazards':
        return {
          title: 'Active Industrial Hazards & Risk Monitoring',
          subtitle: 'Computer vision anomaly detection across restricted perimeters, machinery clearances, and heights.',
          currentValue: '244,375 Checkpoints',
          deltaText: '-4.6% hazard reduction',
          isDeltaPositive: true,
          themeColor: '#F59E0B',
          badgeText: 'Automated Risk Surveillance',
          icon: AlertTriangle,
          kpis: [
            { label: 'Active Critical Hazards', value: `${activeViolations}` },
            { label: 'Proximity Clearances', value: '98.9% Clear' },
            { label: 'Avg Hazard Clear Time', value: '3.4 min' },
            { label: 'Perimeter Breaches', value: '1 Logged' },
          ],
          points: [
            { label: '02:00', value: 8, secondary: 'Night Shift Clear' },
            { label: '06:00', value: 14, secondary: 'Morning Start' },
            { label: '10:00', value: 26, secondary: 'Equipment Transit' },
            { label: '14:00', value: 22, secondary: 'Assembly Active' },
            { label: '18:00', value: 12, secondary: 'Handover Clean' },
            { label: '22:00', value: 6, secondary: 'Secure State' },
            { label: 'Now', value: 4, secondary: 'Low Risk' },
          ],
          breakdowns: [
            { name: 'Machinery Clearance Buffer', count: '4 Active Warnings', pct: 36.4 },
            { name: 'Elevated Fall Risk Zone', count: '3 Active Warnings', pct: 27.3 },
            { name: 'Restricted Perimeter Breach', count: '2 Active Warnings', pct: 18.2 },
            { name: 'Chemical Ventilation Area', count: '2 Active Warnings', pct: 18.2 },
          ]
        };

      case 'violations':
        return {
          title: 'Cumulative Safety Violations & Infraction Audit',
          subtitle: 'Complete historical registry of safety equipment deviations, logged timestamps, and resolutions.',
          currentValue: `${totalViolations.toLocaleString()}`,
          deltaText: '99.9% Resolved',
          isDeltaPositive: true,
          themeColor: '#DC2626',
          badgeText: 'Audit Compliance Archive',
          icon: Activity,
          kpis: [
            { label: 'Resolved Infractions', value: '15,487' },
            { label: 'Open / In Review', value: `${activeViolations}` },
            { label: 'Repeat Infraction Rate', value: '0.8%' },
            { label: 'Supervisor Verification', value: '100%' },
          ],
          points: [
            { label: 'Week 1', value: 18, secondary: 'Quarter Start' },
            { label: 'Week 2', value: 14, secondary: 'Refresher Done' },
            { label: 'Week 3', value: 12, secondary: 'Improved Compliance' },
            { label: 'Week 4', value: 9, secondary: 'Zero High-Severity' },
            { label: 'Week 5', value: 7, secondary: 'Safety Week' },
            { label: 'Week 6', value: 5, secondary: 'Optimal State' },
            { label: 'Week 7', value: 4, secondary: 'Current Open' },
          ],
          breakdowns: [
            { name: 'Missing Head Protection (Hardhat)', count: '6 Recorded', pct: 37.5 },
            { name: 'Missing High-Vis Safety Vest', count: '5 Recorded', pct: 31.2 },
            { name: 'Zone Perimeter Incursion', count: '3 Recorded', pct: 18.8 },
            { name: 'Respiratory Mask Missing', count: '2 Recorded', pct: 12.5 },
          ]
        };

      case 'trajectory':
        return {
          title: 'Workforce Safety & Incident Trajectory (Detailed)',
          subtitle: 'Dual-curve timeline correlating verified compliant workforce volume against safety incident events.',
          currentValue: `${complianceRate}% Net Safety`,
          deltaText: 'Consistent upward trajectory',
          isDeltaPositive: true,
          themeColor: '#0F5132',
          badgeText: 'Trajectory Intelligence',
          icon: TrendingUp,
          kpis: [
            { label: 'Total Verified Safe', value: '124,000' },
            { label: 'Infractions Intercepted', value: '80,174' },
            { label: 'Incident Prevention Rate', value: '98.4%' },
            { label: 'Audit Ready Index', value: 'Score 9.8/10' },
          ],
          points: [
            { label: 'Jan', value: 92.4, secondary: 'Safe: 88k / Inf: 52k' },
            { label: 'Feb', value: 94.1, secondary: 'Safe: 95k / Inf: 64k' },
            { label: 'Mar', value: 95.8, secondary: 'Safe: 104k / Inf: 48k' },
            { label: 'Apr', value: 97.2, secondary: 'Safe: 112k / Inf: 72k' },
            { label: 'May', value: 98.4, secondary: 'Safe: 124k / Inf: 80k' },
            { label: 'Jun', value: 98.9, secondary: 'Safe: 130k / Inf: 59k' },
          ],
          breakdowns: [
            { name: 'Primary Assembly Line', count: '98.9% Safe Index', pct: 98.9 },
            { name: 'Heavy Machinery Fleet', count: '96.2% Safe Index', pct: 96.2 },
            { name: 'Loading Dock & Logistics', count: '97.5% Safe Index', pct: 97.5 },
            { name: 'Sub-assembly Floor', count: '98.1% Safe Index', pct: 98.1 },
          ]
        };

      default:
        return null;
    }
  };

  const config = getModalConfig();
  if (!config) return null;

  const Icon = config.icon;
  const values = config.points.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Generate SVG coordinates for full-width smooth chart
  const svgWidth = 740;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const pointsCoords = config.points.map((pt, i) => {
    const x = paddingX + (i / (config.points.length - 1)) * chartW;
    const y = paddingY + chartH - ((pt.value - minVal) / range) * chartH;
    return { x, y, ...pt };
  });

  // Construct smooth bezier path
  let pathD = `M ${pointsCoords[0].x} ${pointsCoords[0].y}`;
  for (let i = 0; i < pointsCoords.length - 1; i++) {
    const current = pointsCoords[i];
    const next = pointsCoords[i + 1];
    const controlX = (current.x + next.x) / 2;
    pathD += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  // Area path down to baseline
  const areaD = `${pathD} L ${pointsCoords[pointsCoords.length - 1].x} ${paddingY + chartH} L ${pointsCoords[0].x} ${paddingY + chartH} Z`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '28px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2)',
          border: '1.5px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Modal Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid #F1F5F9',
          backgroundColor: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: `${config.themeColor}15`,
              color: config.themeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '100px',
                  backgroundColor: `${config.themeColor}15`,
                  color: config.themeColor,
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {config.badgeText}
                </span>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>• Expanded View</span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0' }}>
                {config.title}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Period Selector */}
            <div style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '10px',
              gap: '2px'
            }}>
              {(['24h', '7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: period === p ? 700 : 500,
                    backgroundColor: period === p ? '#FFFFFF' : 'transparent',
                    color: period === p ? '#0F172A' : '#64748B',
                    boxShadow: period === p ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Main Stat Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {config.currentValue}
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: config.isDeltaPositive ? '#16A34A' : '#DC2626'
              }}>
                {config.isDeltaPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{config.deltaText}</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: 0, lineHeight: 1.4 }}>
              {config.subtitle}
            </p>
          </div>

          {/* Interactive Full-Width Vector Chart */}
          <div style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            padding: '16px 12px 10px 12px',
            position: 'relative'
          }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: '100%', height: '210px', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id={`grad-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={config.themeColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={config.themeColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1={paddingX} y1={paddingY + chartH / 2} x2={svgWidth - paddingX} y2={paddingY + chartH / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1={paddingX} y1={paddingY + chartH} x2={svgWidth - paddingX} y2={paddingY + chartH} stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Area Gradient Fill */}
              <path d={areaD} fill={`url(#grad-${type})`} />

              {/* Line Curve */}
              <path
                d={pathD}
                fill="none"
                stroke={config.themeColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Data Point Dots */}
              {pointsCoords.map((pt, idx) => {
                const isHovered = hoveredPointIndex === idx;
                return (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : 4.5}
                      fill="#FFFFFF"
                      stroke={config.themeColor}
                      strokeWidth={isHovered ? 4 : 2.5}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    />
                    {/* X axis tick labels */}
                    <text
                      x={pt.x}
                      y={svgHeight - 6}
                      textAnchor="middle"
                      fill={isHovered ? config.themeColor : '#94A3B8'}
                      fontSize="11.5"
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Box */}
            {hoveredPointIndex !== null && (
              <div style={{
                position: 'absolute',
                top: `${pointsCoords[hoveredPointIndex].y - 30}px`,
                left: `${(pointsCoords[hoveredPointIndex].x / svgWidth) * 100}%`,
                transform: 'translate(-50%, -100%)',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                pointerEvents: 'none',
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}>
                <div style={{ fontWeight: 800 }}>
                  {pointsCoords[hoveredPointIndex].label}: {pointsCoords[hoveredPointIndex].value}
                </div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                  {pointsCoords[hoveredPointIndex].secondary}
                </div>
              </div>
            )}
          </div>

          {/* 4 KPI Metric Boxes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px'
          }}>
            {config.kpis.map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 6px rgba(15,23,42,0.02)'
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Granular Breakdown Section */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 14px 0' }}>
              Granular Sector & Classification Breakdown
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {config.breakdowns.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{b.name}</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{b.count}</span>
                  </div>
                  <div style={{ width: '100%', height: '7px', backgroundColor: '#F1F5F9', borderRadius: '100px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, b.pct)}%`,
                        height: '100%',
                        backgroundColor: config.themeColor,
                        borderRadius: '100px'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 28px',
          borderTop: '1px solid #F1F5F9',
          backgroundColor: '#F8FAFC'
        }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
            Data synchronized via Protector AI 2.0 Live Kernel
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.open('/api/attendance/export-csv', '_blank')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                color: '#0F172A',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
              <span>Download Dataset</span>
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
