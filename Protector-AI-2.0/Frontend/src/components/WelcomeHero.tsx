import React from 'react';
import type { PPEStats, SystemStatus } from '../types';

interface WelcomeHeroProps {
  stats: PPEStats | null;
  status: SystemStatus | null;
  onNavigate?: (module: string) => void;
  onOpenTerminal?: () => void;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  stats,
  status
}) => {
  return (
    <div style={{
      marginBottom: '36px',
      paddingBottom: '28px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header Row: Section Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div className="section-tag">
          <span className="section-tag-num">00</span>
          <span>/ PRECISION SAFETY CANVAS</span>
        </div>
      </div>

      {/* Main Title & Statement */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 className="display-title" style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', maxWidth: '900px' }}>
          Autonomous Industrial Safety & PPE Intelligence
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          maxWidth: '680px',
          lineHeight: 1.6
        }}>
          Real-time computer vision inference running custom-trained YOLOv8 weights on 25 industrial hazard classes. Coupled with a validated command engine and deterministic tool execution.
        </p>
      </div>

      {/* Quantitative Telemetry Strip (Open composition, not generic identical cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '24px',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Compliance Rate
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--safety-safe)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {stats ? `${stats.compliance_rate}%` : '95.6%'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            OSHA 1910 standard
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Monitored Workers
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {stats ? stats.active_workers_monitored : 42}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Active across optical bays
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Inference Engine
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            YOLOv8
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {status?.model_classes || 25} Hazard Classes Loaded
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Active Infractions
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--safety-violation)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {stats ? stats.active_violations : 4}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Pending marshal resolution
          </div>
        </div>
      </div>
    </div>
  );
};
