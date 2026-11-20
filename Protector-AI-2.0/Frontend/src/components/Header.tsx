import React from 'react';
import { Sun, Moon, Terminal, Shield, LogOut } from 'lucide-react';
import type { SystemStatus, AuthUser } from '../types';

interface HeaderProps {
  systemStatus: SystemStatus | null;
  activeModule: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenTerminal?: () => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  systemStatus,
  activeModule,
  theme,
  onToggleTheme,
  onOpenTerminal,
  currentUser,
  onLogout
}) => {
  const getBreadcrumbTitle = (mod: string) => {
    switch (mod) {
      case 'console': return 'Live Monitoring Console';
      case 'incidents': return 'Incident Management & Audit';
      case 'analytics': return 'Safety Analytics & Metrics';
      case 'attendance': return 'Biometric Attendance Register';
      case 'people': return 'Personnel Registry & Biometrics';
      case 'team': return 'Team Management & Access';
      case 'settings': return 'System Health & Diagnostics';
      default: return 'Operational Overview';
    }
  };

  const isAdministrator = currentUser?.role === 'Administrator';

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'var(--bg-app)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      {/* Left: Module title & operational status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary)',
          margin: 0
        }}>
          {getBreadcrumbTitle(activeModule)}
        </h2>

        {/* System Engine Status Dot */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.2)'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#22C55E'
          }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#4ADE80'
          }}>
            YOLOv8 Active
          </span>
        </div>
      </div>

      {/* Right: Functional Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Terminal Trigger */}
        {onOpenTerminal && (
          <button
            onClick={onOpenTerminal}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'border-color 0.15s ease'
            }}
            title="Open Command Terminal (⌘K or Ctrl+K)"
          >
            <Terminal size={13} style={{ color: 'var(--accent-citron)' }} />
            <span>Terminal</span>
            <kbd style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-app)',
              padding: '1px 4px',
              borderRadius: '3px',
              border: '1px solid var(--border-subtle)'
            }}>
              ⌘K
            </kbd>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* User Role Tag */}
        {currentUser && (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid',
            borderColor: isAdministrator ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-medium)',
            backgroundColor: isAdministrator ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-elevated)',
            color: isAdministrator ? '#34D399' : 'var(--text-secondary)',
            fontWeight: 600
          }}>
            {currentUser.role}
          </span>
        )}
      </div>
    </header>
  );
};
