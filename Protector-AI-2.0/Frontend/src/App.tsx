import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WelcomeHero } from './components/WelcomeHero';
import { LiveConsole } from './components/LiveConsole';
import { IncidentManagement } from './components/IncidentManagement';
import { Analytics } from './components/Analytics';
import { TeamAccess } from './components/TeamAccess';
import { SystemHealth } from './components/SystemHealth';
import { PeopleManagement } from './components/PeopleManagement';
import { AttendanceManagement } from './components/AttendanceManagement';
import { CommandTerminal } from './components/CommandTerminal';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { DonezoDashboard } from './components/DonezoDashboard';

import {
  SystemStatus,
  PPEStats,
  Incident,
  Camera,
  User,
  AuthUser,
  AnalyticsData
} from './types';
import { api, authStorage } from './services/api';

export function App() {
  // Authentication & RBAC States
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Application Layout States
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);

  // Application Telemetry States
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [ppeStats, setPpeStats] = useState<PPEStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, string[]>>({});
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);

  // Apply theme attribute to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Check stored session token on startup
  useEffect(() => {
    const checkAuthSession = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setIsAuthChecking(false);
        return;
      }

      try {
        const res = await api.getMe();
        if (res.success && res.user) {
          setCurrentUser(res.user);
        } else {
          authStorage.clearToken();
        }
      } catch {
        authStorage.clearToken();
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuthSession();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      authStorage.clearToken();
      setCurrentUser(null);
      setAuthView('login');
      setActiveModule('console');
    }
  };

  const loadSystemStatus = useCallback(async () => {
    try {
      const data = await api.getSystemStatus();
      setSystemStatus(data);
    } catch (err) {
      console.error('Failed to load system status:', err);
    }
  }, []);

  const loadPPEStats = useCallback(async () => {
    try {
      const data = await api.getPPEStats();
      setPpeStats(data);
    } catch (err) {
      console.error('Failed to load PPE stats:', err);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await api.getIncidents();
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  }, []);

  const loadCameras = useCallback(async () => {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (err) {
      console.error('Failed to load cameras:', err);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    try {
      const data = await api.getTeam();
      setUsers(data.users || []);
      setPermissionMatrix(data.permission_matrix || {});
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getAnalytics(7);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  // Fetch telemetry only when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    const fetchAll = async () => {
      setIsInitialLoading(true);
      await Promise.allSettled([
        loadSystemStatus(),
        loadPPEStats(),
        loadIncidents(),
        loadCameras(),
        loadTeam(),
        loadAnalytics()
      ]);
      setIsInitialLoading(false);
    };

    fetchAll();

    const interval = setInterval(() => {
      loadSystemStatus();
      loadPPEStats();
    }, 15000);

    return () => clearInterval(interval);
  }, [currentUser, loadSystemStatus, loadPPEStats, loadIncidents, loadCameras, loadTeam, loadAnalytics]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!currentUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  const openIncidentsCount = incidents.filter(
    (i) => i.status === 'Open' || i.status === 'In Review'
  ).length;

  const handleSelectModule = (mod: string) => {
    if (isOperator && (mod === 'people' || mod === 'team' || mod === 'settings')) return;

    if (mod === 'terminal') {
      setIsTerminalOpen(true);
    } else {
      setActiveModule(mod);
    }
  };

  // 1. Initial Session Verification Screen
  if (isAuthChecking) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent-citron)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated View (Login / Register)
  if (!currentUser) {
    if (authView === 'login') {
      return (
        <LoginPage
          onLoginSuccess={(user) => setCurrentUser(user)}
          onSwitchToRegister={() => setAuthView('register')}
        />
      );
    } else {
      return (
        <RegisterPage
          onRegisterSuccess={(user) => setCurrentUser(user)}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
  }

  // 3. Authenticated Donezo Enterprise Operations Platform (Image 2 Match)
  const isOperator = currentUser.role === 'Operator';

  return (
    <div className="donezo-page-wrapper">
      <div className="donezo-container">
        {/* Sleek Donezo Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={handleSelectModule}
          openIncidentsCount={openIncidentsCount}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenTerminal={() => setIsTerminalOpen(true)}
        />

        {/* Donezo Main Dashboard Viewport */}
        <main className="donezo-main">
          {/* Main Dashboard Overview (Image 2 Donezo Match) */}
          {activeModule === 'dashboard' && (
            <DonezoDashboard
              stats={ppeStats}
              status={systemStatus}
              incidents={incidents}
              currentUser={currentUser}
              onNavigate={handleSelectModule}
              onOpenTerminal={() => setIsTerminalOpen(true)}
            />
          )}

          {/* Module: Optical Surveillance Console */}
          {activeModule === 'console' && (
            <LiveConsole
              cameras={cameras}
              onRefreshIncidents={loadIncidents}
            />
          )}

          {/* Module: Incident Management */}
          {activeModule === 'incidents' && (
            <IncidentManagement
              incidents={incidents}
              onRefresh={loadIncidents}
            />
          )}

          {/* Module: Analytics */}
          {activeModule === 'analytics' && (
            <Analytics
              analytics={analytics}
              stats={ppeStats}
            />
          )}

          {/* Module: Biometric Attendance Register */}
          {activeModule === 'attendance' && (
            <AttendanceManagement />
          )}

          {/* Module: People Management */}
          {activeModule === 'people' && !isOperator && (
            <PeopleManagement />
          )}

          {/* Module: Team & Access RBAC */}
          {activeModule === 'team' && (
            <TeamAccess
              users={users}
              permissionMatrix={permissionMatrix}
              currentUser={currentUser}
              onRefreshTeam={loadTeam}
            />
          )}

          {/* Module: System Health & Maintenance */}
          {activeModule === 'settings' && (
            <SystemHealth
              status={systemStatus}
              onRefresh={() => {
                loadSystemStatus();
                loadCameras();
              }}
            />
          )}
        </main>
      </div>

      {/* Signature Feature: Intelligent Command Terminal */}
      <CommandTerminal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        isAdministrator={currentUser.role === 'Administrator'}
        onNavigate={(mod) => {
          handleSelectModule(mod);
          setIsTerminalOpen(false);
        }}
        onThemeSwitch={(t) => setTheme(t)}
      />
    </div>
  );
}

export default App;
