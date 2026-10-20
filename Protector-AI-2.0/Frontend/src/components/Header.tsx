import React from 'react';
import { Sun, Moon } from 'lucide-react';
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
      case 'console': return 'Live Optical Console';
      case 'incidents': return 'Incident Log & Auditing';
      case 'analytics': return 'Safety Telemetry Analytics';
      case 'people': return 'Consent-Based People Log';
      case 'team': return 'Team Access & Authorization';
      case 'settings': return 'System Settings & Diagnostics';
      default: return 'Overview';
    }
  };

  const isAdministrator = currentUser?.role === 'Administrator';

  return (
    <header style={{
      height: '52px',
      backgroundColor: 'var(--bg-app)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      {/* Left: Section Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{
          fontSize: '13.5px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)'
        }}>
          {getBreadcrumbTitle(activeModule)}
        </span>

        {currentUser && (
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 7px',
            borderRadius: '4px',
            border: '1px solid',
            borderColor: isAdministrator ? 'rgba(215, 255, 100, 0.3)' : 'rgba(99, 214, 161, 0.3)',
            backgroundColor: isAdministrator ? 'rgba(215, 255, 100, 0.1)' : 'rgba(99, 214, 161, 0.1)',
            color: isAdministrator ? 'var(--accent-citron)' : 'var(--safety-safe)',
            fontWeight: 700,
            letterSpacing: '0.05em'
          }}>
            {currentUser.role.toUpperCase()}
          </span>
        )}
      </div>


      {/* Right: Functional Triggers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Terminal Slidebar Trigger */}
        {onOpenTerminal && (
          <button
            onClick={onOpenTerminal}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title="Open Terminal Slidebar [⌘K]"
          >
            <span style={{ color: 'var(--accent-citron)' }}>&gt;_</span>
            <span>Terminal</span>
            <span style={{
              fontSize: '9.5px',
              color: 'var(--accent-citron)',
              backgroundColor: 'rgba(215, 255, 100, 0.1)',
              padding: '1px 5px',
              borderRadius: '3px'
            }}>
              ⌘K
            </span>
          </button>
        )}

        {/* Minimal Theme Switcher */}
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

        {/* Logout button */}
        {currentUser && (
          <button
            onClick={onLogout}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              cursor: 'pointer'
            }}
            title="Sign out of Protector AI"
          >
            LOGOUT
          </button>
        )}
      </div>
    </header>
  );
};
