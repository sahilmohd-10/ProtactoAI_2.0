import React from 'react';
import type { AuthUser } from '../types';

interface SidebarProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  openIncidentsCount: number;
  currentUser: AuthUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  openIncidentsCount,
  currentUser
}) => {
  const isOperator = currentUser?.role === 'Operator';

  const navItems = [
    { id: 'console', num: '01', label: 'Console' },
    { id: 'incidents', num: '02', label: 'Incidents', badge: openIncidentsCount > 0 ? openIncidentsCount : undefined },
    { id: 'analytics', num: '03', label: 'Analytics' },
    { id: 'people', num: '04', label: 'People', adminOnly: true },
    { id: 'team', num: '05', label: 'Team', adminOnly: true },
    { id: 'settings', num: '06', label: 'System', adminOnly: true }
  ];

  return (
    <aside style={{
      width: '220px',
      backgroundColor: 'var(--bg-app)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      userSelect: 'none',
      zIndex: 30,
      flexShrink: 0
    }}>
      {/* Top: Wordmark & Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Brand Header */}
        <div style={{
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: '14px',
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)'
            }}>
              PROTECTOR
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '12px',
              color: 'var(--accent-citron)'
            }}>
              .AI
            </span>
          </div>
        </div>

        {/* Minimal Precision Navigation */}
        <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            const isRestricted = isOperator && item.adminOnly;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isRestricted) onSelectModule(item.id);
                }}
                disabled={isRestricted}
                aria-label={isRestricted ? `${item.label}, Administrator only` : item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  justifyContent: 'flex-start',
                  borderRadius: '5px',
                  backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: isRestricted ? 'not-allowed' : 'pointer',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.12s ease',
                  opacity: isRestricted ? 0.6 : 1
                }}
                title={isRestricted ? `${item.label} (Administrator Only)` : item.label}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: isActive ? 'var(--accent-citron)' : 'var(--text-tertiary)',
                  width: '14px'
                }}>
                  {item.num}
                </span>

                <span style={{ flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>
                  {item.label}
                </span>

                {isRestricted && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}

                {item.badge !== undefined && (
                  <span style={{
                    backgroundColor: 'var(--safety-violation)',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    lineHeight: 1.2
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
