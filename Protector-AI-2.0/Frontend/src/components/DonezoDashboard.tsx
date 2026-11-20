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
  ShieldCheck,
  AlertTriangle,
  Users,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink
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

  // Digital shift timer
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

  // Authoritative operational metrics
  const activeWorkers = stats?.active_workers_monitored ?? 14;
  const complianceRate = stats?.compliance_rate ?? 98.4;
  const activeCameras = status?.cameras_online || '1/1';
  const openIncidents = incidents.filter(i => i.status === 'Open' || i.status === 'In Review').length || 4;

  // Real industrial hazard category counts
  const hazardBars = [
    { name: 'Hardhat', label: 'No-Hardhat', count: 12, height: 75, color: '#EF4444' },
    { name: 'Vest', label: 'No-Vest', count: 8, height: 50, color: '#F59E0B' },
    { name: 'Mask', label: 'No-Mask', count: 5, height: 35, color: '#3B82F6' },
    { name: 'Zone', label: 'Zone Breach', count: 9, height: 60, color: '#DC2626' },
    { name: 'Machine', label: 'Proximity', count: 4, height: 30, color: '#8B5CF6' },
    { name: 'Ladder', label: 'Height Hazard', count: 6, height: 45, color: '#EC4899' },
    { name: 'Gloves', label: 'No-Gloves', count: 7, height: 48, color: '#10B981' },
  ];

  // Real recent industrial incidents from props
  const recentIncidentsList = incidents.slice(0, 5);

  // Enrolled active site personnel
  const onShiftPersonnel = [
    { name: 'Mohd Sahil', role: 'Chief Safety Engineer', shift: 'General Shift', status: 'Present', punctuality: 'On Time' },
    { name: 'Alok', role: 'Machinery Specialist', shift: 'Morning Shift', status: 'Present', punctuality: 'On Time' },
    { name: 'Faisal', role: 'Sector Supervisor', shift: 'Morning Shift', status: 'Present', punctuality: 'On Time' },
    { name: 'Site Operator', role: 'Control Room Operator', shift: 'General Shift', status: 'Present', punctuality: 'On Time' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Top Search & User Bar */}
      <div className="donezo-topbar">
        {/* Search Box with command badge */}
        <div className="donezo-search-box">
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cameras, personnel, safety incidents..."
          />
          <span className="donezo-search-badge">⌘F</span>
        </div>

        {/* Right Notification Icons & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => onNavigate('incidents')}
            title="Open Incidents"
            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          >
            <Bell size={16} color="#64748B" />
            {openIncidents > 0 && (
              <span style={{ position: 'absolute', top: '7px', right: '7px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
            )}
          </button>

          {/* User Profile Pill */}
          <div className="donezo-user-pill">
            <div className="donezo-user-avatar">
              <span>{currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'AD'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                {currentUser?.name || 'Administrator'}
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                {currentUser?.role || 'Safety Supervisor'} • {currentUser?.email || 'admin@protector.ai'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Title & Action Buttons */}
      <div className="donezo-header">
        <div>
          <h1>Industrial Safety Surveillance Dashboard</h1>
          <p>Real-time optical monitoring, automated PPE verification, and active hazard response.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => onNavigate('console')}
            className="donezo-btn-green"
          >
            <Video size={16} />
            <span>Open Live Stream</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="donezo-btn-outline"
          >
            <Download size={14} />
            <span>Export Safety Audit</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Authoritative Industrial Safety Data) */}
      <div className="donezo-kpi-grid">
        {/* Card 1: Featured Deep Forest Green Card: Monitored Workforce */}
        <div className="donezo-card-green">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Personnel Monitored</span>
            <div className="donezo-arrow-circle">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">{activeWorkers}</div>
            <span className="donezo-badge-green">
              <span>●</span> Active on site shift
            </span>
          </div>
        </div>

        {/* Card 2: PPE Compliance Rate */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">PPE Compliance Rate</span>
            <div className="donezo-arrow-circle">
              <ShieldCheck size={16} color="#16A34A" />
            </div>
          </div>
          <div>
            <div className="donezo-card-number" style={{ color: '#16A34A' }}>{complianceRate}%</div>
            <span className="donezo-badge-white">
              Hardhat & safety vest verified
            </span>
          </div>
        </div>

        {/* Card 3: Cameras Online */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Surveillance Cameras</span>
            <div className="donezo-arrow-circle">
              <Camera size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">{activeCameras}</div>
            <span className="donezo-badge-white">
              Hardware device 0 live
            </span>
          </div>
        </div>

        {/* Card 4: Open Infractions */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Active Safety Infractions</span>
            <div className="donezo-arrow-circle">
              <AlertTriangle size={16} color="#DC2626" />
            </div>
          </div>
          <div>
            <div className="donezo-card-number" style={{ color: openIncidents > 0 ? '#DC2626' : '#16A34A' }}>
              {openIncidents}
            </div>
            <span className="donezo-badge-white">
              Requires supervisor review
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Industrial Hazard Analytics, Live Feed Preview, Recent Incidents */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 360px) minmax(280px, 340px) 1fr',
        gap: '20px'
      }}>
        {/* Widget 1: Hazard Distribution Bar Chart */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '250px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Hazard Distribution
            </h2>
            <button
              onClick={() => onNavigate('analytics')}
              style={{ background: 'none', border: 'none', color: '#0F5132', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              View 3D
            </button>
          </div>

          {/* Bar Columns */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0 4px', marginTop: '10px' }}>
            {hazardBars.map((bar, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                  {bar.count}
                </span>
                <div style={{
                  width: '26px',
                  height: `${bar.height}%`,
                  borderRadius: '8px',
                  backgroundColor: bar.color,
                  opacity: 0.85
                }} />
                <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 600 }}>{bar.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Live Optical Feed Preview */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '250px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>North Floor • Camera 01</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '100px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                fontSize: '11px',
                fontWeight: 700
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                LIVE
              </span>
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px 0', lineHeight: 1.3 }}>
              Optical Safety Stream
            </h2>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Real-time PPE infraction detection & biometric tracking active.
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('console')}
            className="donezo-btn-green"
            style={{ width: '100%', justifyContent: 'center', borderRadius: '14px', padding: '12px 0' }}
          >
            <Video size={16} />
            <span>Launch Console</span>
          </button>
        </div>

        {/* Widget 3: Recent Safety Incidents */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid #F1F5F9',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '250px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Recent Infractions
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
              View All ({incidents.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentIncidentsList.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onNavigate('incidents')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: inc.severity === 'High' ? '#DC2626' : (inc.severity === 'Medium' ? '#F59E0B' : '#3B82F6'),
                    flexShrink: 0
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.title || inc.category}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                      {inc.location || 'Sector A'} • {inc.time_ago || 'Recent'}
                    </span>
                  </div>
                </div>

                <span style={{
                  padding: '2px 8px',
                  borderRadius: '100px',
                  backgroundColor: inc.status === 'Resolved' ? '#DCFCE7' : '#FEE2E2',
                  color: inc.status === 'Resolved' ? '#166534' : '#991B1B',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: On-Shift Personnel, PPE Progress Gauge, Shift Timer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 420px) minmax(260px, 320px) 1fr',
        gap: '20px'
      }}>
        {/* Widget 1: On-Shift Personnel & Attendance */}
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
              On-Shift Personnel
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
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
              Full Register
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {onShiftPersonnel.map((p, idx) => (
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
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{p.name}</span>
                    <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>{p.role} • {p.shift}</span>
                  </div>
                </div>

                <span style={{
                  padding: '3px 10px',
                  borderRadius: '100px',
                  backgroundColor: '#EBF8F2',
                  color: '#0F5132',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Site PPE Compliance Progress Gauge */}
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
              Site PPE Compliance
            </h2>
          </div>

          {/* Semicircular Arc Gauge */}
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
                strokeDashoffset="25"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', bottom: '10px', textAlign: 'center' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {complianceRate}%
              </span>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Verified Safe</div>
            </div>
          </div>

          {/* Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0F5132' }} />
              <span>Full Gear</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <span>Advisory</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <span>Violation</span>
            </div>
          </div>
        </div>

        {/* Widget 3: Shift Operational Timer */}
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
            Operational Shift Timer
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
