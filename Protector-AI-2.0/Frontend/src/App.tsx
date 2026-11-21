import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
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
import { OAuthModal } from './components/OAuthModal';

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
import { logoutFirebase } from './services/firebase';

export function App() {
  // Authentication & RBAC States
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [pendingOAuth, setPendingOAuth] = useState<{
    provider: 'google' | 'github';
    credential: string;
    email?: string;
    username?: string;
  } | null>(null);

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

  // Check stored session token or incoming OAuth callback on startup
  useEffect(() => {
    const checkAuthSession = async () => {
      // 1. Check if returning from GitHub OAuth redirect (?code=...)
      const params = new URLSearchParams(window.location.search);
      const ghCode = params.get('code');
      if (ghCode) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        try {
          const res = await api.exchangeGitHubOAuth(ghCode);
          if (res.success && res.user) {
            setCurrentUser(res.user);
            setIsAuthChecking(false);
            return;
          }
        } catch (err: any) {
          if (err.requires_auth_token || (err.message && err.message.toLowerCase().includes('token is required'))) {
            setPendingOAuth({
              provider: 'github',
              credential: ghCode,
              email: err.email || '',
              username: err.username || ''
            });
            setIsAuthChecking(false);
            return;
          }
          console.error('Failed to exchange GitHub authorization code:', err);
        }
      }

      // 2. Check stored session token
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
    }
    try {
      await logoutFirebase();
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

  const pendingOperatorsCount = users.filter(
    (u) => u.status === 'Pending'
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
    return (
      <>
        {authView === 'login' ? (
          <LoginPage
            onLoginSuccess={(user) => setCurrentUser(user)}
            onSwitchToRegister={() => setAuthView('register')}
          />
        ) : (
          <RegisterPage
            onRegisterSuccess={(user) => setCurrentUser(user)}
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}
        {pendingOAuth && (
          <OAuthModal
            isOpen={true}
            provider={pendingOAuth.provider}
            initialStep="token_prompt"
            initialCredential={pendingOAuth.credential}
            initialEmail={pendingOAuth.email}
            initialUsername={pendingOAuth.username}
            onClose={() => setPendingOAuth(null)}
            onSuccess={(user) => {
              setCurrentUser(user);
              setPendingOAuth(null);
            }}
            defaultRole="Operator"
          />
        )}
      </>
    );
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
          pendingOperatorsCount={pendingOperatorsCount}
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

          {/* Module: Biometric Face Training Studio */}
          {activeModule === 'people' && !isOperator && (
            <PeopleManagement onSwitchToAuth={() => setActiveModule('team')} />
          )}

          {/* Module: Team & Operator Authorizations Gatekeeper */}
          {(activeModule === 'team' || activeModule === 'auth') && (
            <TeamAccess
              users={users}
              permissionMatrix={permissionMatrix}
              currentUser={currentUser}
              onRefreshTeam={loadTeam}
              onSwitchToFaceTraining={() => setActiveModule('people')}
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
