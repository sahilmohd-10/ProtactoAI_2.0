import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Plus,
  Download,
  Search,
  Bell,
  Mail,
  Video,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import type { PPEStats, SystemStatus, Incident, AuthUser } from '../types';

interface DonezoDashboardProps {
  stats: PPEStats | null;
  status: SystemStatus | null;
  incidents: Incident[];
  currentUser: AuthUser | null;
  onNavigate: (module: string) => void;
  onOpenTerminal?: () => void;
}

export const DonezoDashboard: React.FC<DonezoDashboardProps> = ({
  stats,
  status,
  incidents,
  currentUser,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(5048); // 01:24:08
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Digital timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSecs: number) => {
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const activeWorkers = stats?.active_workers_monitored ?? 24;
  const complianceRate = stats?.compliance_rate ?? 98;
  const activeCameras = status?.cameras_online || '12';
  const openIncidents = incidents.filter(i => i.status === 'Open').length || 2;

  // Project Analytics pill bar heights matching Image 2
  const analyticsBars = [
    { day: 'S', height: 45, striped: true, active: false },
    { day: 'M', height: 70, striped: false, active: true },
    { day: 'T', height: 55, striped: false, active: false, label: '74%' },
    { day: 'W', height: 85, striped: false, active: true },
    { day: 'T', height: 40, striped: true, active: false },
    { day: 'F', height: 60, striped: true, active: false },
    { day: 'S', height: 50, striped: true, active: false },
  ];

  // Projects / Tasks List matching Image 2
  const projectsList = [
    { title: 'Develop API Endpoints', due: 'Nov 26, 2026', color: '#3B82F6', icon: '//' },
    { title: 'Onboarding Flow', due: 'Nov 28, 2026', color: '#10B981', icon: '✦' },
    { title: 'Build Dashboard', due: 'Nov 30, 2026', color: '#F59E0B', icon: '❖' },
    { title: 'Optimize Page Load', due: 'Dec 4, 2026', color: '#06B6D4', icon: '▲' },
    { title: 'Cross-Browser Testing', due: 'Dec 6, 2026', color: '#8B5CF6', icon: '●' },
  ];

  // Team Collaboration Members matching Image 2
  const teamMembers = [
    { name: 'Alexandra Deff', task: 'Working on Github Project Repository', status: 'Completed', color: '#EBF8F2', textColor: '#0F5132' },
    { name: 'Edwin Adenike', task: 'Working on Integrate User Authentication System', status: 'In Progress', color: '#FEF3C7', textColor: '#92400E' },
    { name: 'Isaac Oluwatemilorun', task: 'Working on Develop Search and Filter Functionality', status: 'Pending', color: '#FEE2E2', textColor: '#DC2626' },
    { name: 'David Oshodi', task: 'Working on Responsive Layout for Homepage', status: 'In Progress', color: '#FEF3C7', textColor: '#92400E' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Top Search & User Bar from Image 2 */}
      <div className="donezo-topbar">
        {/* Search Box with command badge */}
        <div className="donezo-search-box">
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task"
          />
          <span className="donezo-search-badge">⌘F</span>
        </div>

        {/* Right Notification Icons & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Mail size={16} color="#64748B" />
          </button>

          <button
            type="button"
            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Bell size={16} color="#64748B" />
          </button>

          {/* User Profile Pill from Image 2 */}
          <div className="donezo-user-pill">
            <div className="donezo-user-avatar">
              <span>{currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'TM'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                {currentUser?.name || 'Totok Michael'}
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                {currentUser?.email || 'tmichael20@mail.com'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Title & Action Buttons from Image 2 */}
      <div className="donezo-header">
        <div>
          <h1>Dashboard</h1>
          <p>Plan, prioritize, and accomplish your tasks with ease.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => onNavigate('incidents')}
            className="donezo-btn-green"
          >
            <Plus size={16} />
            <span>+ Add Project</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="donezo-btn-outline"
          >
            <span>Import Data</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Image 2 Top Row) */}
      <div className="donezo-kpi-grid">
        {/* Card 1: Featured Deep Forest Green Card */}
        <div className="donezo-card-green">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Total Projects</span>
            <div className="donezo-arrow-circle">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">{activeWorkers}</div>
            <span className="donezo-badge-green">
              <span>5+</span> Increased from last month
            </span>
          </div>
        </div>

        {/* Card 2: Ended Projects */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Ended Projects</span>
            <div className="donezo-arrow-circle">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">10</div>
            <span className="donezo-badge-white">
              <span>6+</span> Increased from last month
            </span>
          </div>
        </div>

        {/* Card 3: Running Projects */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Running Projects</span>
            <div className="donezo-arrow-circle">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">12</div>
            <span className="donezo-badge-white">
              <span>2+</span> Increased from last month
            </span>
          </div>
        </div>

        {/* Card 4: Pending Project */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Pending Project</span>
            <div className="donezo-arrow-circle">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">2</div>
            <span className="donezo-badge-white">
              On Discuss
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row (3 Widgets from Image 2) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 340px) minmax(280px, 320px) 1fr',
        gap: '20px'
      }}>
        {/* Widget 1: Project Analytics (Pill Bars from Image 2) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '230px'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Project Analytics
          </h2>

          {/* Vertical Pill Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0 6px' }}>
            {analyticsBars.map((bar, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {bar.label && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#0F5132', backgroundColor: '#EBF8F2', padding: '2px 5px', borderRadius: '6px' }}>
                    {bar.label}
                  </span>
                )}
                <div style={{
                  width: '26px',
                  height: `${bar.height}%`,
                  borderRadius: '100px',
                  backgroundColor: bar.striped ? 'transparent' : (bar.active ? '#0F5132' : '#34D399'),
                  backgroundImage: bar.striped ? 'repeating-linear-gradient(45deg, #E2E8F0, #E2E8F0 3px, #F8FAFC 3px, #F8FAFC 6px)' : 'none',
                  border: bar.striped ? '1.5px solid #E2E8F0' : 'none'
                }} />
                <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Reminders (Image 2 Center Card) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '230px'
        }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>Reminders</span>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px 0', lineHeight: 1.3 }}>
              Meeting with Arc<br />Company
            </h2>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Time: 02.00 pm - 04.00 pm
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('console')}
            className="donezo-btn-green"
            style={{ width: '100%', justifyContent: 'center', borderRadius: '14px', padding: '12px 0' }}
          >
            <Video size={16} />
            <span>Start Meeting</span>
          </button>
        </div>

        {/* Widget 3: Project List (Image 2 Right Card) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '230px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Project
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('incidents')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '100px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                fontSize: '11px',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer'
              }}
            >
              + New
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {projectsList.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                    {p.icon}
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B' }}>{p.title}</span>
                </div>
                <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>Due date: {p.due}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row (3 Widgets from Image 2) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 420px) minmax(260px, 320px) 1fr',
        gap: '20px'
      }}>
        {/* Widget 1: Team Collaboration (Image 2 Bottom Left) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Team Collaboration
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('people')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '100px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                fontSize: '11px',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer'
              }}
            >
              + Add Member
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {teamMembers.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: '#E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    flexShrink: 0
                  }}>
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{m.name}</span>
                    <span style={{ fontSize: '10.5px', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.task}</span>
                  </div>
                </div>

                <span style={{
                  padding: '3px 10px',
                  borderRadius: '100px',
                  backgroundColor: m.color,
                  color: m.textColor,
                  fontSize: '10.5px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Project Progress (Green Semi-Circular Gauge from Image 2) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ width: '100%', textAlign: 'left' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Project Progress
            </h2>
          </div>

          {/* Arc Gauge */}
          <div style={{ position: 'relative', width: '200px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0' }}>
            <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M 20 110 A 80 80 0 0 1 180 110"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray="4 6"
              />
              <path
                d="M 20 110 A 80 80 0 0 1 180 110"
                fill="none"
                stroke="#0F5132"
                strokeWidth="20"
                strokeDasharray="251"
                strokeDashoffset="120"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', bottom: '10px', textAlign: 'center' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                41%
              </span>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Project Ended</div>
            </div>
          </div>

          {/* Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0F5132' }} />
              <span>Completed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34D399' }} />
              <span>In Progress</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
              <span>Pending</span>
            </div>
          </div>
        </div>

        {/* Widget 3: Time Tracker (Dark Forest Green Card from Image 2) */}
        <div style={{
          backgroundColor: '#0F5132',
          backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(52, 211, 153, 0.2) 0%, transparent 70%)',
          borderRadius: '24px',
          padding: '24px',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)' }}>
            Time Tracker
          </span>

          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <span style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '2px', fontFamily: 'monospace' }}>
              {formatTimer(timerSeconds)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                color: '#0F5132',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              {isTimerRunning ? <Pause size={18} fill="#0F5132" /> : <Play size={18} fill="#0F5132" />}
            </button>

            <button
              type="button"
              onClick={() => setTimerSeconds(0)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              <Square size={16} fill="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
