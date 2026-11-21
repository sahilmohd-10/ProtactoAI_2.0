import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ShieldCheck,
  Camera,
  Check,
  Filter,
  TrendingUp,
  Activity,
  Flame,
  FileText,
  Building,
  CheckSquare,
  Clock3
} from 'lucide-react';
import type { AttendanceRecord, AttendanceSummary, FaceProfile, WeeklyAttendanceTrend } from '../types';
import { api } from '../services/api';

export const AttendanceManagement: React.FC = () => {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [enrolledPeople, setEnrolledPeople] = useState<FaceProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'analytics' | 'history' | 'directory'>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingExcel, setIsSyncingExcel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Manual Check-In Modal State
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualStatus, setManualStatus] = useState('Present');
  const [manualNotes, setManualNotes] = useState('Manual Dashboard Entry');
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  const loadAttendanceData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const [sum, recsRes, people] = await Promise.all([
        api.getAttendanceSummary(),
        api.getAttendance({
          date: activeTab === 'today' ? undefined : (selectedDate || undefined),
          name: searchQuery || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }),
        api.getPeople().catch(() => [])
      ]);
      setSummary(sum);
      setRecords(recsRes.records);
      setEnrolledPeople(people);
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
      if (!quiet) showNotification('error', err.message || 'Failed to load attendance data');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [activeTab, selectedDate, searchQuery, statusFilter]);

  // Initial load
  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Real-time surveillance polling every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadAttendanceData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadAttendanceData]);

  // Force Excel sync handler
  const handleSyncExcel = async () => {
    setIsSyncingExcel(true);
    try {
      const res = await api.syncAttendanceExcel();
      if (res.success) {
        showNotification('success', `Excel workbook synced successfully to ${res.excel_path}`);
        loadAttendanceData(true);
      } else {
        showNotification('error', res.message || 'Excel sync failed');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to sync Excel sheet');
    } finally {
      setIsSyncingExcel(false);
    }
  };

  // Launch local Excel handler
  const handleOpenExcel = async () => {
    try {
      const res = await api.openAttendanceExcel();
      if (res.success) {
        showNotification('success', res.message || 'Launched Microsoft Excel with latest workbook.');
      } else {
        showNotification('error', res.error || 'Failed to open Excel.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Could not launch Microsoft Excel.');
    }
  };

  // Submit manual check-in
  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      showNotification('error', 'Please enter or select a personnel name');
      return;
    }
    setIsSubmittingCheckIn(true);
    try {
      const res = await api.markAttendance({
        person_name: manualName.trim(),
        status: manualStatus,
        notes: manualNotes,
        date: selectedDate || undefined
      });
      if (res.success) {
        showNotification('success', `Attendance marked for ${res.record.person_name} (${res.record.status})`);
        setIsCheckInModalOpen(false);
        setManualName('');
        setManualNotes('Manual Dashboard Entry');
        loadAttendanceData(false);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to mark attendance');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const todayStr = summary?.date || new Date().toISOString().split('T')[0];

  // Combined list for "Today's" view: all enrolled people with their check-in status
  const checkedInMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    if (r.date === todayStr) {
      checkedInMap.set(r.person_name.toLowerCase(), r);
    }
  });

  const filteredEnrolledToday = enrolledPeople.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    const rec = checkedInMap.get(p.name.toLowerCase());
    if (statusFilter === 'all') {
      if (shiftFilter !== 'all' && rec && !rec.shift?.toLowerCase().includes(shiftFilter.toLowerCase())) {
        return false;
      }
      return true;
    }
    if (statusFilter === 'active') return !!rec?.active_now;
    if (statusFilter === 'on_time') return rec?.punctuality === 'On Time';
    if (statusFilter === 'late') return rec?.punctuality === 'Late Arrival';
    if (statusFilter === 'overtime') return (rec?.overtime_hours ?? 0) > 0;
    if (statusFilter === 'present') return !!rec;
    if (statusFilter === 'absent') return !rec;
    return rec?.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: notification.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          color: notification.type === 'success' ? '#4ADE80' : '#F87171'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header and Title */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Advanced Biometric Workforce Register
            </h1>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#4ADE80',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ADE80', display: 'inline-block' }} />
              Live AI Surveillance Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Autonomous facial feature identification, industrial shift tracking, punctuality analytics, and live Excel synchronization.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsCheckInModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>Manual Override</span>
          </button>

          <button
            onClick={handleSyncExcel}
            disabled={isSyncingExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isSyncingExcel ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: isSyncingExcel ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncingExcel ? 'Syncing...' : 'Force Excel Sync'}</span>
          </button>

          <a
            href={api.getAttendanceExportUrl()}
            download="Attendance.xlsx"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#4ADE80',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Download size={14} />
            <span>Download .XLSX</span>
          </a>

          <button
            onClick={handleOpenExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#0F5132',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={14} />
            <span>Open Live in Excel</span>
          </button>

          <a
            href={api.getAttendanceCsvExportUrl()}
            download={`attendance_${todayStr}.csv`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#60A5FA',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <FileText size={14} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Live Biometric Telemetry Live Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid #22C55E'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ADE80'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Deep Learning Biometric Engine (YuNet CNN + SFace 128D)</span>
              <span style={{ fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>● Live Camera Stream Scanning</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Facial landmarks aligned via 5-point geometry. Enrolled personnel matching with ≥80.0% feature accuracy are logged Present automatically and exported to Excel.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            color: '#4ADE80',
            fontWeight: 700
          }}>
            Target: D:\Downloads\Attendance.xlsx
          </span>
          <button
            onClick={handleSyncExcel}
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            Re-verify File
          </button>
        </div>
      </div>

      {/* 6 Executive KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        {/* Card 1: Total Enrolled */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Workforce
            </span>
            <Users size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.total_enrolled ?? enrolledPeople.length}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Personnel</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#4ADE80', fontWeight: 600 }}>
            100% Biometric Enrolled
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Present Today
            </span>
            <UserCheck size={16} style={{ color: '#4ADE80' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.present_today ?? checkedInMap.size}
            </span>
            <span style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#4ADE80',
              fontWeight: 700
            }}>
              {summary?.attendance_rate ?? 0}% Rate
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {summary?.absent_today ?? 0} Awaiting check-in
          </div>
        </div>

        {/* Card 3: Active On-Site Now */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Active On-Site
            </span>
            <Activity size={16} style={{ color: '#38BDF8' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.active_on_site_now ?? summary?.present_today ?? 0}
            </span>
            <span style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              fontWeight: 700
            }}>
              Live Pulse
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Seen on camera in last 45m
          </div>
        </div>

        {/* Card 4: Punctuality Score */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Punctuality Index
            </span>
            <Clock3 size={16} style={{ color: '#FBBF24' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.punctuality_rate ?? 100}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {summary?.on_time_count ?? 0} On-Time
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: (summary?.late_count ?? 0) > 0 ? '#FBBF24' : 'var(--text-secondary)' }}>
            {summary?.late_count ?? 0} Late arrivals logged
          </div>
        </div>

        {/* Card 5: Overtime Accumulated */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Overtime
            </span>
            <TrendingUp size={16} style={{ color: '#A78BFA' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {summary?.total_overtime_hours ?? 0}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hours</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Avg {summary?.average_hours ?? 0} hrs/worker
          </div>
        </div>

        {/* Card 6: Excel Synchronization */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--accent-citron)', fontWeight: 700, textTransform: 'uppercase' }}>
              Excel Registry
            </span>
            <FileSpreadsheet size={16} style={{ color: 'var(--accent-citron)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Auto-Synchronized
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary?.last_excel_sync ? `Synced: ${new Date(summary.last_excel_sync).toLocaleTimeString()}` : 'Real-time pipeline'}
          </div>
        </div>
      </div>

      {/* Tabs and Analytics Section */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('today')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'today' ? 'var(--accent-citron)' : 'transparent',
                backgroundColor: activeTab === 'today' ? 'rgba(230, 255, 0, 0.08)' : 'transparent',
                color: activeTab === 'today' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: activeTab === 'today' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Today's Live Register ({checkedInMap.size}/{enrolledPeople.length})
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'analytics' ? 'var(--accent-citron)' : 'transparent',
                backgroundColor: activeTab === 'analytics' ? 'rgba(230, 255, 0, 0.08)' : 'transparent',
                color: activeTab === 'analytics' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: activeTab === 'analytics' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Shift & Punctuality Analytics
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'history' ? 'var(--accent-citron)' : 'transparent',
                backgroundColor: activeTab === 'history' ? 'rgba(230, 255, 0, 0.08)' : 'transparent',
                color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: activeTab === 'history' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Historical Register ({records.length})
            </button>

            <button
              onClick={() => setActiveTab('directory')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'directory' ? 'var(--accent-citron)' : 'transparent',
                backgroundColor: activeTab === 'directory' ? 'rgba(230, 255, 0, 0.08)' : 'transparent',
                color: activeTab === 'directory' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: activeTab === 'directory' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Personnel Directory ({enrolledPeople.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span>Continuous background scanning active</span>
          </div>
        </div>

        {/* Tab 2: Shift & Punctuality Analytics Dashboard */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 7-Day Trend Chart */}
            <div style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    7-Day Attendance & Punctuality Trend
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Daily workforce turnout and arrival punctuality overview.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4ADE80' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#22C55E' }} />
                    On-Time
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#FBBF24' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#F59E0B' }} />
                    Late
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-tertiary)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--bg-surface-elevated)' }} />
                    Absent
                  </span>
                </div>
              </div>

              {/* Visual Bars for Weekly Trend */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '140px', paddingTop: '10px' }}>
                {summary?.weekly_trend?.map((item: WeeklyAttendanceTrend, idx: number) => {
                  const total = Math.max(1, summary?.total_enrolled || 1);
                  const onTimeH = (item.on_time / total) * 100;
                  const lateH = (item.late / total) * 100;
                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.present}
                      </div>
                      <div style={{
                        width: '100%',
                        maxWidth: '42px',
                        height: '90px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        overflow: 'hidden'
                      }}>
                        <div style={{ height: `${onTimeH}%`, backgroundColor: '#22C55E', transition: 'height 0.3s' }} />
                        <div style={{ height: `${lateH}%`, backgroundColor: '#F59E0B', transition: 'height 0.3s' }} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {item.day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Industrial Shift Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Shift Distribution (Today)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(summary?.shift_distribution || { 'General Shift': summary?.present_today || 0 }).map(([sh, count]) => (
                    <div key={sh} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{sh}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count} workers</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Punctuality & Overtime Highlights
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Standard Shift Duration:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>8.0 Hours</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Punctuality Grace Period:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>15 Minutes</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Workers with Overtime:</span>
                    <span style={{ fontWeight: 700, color: '#A78BFA' }}>{summary?.overtime_count || 0} Personnel</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Today's Live Attendance View */}
        {activeTab === 'today' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                padding: '6px 12px',
                flex: '1 1 200px',
                maxWidth: '300px'
              }}>
                <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search personnel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    width: '100%'
                  }}
                />
              </div>

              {/* Status Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Personnel' },
                  { id: 'active', label: '🟢 Active Now' },
                  { id: 'on_time', label: '✓ On-Time' },
                  { id: 'late', label: '⚠️ Late' },
                  { id: 'overtime', label: '⏱️ Overtime' },
                  { id: 'absent', label: '❌ Absent' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: statusFilter === f.id ? 'var(--accent-citron)' : 'var(--border-subtle)',
                      backgroundColor: statusFilter === f.id ? 'rgba(230, 255, 0, 0.1)' : 'var(--bg-app)',
                      color: statusFilter === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: statusFilter === f.id ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendance Table */}
            <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '10px 14px' }}>Worker / Identity</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Assigned Shift</th>
                    <th style={{ padding: '10px 14px' }}>Punctuality</th>
                    <th style={{ padding: '10px 14px' }}>First In</th>
                    <th style={{ padding: '10px 14px' }}>Last Seen</th>
                    <th style={{ padding: '10px 14px' }}>Duration</th>
                    <th style={{ padding: '10px 14px' }}>Overtime</th>
                    <th style={{ padding: '10px 14px' }}>Detection Zone / Camera</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrolledToday.map((person) => {
                    const rec = checkedInMap.get(person.name.toLowerCase());
                    const isPresent = !!rec;

                    return (
                      <tr
                        key={person.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: 'transparent'
                        }}
                      >
                        {/* Worker Identity */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isPresent ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-surface-elevated)',
                              color: isPresent ? '#4ADE80' : 'var(--text-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700,
                              border: `1px solid ${isPresent ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-subtle)'}`
                            }}>
                              {person.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {person.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                EMP-{person.id.toString().padStart(3, '0')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '12px 14px' }}>
                          {isPresent ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: rec.status === 'Full Day' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.12)',
                              color: '#4ADE80',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              <Check size={11} /> {rec.status}
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#F87171',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              Not Checked In
                            </span>
                          )}
                        </td>

                        {/* Assigned Shift */}
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                          {rec?.shift?.split(' (')[0] || 'General Shift'}
                        </td>

                        {/* Punctuality */}
                        <td style={{ padding: '12px 14px' }}>
                          {isPresent ? (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: rec.punctuality === 'On Time' ? '#4ADE80' : '#FBBF24',
                              backgroundColor: rec.punctuality === 'On Time' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}>
                              {rec.punctuality === 'On Time' ? '✓ On Time' : `⚠️ Late (${rec.late_minutes || 15}m)`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>--</span>
                          )}
                        </td>

                        {/* First In */}
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {rec?.first_in ? new Date(rec.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                        </td>

                        {/* Last Seen / Out */}
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {rec?.last_out ? new Date(rec.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {isPresent ? `${rec.total_hours.toFixed(2)} hrs` : '0.00 hrs'}
                        </td>

                        {/* Overtime */}
                        <td style={{ padding: '12px 14px' }}>
                          {isPresent && (rec.overtime_hours ?? 0) > 0 ? (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#A78BFA',
                              backgroundColor: 'rgba(167, 139, 250, 0.12)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              +{rec.overtime_hours?.toFixed(2)} hrs OT
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>0.00</span>
                          )}
                        </td>

                        {/* Camera Source / Location */}
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Camera size={13} style={{ color: 'var(--text-tertiary)' }} />
                            <span>{rec?.camera_source || 'Optical Turnstile Stream'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Historical Records */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Date</th>
                    <th style={{ padding: '10px 14px' }}>Personnel</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Shift</th>
                    <th style={{ padding: '10px 14px' }}>Check In</th>
                    <th style={{ padding: '10px 14px' }}>Check Out</th>
                    <th style={{ padding: '10px 14px' }}>Duration</th>
                    <th style={{ padding: '10px 14px' }}>Scans</th>
                    <th style={{ padding: '10px 14px' }}>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{r.date}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.person_name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          color: '#4ADE80',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{r.shift?.split(' (')[0] || 'General'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                        {r.first_in ? new Date(r.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                        {r.last_out ? new Date(r.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{r.total_hours.toFixed(2)} hrs</td>
                      <td style={{ padding: '10px 14px' }}>{r.check_in_count}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{r.verification_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Personnel Directory */}
        {activeTab === 'directory' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {enrolledPeople.map((person) => (
              <div
                key={person.id}
                style={{
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: 'var(--accent-citron)',
                  fontSize: '14px'
                }}>
                  {person.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                    {person.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    EMP-{person.id.toString().padStart(3, '0')} • Enrolled {person.created_at ? new Date(person.created_at).toLocaleDateString() : 'Active'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#4ADE80', marginTop: '2px', fontWeight: 600 }}>
                    Biometric Encryption Active
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Check-In Modal */}
      {isCheckInModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Manual Attendance Check-In
              </h3>
              <button
                onClick={() => setIsCheckInModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Personnel</label>
                <input
                  type="text"
                  placeholder="Enter worker's full name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    marginTop: '4px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    marginTop: '4px'
                  }}
                >
                  <option value="Present">Present</option>
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                  <option value="On Duty">On Duty</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Notes / Reason</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    marginTop: '4px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCheckIn}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--accent-citron)',
                    border: 'none',
                    color: '#000',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmittingCheckIn ? 'Recording...' : 'Record Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
