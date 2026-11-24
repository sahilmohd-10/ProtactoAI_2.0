import React, { useState } from 'react';
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
  CalendarCheck,
  Menu,
  X
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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
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

  const handleMobileNavClick = (moduleId: string, action?: () => void) => {
    setIsMobileDrawerOpen(false);
    if (action) {
      action();
    } else {
      onSelectModule(moduleId);
    }
  };

  const currentModuleName = menuItems.find(m => m.id === activeModule)?.label ||
    generalItems.find(g => g.id === activeModule)?.label ||
    'Dashboard';

  return (
    <>
      {/* =========================================================
          1. MOBILE TOP HEADER (Phone Viewports <= 768px)
          ========================================================= */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/logo.png"
            alt="ProtectoAI"
            style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '8px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              ProtectoAI
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#0F5132' }}>
              {currentModuleName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {openIncidentsCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectModule('incidents')}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626',
                cursor: 'pointer',
                position: 'relative'
              }}
              title="Open Incidents"
            >
              <AlertTriangle size={16} />
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderRadius: '100px',
                fontSize: '9px',
                fontWeight: 800,
                padding: '1px 4px'
              }}>
                {openIncidentsCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0F172A',
              cursor: 'pointer'
            }}
            title="Open Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* =========================================================
          2. MOBILE SLIDE-OUT DRAWER (Phone Viewports <= 768px)
          ========================================================= */}
      {isMobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <div
            className="mobile-drawer-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/logo.png"
                  alt="ProtectoAI"
                  style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px' }}
                />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>ProtectoAI</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Industrial Safety 2.0</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current User Card */}
            {currentUser && (
              <div style={{
                margin: '14px 16px',
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#0F5132',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px'
                }}>
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'AD'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser.name || currentUser.username}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    {currentUser.role} • {currentUser.email || 'active'}
                  </span>
                </div>
              </div>
            )}

            {/* Drawer Navigation Links */}
            <div style={{ padding: '0 12px 16px 12px', overflowY: 'auto', flex: 1 }}>
              <div className="donezo-nav-section-title" style={{ marginTop: '8px' }}>MENU</div>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                const isRestricted = isOperator && item.adminOnly;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!isRestricted) handleMobileNavClick(item.id);
                    }}
                    disabled={isRestricted}
                    className={`donezo-nav-link ${isActive ? 'active' : ''}`}
                    style={{ opacity: isRestricted ? 0.45 : 1, padding: '13px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                      <span style={{ fontSize: '14px' }}>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="donezo-nav-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}

              <div className="donezo-nav-section-title">GENERAL</div>
              {generalItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                const isRestricted = isOperator && item.adminOnly;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action) {
                        handleMobileNavClick(item.id, item.action);
                      } else if (!isRestricted) {
                        handleMobileNavClick(item.id);
                      }
                    }}
                    disabled={isRestricted}
                    className={`donezo-nav-link ${isActive ? 'active' : ''}`}
                    style={{ opacity: isRestricted ? 0.45 : 1, padding: '13px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                      <span style={{ fontSize: '14px' }}>{item.label}</span>
                    </div>
                  </button>
                );
              })}

              {onLogout && (
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onLogout();
                  }}
                  className="donezo-nav-link"
                  style={{ color: '#DC2626', marginTop: '12px', padding: '13px 14px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <LogOut size={19} />
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>Logout</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          3. MOBILE BOTTOM NAVIGATION (Phone Viewports <= 768px)
          ========================================================= */}
      <nav className="mobile-bottom-nav">
        {/* Tab 1: Dashboard */}
        <button
          type="button"
          onClick={() => onSelectModule('dashboard')}
          className={`mobile-tab-btn ${activeModule === 'dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} strokeWidth={activeModule === 'dashboard' ? 2.5 : 1.8} />
          <span>Home</span>
        </button>

        {/* Tab 2: Live Camera / Tasks */}
        <button
          type="button"
          onClick={() => onSelectModule('console')}
          className={`mobile-tab-btn ${activeModule === 'console' ? 'active' : ''}`}
        >
          <Camera size={20} strokeWidth={activeModule === 'console' ? 2.5 : 1.8} />
          <span>Camera</span>
        </button>

        {/* Tab 3: Incidents (with badge) */}
        <button
          type="button"
          onClick={() => onSelectModule('incidents')}
          className={`mobile-tab-btn ${activeModule === 'incidents' ? 'active' : ''}`}
          style={{ position: 'relative' }}
        >
          <AlertTriangle size={20} strokeWidth={activeModule === 'incidents' ? 2.5 : 1.8} />
          {openIncidentsCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '20px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#DC2626'
            }} />
          )}
          <span>Incidents</span>
        </button>

        {/* Tab 4: Attendance & Excel */}
        <button
          type="button"
          onClick={() => onSelectModule('attendance')}
          className={`mobile-tab-btn ${activeModule === 'attendance' ? 'active' : ''}`}
        >
          <CalendarCheck size={20} strokeWidth={activeModule === 'attendance' ? 2.5 : 1.8} />
          <span>Attendance</span>
        </button>

        {/* Tab 5: More Menu */}
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`mobile-tab-btn ${isMobileDrawerOpen ? 'active' : ''}`}
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>

      {/* =========================================================
          4. DESKTOP SIDEBAR (Desktop / Laptop Viewports > 768px)
          ========================================================= */}
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
    </>
  );
};
