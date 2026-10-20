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
import { CommandTerminal } from './components/CommandTerminal';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';

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
  const [activeModule, setActiveModule] = useState<string>('console');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
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
      <div className="min-h-screen w-full flex items-center justify-center bg-[#090B0F] text-[#F4F5F2] font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#D7FF64] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs tracking-widest text-[#969FA9] uppercase">
            Verifying Security Session...
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

  // 3. Authenticated Industrial Safety Operations Platform
  const isOperator = currentUser.role === 'Operator';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Sleek Fixed Sidebar */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        openIncidentsCount={openIncidentsCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Layout Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Floating Glass Header */}
        <Header
          systemStatus={systemStatus}
          activeModule={activeModule}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenTerminal={() => setIsTerminalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Content Viewport */}
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
          {/* Welcome Showcase Banner - Optical Console View Only */}
          {activeModule === 'console' && (
            <WelcomeHero
              stats={ppeStats}
              status={systemStatus}
              onNavigate={handleSelectModule}
              onOpenTerminal={() => setIsTerminalOpen(true)}
            />
          )}

          {/* Module Switcher */}
          {activeModule === 'console' && (
            <LiveConsole
              cameras={cameras}
              onRefreshIncidents={loadIncidents}
            />
          )}

          {activeModule === 'incidents' && (
            <IncidentManagement
              incidents={incidents}
              onRefresh={loadIncidents}
            />
          )}

          {activeModule === 'analytics' && (
            <Analytics
              analytics={analytics}
              stats={ppeStats}
            />
          )}

          {activeModule === 'people' && !isOperator && (
            <PeopleManagement />
          )}

          {activeModule === 'team' && (
            <TeamAccess
              users={users}
              permissionMatrix={permissionMatrix}
              currentUser={currentUser}
              onRefreshTeam={loadTeam}
            />
          )}

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
