import React from 'react';
import {
  LayoutDashboard,
  Camera,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  ShieldCheck,
  Lock
} from 'lucide-react';
import type { AuthUser } from '../types';

interface SidebarProps {
  activeModule: string;
  onSelectModule: (module: string) => void;
  openIncidentsCount: number;
  currentUser: AuthUser | null;
  onLogout?: () => void;
  onOpenTerminal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  openIncidentsCount,
  currentUser,
  onLogout,
  onOpenTerminal
}) => {
  const isOperator = currentUser?.role === 'Operator';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'console', label: 'Tasks / Camera', icon: Camera, badge: '12+' },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined },
    { id: 'attendance', label: 'Calendar / Shifts', icon: CalendarCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'people', label: 'Team', icon: Users, adminOnly: true }
  ];

  const generalItems = [
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    { id: 'terminal', label: 'Help & Console', icon: HelpCircle, action: onOpenTerminal }
  ];

  return (
    <aside className="donezo-sidebar">
      <div>
        {/* Top Brand Logo (Green Mark + Brand from Image 2) */}
        <div className="donezo-brand">
          <div className="donezo-brand-icon">
            <ShieldCheck size={22} color="#0F5132" strokeWidth={2.4} />
          </div>
          <span className="donezo-brand-text">Donezo</span>
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
                  <span className="donezo-nav-badge">{item.badge}</span>
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

      {/* Bottom Promo Card (Deep Green Box from Image 2) */}
      <div className="donezo-promo-card">
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px'
        }}>
          <ShieldCheck size={18} />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.3 }}>
          Download our<br />Mobile App
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px' }}>
          Get easy in another way
        </div>
        <button
          type="button"
          onClick={() => alert('Mobile safety app download link sent to your registered email.')}
          className="donezo-promo-btn"
        >
          Download
        </button>
      </div>
    </aside>
  );
};
