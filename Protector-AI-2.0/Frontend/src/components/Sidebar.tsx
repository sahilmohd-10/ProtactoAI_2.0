import React from 'react';
import {
  LayoutDashboard,
  Camera,
  AlertTriangle,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Lock,
  UserCheck,
  CalendarCheck
} from 'lucide-react';
import type { AuthUser } from '../types';

interface SidebarProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  openIncidentsCount: number;
  pendingOperatorsCount?: number;
  currentUser: AuthUser | null;
  onLogout?: () => void;
  onOpenTerminal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  openIncidentsCount,
  pendingOperatorsCount = 0,
  currentUser,
  onLogout,
  onOpenTerminal
}) => {
  const isOperator = currentUser?.role === 'Operator';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'console', label: 'Tasks / Camera', icon: Camera },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'attendance', label: 'Attendance & Excel', icon: CalendarCheck },
    {
      id: 'people',
      label: 'Face Training',
      icon: UserCheck,
      adminOnly: true
    },
    {
      id: 'team',
      label: 'Team & Auth',
      icon: Users,
      adminOnly: true,
      badge: pendingOperatorsCount > 0 ? `${pendingOperatorsCount} Pending` : undefined,
      isPendingBadge: true
    }
  ];

  const generalItems = [
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    { id: 'terminal', label: 'Help & Console', icon: HelpCircle, action: onOpenTerminal }
  ];

  return (
    <aside className="donezo-sidebar">
      <div>
        {/* Top Brand Logo */}
        <div className="donezo-brand">
          <img
            src="/logo.png"
            alt="ProtectoAI"
            style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px' }}
          />
          <span className="donezo-brand-text">ProtectoAI</span>
        </div>

        {/* MENU Section */}
        <div className="donezo-nav-section-title">MENU</div>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {menuItems.map((item) => {
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
                className={`donezo-nav-link ${isActive ? 'active' : ''}`}
                style={{ opacity: isRestricted ? 0.45 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{item.label}</span>
                </div>

                {isRestricted ? (
                  <Lock size={12} style={{ color: '#94A3B8' }} />
                ) : item.badge ? (
                  <span
                    className="donezo-nav-badge"
                    style={(item as any).isPendingBadge ? {
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#B45309',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      fontWeight: 700,
                      fontSize: '10px'
                    } : undefined}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* GENERAL Section */}
        <div className="donezo-nav-section-title">GENERAL</div>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          {generalItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const isRestricted = isOperator && item.adminOnly;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (!isRestricted) {
                    onSelectModule(item.id);
                  }
                }}
                disabled={isRestricted}
                className={`donezo-nav-link ${isActive ? 'active' : ''}`}
                style={{ opacity: isRestricted ? 0.45 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{item.label}</span>
                </div>
                {isRestricted && <Lock size={12} style={{ color: '#94A3B8' }} />}
              </button>
            );
          })}

          {onLogout && (
            <button
              onClick={onLogout}
              className="donezo-nav-link"
              style={{ color: '#DC2626', marginTop: '4px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <LogOut size={18} />
                <span>Logout</span>
              </div>
            </button>
          )}
        </nav>
      </div>

      {/* Bottom User Profile */}
      {currentUser && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          backgroundColor: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          marginTop: '16px'
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#0F5132',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px',
            flexShrink: 0
          }}>
            {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'AD'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser.name || currentUser.username}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {currentUser.role}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
