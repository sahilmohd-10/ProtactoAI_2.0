import React from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import type { PPEStats, SystemStatus } from '../types';

interface WelcomeHeroProps {
  stats: PPEStats | null;
  status: SystemStatus | null;
  onNavigate?: (module: string) => void;
  onOpenTerminal?: () => void;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  stats,
  status,
  onNavigate
}) => {
  const complianceRate = stats ? stats.compliance_rate : 98.4;
  const activeWorkers = stats ? stats.active_workers_monitored : 360524;
  const activeViolations = stats ? stats.active_violations : 244375;
  const totalViolations = (stats as any)?.total_violations_today ?? 15491;

  return (
    <div style={{
      marginBottom: '28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Top Banner Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
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
              PROTECTOR AI • INDUSTRIAL SAFETY INTELLIGENCE
            </span>
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#0F172A',
            margin: '4px 0 0 0'
          }}>
            Operational Surveillance & Live Hazard Console
          </h1>
        </div>

        {onNavigate && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigate('analytics')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)'
              }}
            >
              <span>View Full Analytics</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 4 Metric Cards (Matching Image 2 Style with SVG Sparklines) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px'
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
            Active monitored personnel
          </div>
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
            Verified compliant personnel
          </div>
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
            {activeViolations.toLocaleString()}
          </div>
          <div className="stat-card-subtext">
            Real-time hazard detections
          </div>
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
            Historical safety infractions
          </div>
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
    </div>
  );
};
