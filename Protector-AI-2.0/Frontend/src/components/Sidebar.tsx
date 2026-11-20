import React from 'react';
import {
  Camera,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  UserCheck,
  Users,
  Settings,
  ShieldCheck,
  Lock,
  LogOut
} from 'lucide-react';
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
  currentUser,
  onLogout
}) => {
  const isOperator = currentUser?.role === 'Operator';

  const navItems = [
    { id: 'console', label: 'Console', icon: Camera },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: openIncidentsCount > 0 ? openIncidentsCount : undefined },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'people', label: 'People', icon: UserCheck, adminOnly: true },
    { id: 'team', label: 'Team', icon: Users, adminOnly: true },
    { id: 'settings', label: 'System', icon: Settings, adminOnly: true }
  ];

  return (
    <aside style={{
      width: '230px',
      backgroundColor: 'var(--bg-app)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      userSelect: 'none',
      zIndex: 30,
      flexShrink: 0
    }}>
      {/* Top: Brand & Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Brand Header */}
        <div style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '10px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-citron)'
          }}>
            <ShieldCheck size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontWeight: 800,
              fontSize: '13.5px',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.2
            }}>
              PROTECTOR AI
            </span>
            <span style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.02em'
            }}>
              Industrial Operations
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
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
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: isRestricted ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background-color 0.12s ease, color 0.12s ease',
                  opacity: isRestricted ? 0.45 : 1,
                  textAlign: 'left'
                }}
                title={isRestricted ? `${item.label} (Admin Only)` : item.label}
              >
                <Icon
                  size={16}
                  style={{
                    color: isActive ? 'var(--accent-citron)' : 'var(--text-tertiary)',
                    flexShrink: 0
                  }}
                />

                <span style={{ flex: 1, letterSpacing: '-0.01em' }}>
                  {item.label}
                </span>

                {isRestricted && (
                  <Lock size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                )}

                {item.badge !== undefined && (
                  <span style={{
                    backgroundColor: 'var(--safety-violation)',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    lineHeight: 1.3
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: User Card & Sign Out */}
      {currentUser && (
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              flexShrink: 0
            }}>
              {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'OP'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {currentUser.name || currentUser.username}
              </span>
              <span style={{
                fontSize: '10.5px',
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap'
              }}>
                {currentUser.role}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease'
              }}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
