import React from 'react';
import { ShieldCheck, Users, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
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
  const complianceRate = stats ? stats.compliance_rate : 95.6;
  const activeWorkers = stats ? stats.active_workers_monitored : 42;
  const activeViolations = stats ? stats.active_violations : 4;
  const modelClasses = status?.model_classes || 25;

  return (
    <div style={{
      marginBottom: '24px',
      paddingBottom: '20px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Overview Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Operational Surveillance Console
          </h1>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            margin: '4px 0 0 0'
          }}>
            Real-time workplace hazard detection, automated PPE compliance verification, and personnel surveillance.
          </p>
        </div>

        {onNavigate && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigate('incidents')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <span>View Open Incidents</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Operational Metrics Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        {/* Metric 1: Compliance */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              PPE COMPLIANCE
            </span>
            <ShieldCheck size={15} style={{ color: 'var(--safety-safe)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--safety-safe)' }}>
              {complianceRate}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              site average
            </span>
          </div>
        </div>

        {/* Metric 2: Workers */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DETECTED PERSONNEL
            </span>
            <Users size={15} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeWorkers}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              monitored
            </span>
          </div>
        </div>

        {/* Metric 3: Active Violations */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ACTIVE VIOLATIONS
            </span>
            <AlertTriangle size={15} style={{ color: activeViolations > 0 ? 'var(--safety-violation)' : 'var(--safety-safe)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '24px',
              fontWeight: 700,
              color: activeViolations > 0 ? 'var(--safety-violation)' : 'var(--safety-safe)'
            }}>
              {activeViolations}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              open infractions
            </span>
          </div>
        </div>

        {/* Metric 4: Vision Model */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              VISION MODEL
            </span>
            <Activity size={15} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
              YOLOv8
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {modelClasses} classes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
