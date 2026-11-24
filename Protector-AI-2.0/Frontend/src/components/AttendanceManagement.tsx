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
  Camera,
  Check,
  Filter,
  TrendingUp,
  Activity,
  FileText,
  Building,
  CheckSquare,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Paperclip,
  UploadCloud,
  Laptop,
  X
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

  // Laptop Excel Attachment & Sync State
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [showLaptopSyncModal, setShowLaptopSyncModal] = useState(false);

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

  // Attach and import Excel from laptop
  const handleAttachExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingExcel(true);
    try {
      const res = await api.importAttendanceExcel(file);
      showNotification('success', res.message || 'Laptop Excel attached and synchronized to cloud successfully!');
      loadAttendanceData(false);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to import Excel workbook');
    } finally {
      setIsUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Map of checked-in personnel for today
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

  const filteredHistoryRecords = records.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.person_name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.shift && r.shift.toLowerCase().includes(q)) ||
        (r.date && r.date.includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13.5px',
          fontWeight: 600,
          backgroundColor: notification.type === 'success' ? '#EBF8F2' : '#FEE2E2',
          border: `1px solid ${notification.type === 'success' ? 'rgba(15, 81, 50, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
          color: notification.type === 'success' ? '#0F5132' : '#DC2626',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} color="#0F5132" /> : <AlertCircle size={18} color="#DC2626" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Donezo Header Section */}
      <div className="donezo-header">
        <div>
          <h1>Biometric Attendance & Excel Register</h1>
          <p>Autonomous facial recognition, 24-hour shift de-duplication, punctuality metrics, and live Excel synchronization.</p>
        </div>

        {/* Global Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Hidden file input for attaching laptop Excel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAttachExcel}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingExcel}
            className="donezo-btn-outline"
            style={{
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE',
              color: '#1D4ED8',
              fontWeight: 700
            }}
            title="Attach and import Attendance.xlsx from this laptop"
          >
            <Paperclip size={15} color="#1D4ED8" />
            <span>{isUploadingExcel ? 'Attaching Excel...' : 'Attach Laptop Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLaptopSyncModal(true)}
            className="donezo-btn-outline"
            title="How to auto-sync D:\Downloads\Attendance.xlsx in background"
          >
            <Laptop size={15} color="#0F5132" />
            <span>Laptop Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCheckInModalOpen(true)}
            className="donezo-btn-green"
          >
            <Plus size={16} />
            <span>Manual Check-In</span>
          </button>

          <button
            type="button"
            onClick={handleSyncExcel}
            disabled={isSyncingExcel}
            className="donezo-btn-outline"
          >
            <RefreshCw size={15} className={isSyncingExcel ? 'spin' : ''} />
            <span>{isSyncingExcel ? 'Syncing...' : 'Sync Excel'}</span>
          </button>

          <a
            href={api.getAttendanceExportUrl()}
            download="Attendance.xlsx"
            className="donezo-btn-outline"
            style={{ textDecoration: 'none' }}
          >
            <Download size={15} />
            <span>Download .XLSX</span>
          </a>

          <button
            type="button"
            onClick={handleOpenExcel}
            className="donezo-btn-outline"
          >
            <FileSpreadsheet size={15} color="#0F5132" />
            <span>Open in Excel</span>
          </button>

          <a
            href={api.getAttendanceCsvExportUrl()}
            download={`attendance_${todayStr}.csv`}
            className="donezo-btn-outline"
            style={{ textDecoration: 'none' }}
          >
            <FileText size={15} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* 5 Donezo KPI Metric Cards */}
      <div className="donezo-kpi-grid">
        {/* Card 1: Featured Deep Forest Green Card - Total Workforce */}
        <div className="donezo-card-green">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Enrolled Workforce</span>
            <div className="donezo-arrow-circle">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="donezo-card-number">
              {summary?.total_enrolled ?? enrolledPeople.length}
            </div>
            <span className="donezo-badge-green">
              <span>●</span> 100% Biometric Enrolled
            </span>
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Present Today</span>
            <div className="donezo-arrow-circle">
              <UserCheck size={16} color="#16A34A" />
            </div>
          </div>
          <div>
            <div className="donezo-card-number" style={{ color: '#16A34A' }}>
              {summary?.present_today ?? checkedInMap.size}
            </div>
            <span className="donezo-badge-white">
              {summary?.attendance_rate ?? 0}% Turnout Rate
            </span>
          </div>
        </div>

        {/* Card 3: Active On-Site Now */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Active On-Site</span>
            <div className="donezo-arrow-circle">
              <Activity size={16} color="#2563EB" />
            </div>
          </div>
          <div>
            <div className="donezo-card-number" style={{ color: '#2563EB' }}>
              {summary?.active_on_site_now ?? summary?.present_today ?? 0}
            </div>
            <span className="donezo-badge-white">
              Live camera pulse (45m)
            </span>
          </div>
        </div>

        {/* Card 4: Punctuality Index */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Punctuality Score</span>
            <div className="donezo-arrow-circle">
              <Clock size={16} color="#D97706" />
            </div>
          </div>
          <div>
            <div className="donezo-card-number" style={{ color: '#D97706' }}>
              {summary?.punctuality_rate ?? 100}%
            </div>
            <span className="donezo-badge-white">
              {summary?.on_time_count ?? 0} On-time arrivals
            </span>
          </div>
        </div>

        {/* Card 5: Local Excel Registry */}
        <div className="donezo-card-white">
          <div className="donezo-card-header">
            <span className="donezo-card-title">Excel Registry</span>
            <div className="donezo-arrow-circle">
              <FileSpreadsheet size={16} color="#0F5132" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '12px 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
              <span>Active</span>
            </div>
            <span className="donezo-badge-white">
              {summary?.last_excel_sync ? `Synced: ${new Date(summary.last_excel_sync).toLocaleTimeString()}` : 'Real-time 24h Excel'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs and Search / Filter Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '16px 22px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
      }}>
        {/* Segmented Tab Navigation Controls */}
        <div style={{
          display: 'inline-flex',
          backgroundColor: '#F1F5F9',
          padding: '4px',
          borderRadius: '14px',
          gap: '4px'
        }}>
          {[
            { id: 'today', label: `Today's Register (${checkedInMap.size}/${enrolledPeople.length})`, icon: Calendar },
            { id: 'analytics', label: 'Shift & Punctuality', icon: Activity },
            { id: 'history', label: `Historical Register (${records.length})`, icon: Clock },
            { id: 'directory', label: `Personnel Directory (${enrolledPeople.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 600,
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? '#0F172A' : '#64748B',
                  boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} color={isActive ? '#0F5132' : '#94A3B8'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F8FAFC',
            padding: '8px 14px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            width: '240px'
          }}>
            <Search size={15} color="#94A3B8" />
            <input
              type="text"
              placeholder="Search personnel, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#0F172A',
                width: '100%'
              }}
            />
          </div>

          {/* Quick Filter Buttons for Today View */}
          {activeTab === 'today' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>FILTER:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active Now' },
                { id: 'on_time', label: 'On-Time' },
                { id: 'late', label: 'Late' },
                { id: 'overtime', label: 'Overtime' },
                { id: 'absent', label: 'Absent' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: statusFilter === f.id ? 700 : 500,
                    backgroundColor: statusFilter === f.id ? '#0F5132' : '#F1F5F9',
                    color: statusFilter === f.id ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: TODAY'S LIVE ATTENDANCE REGISTER */}
      {activeTab === 'today' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  color: '#64748B',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '16px 20px' }}>Worker / Identity</th>
                  <th style={{ padding: '16px 20px' }}>Status</th>
                  <th style={{ padding: '16px 20px' }}>Assigned Shift</th>
                  <th style={{ padding: '16px 20px' }}>Punctuality</th>
                  <th style={{ padding: '16px 20px' }}>First In</th>
                  <th style={{ padding: '16px 20px' }}>Last Seen</th>
                  <th style={{ padding: '16px 20px' }}>Duration</th>
                  <th style={{ padding: '16px 20px' }}>Overtime</th>
                  <th style={{ padding: '16px 20px' }}>Detection Stream</th>
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
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Worker Identity */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: isPresent ? '#EBF8F2' : '#F1F5F9',
                            color: isPresent ? '#0F5132' : '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 700,
                            border: `1px solid ${isPresent ? 'rgba(15, 81, 50, 0.2)' : '#E2E8F0'}`
                          }}>
                            {person.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                              {person.name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                              EMP-{person.id.toString().padStart(3, '0')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '16px 20px' }}>
                        {isPresent ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: '#EBF8F2',
                            color: '#0F5132',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                            {rec.status}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                            Not Checked In
                          </span>
                        )}
                      </td>

                      {/* Assigned Shift */}
                      <td style={{ padding: '16px 20px', color: '#475569', fontSize: '13px' }}>
                        {rec?.shift?.split(' (')[0] || 'General Shift'}
                      </td>

                      {/* Punctuality Badge */}
                      <td style={{ padding: '16px 20px' }}>
                        {isPresent ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: rec.punctuality === 'On Time' ? '#EBF8F2' : '#FEF3C7',
                            color: rec.punctuality === 'On Time' ? '#0F5132' : '#D97706',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }}>
                            {rec.punctuality === 'On Time' ? '✓ On-Time' : `⚠️ Late (+${rec.late_minutes || 15}m)`}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>--</span>
                        )}
                      </td>

                      {/* First In */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#0F172A' }}>
                        {rec?.first_in ? new Date(rec.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                      </td>

                      {/* Last Seen / Out */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#0F172A' }}>
                        {rec?.last_out ? new Date(rec.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#0F172A', fontWeight: 600 }}>
                        {isPresent ? `${rec.total_hours.toFixed(2)} hrs` : '0.00 hrs'}
                      </td>

                      {/* Overtime */}
                      <td style={{ padding: '16px 20px' }}>
                        {isPresent && (rec.overtime_hours ?? 0) > 0 ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#EDE9FE',
                            color: '#7C3AED',
                            fontSize: '11.5px',
                            fontWeight: 700
                          }}>
                            +{rec.overtime_hours?.toFixed(2)}h OT
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>0.00</span>
                        )}
                      </td>

                      {/* Detection Zone / Camera */}
                      <td style={{ padding: '16px 20px', color: '#64748B', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Camera size={14} color="#94A3B8" />
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

      {/* TAB 2: SHIFT & PUNCTUALITY ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 7-Day Trend Chart Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
            padding: '24px 28px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  7-Day Attendance & Turnout Trend
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Daily workforce turnout and arrival punctuality overview.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F5132' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0F5132' }} />
                  On-Time Arrivals
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#D97706' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                  Late Arrivals
                </span>
              </div>
            </div>

            {/* Visual Bars for Weekly Trend */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', height: '160px', paddingTop: '10px' }}>
              {summary?.weekly_trend?.map((item: WeeklyAttendanceTrend, idx: number) => {
                const total = Math.max(1, summary?.total_enrolled || 1);
                const onTimeH = (item.on_time / total) * 100;
                const lateH = (item.late / total) * 100;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                      {item.present}
                    </div>
                    <div style={{
                      width: '100%',
                      maxWidth: '46px',
                      height: '110px',
                      backgroundColor: '#F1F5F9',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      overflow: 'hidden'
                    }}>
                      <div style={{ height: `${onTimeH}%`, backgroundColor: '#0F5132', transition: 'height 0.3s ease' }} />
                      <div style={{ height: `${lateH}%`, backgroundColor: '#F59E0B', transition: 'height 0.3s ease' }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      {item.day}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Industrial Shift Breakdown & Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
            }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>
                Shift Distribution (Today)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(summary?.shift_distribution || { 'General Shift': summary?.present_today || 0 }).map(([sh, count]) => (
                  <div key={sh} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#64748B', fontWeight: 500 }}>{sh}</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{count} workers</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
            }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>
                Punctuality & Shift Highlights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Standard Shift Length:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>8.0 Hours</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Grace Period:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>15 Minutes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Workers in Overtime:</span>
                  <span style={{ fontWeight: 700, color: '#7C3AED' }}>{summary?.overtime_count || 0} Personnel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORICAL REGISTER TABLE */}
      {activeTab === 'history' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  color: '#64748B',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '16px 20px' }}>Date</th>
                  <th style={{ padding: '16px 20px' }}>Personnel</th>
                  <th style={{ padding: '16px 20px' }}>Status</th>
                  <th style={{ padding: '16px 20px' }}>Shift</th>
                  <th style={{ padding: '16px 20px' }}>Check In</th>
                  <th style={{ padding: '16px 20px' }}>Check Out</th>
                  <th style={{ padding: '16px 20px' }}>Duration</th>
                  <th style={{ padding: '16px 20px' }}>Scans</th>
                  <th style={{ padding: '16px 20px' }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryRecords.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: '#64748B' }}>{r.date}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#0F172A' }}>{r.person_name}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        backgroundColor: '#EBF8F2',
                        color: '#0F5132',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', color: '#475569' }}>{r.shift?.split(' (')[0] || 'General'}</td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {r.first_in ? new Date(r.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {r.last_out ? new Date(r.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0F172A' }}>
                      {r.total_hours.toFixed(2)} hrs
                    </td>
                    <td style={{ padding: '16px 20px', color: '#64748B' }}>{r.check_in_count}</td>
                    <td style={{ padding: '16px 20px', color: '#64748B' }}>{r.verification_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ENROLLED PERSONNEL DIRECTORY */}
      {activeTab === 'directory' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {enrolledPeople.map((person) => (
            <div
              key={person.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '24px',
                border: '1px solid #E2E8F0',
                padding: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)'
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: '#EBF8F2',
                color: '#0F5132',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
                border: '1px solid rgba(15, 81, 50, 0.2)'
              }}>
                {person.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                  {person.name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  EMP-{person.id.toString().padStart(3, '0')} • Active
                </div>
                <div style={{ fontSize: '11.5px', color: '#16A34A', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={13} />
                  <span>Biometric Verified</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualName(person.name);
                  setIsCheckInModalOpen(true);
                }}
                className="donezo-btn-outline"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                + Check In
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manual Check-In Modal */}
      {isCheckInModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Manual Attendance Check-In
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Record a verified attendance entry for today's registry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckInModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Personnel Name
                </label>
                <input
                  type="text"
                  placeholder="Enter worker full name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                    color: '#0F172A',
                    fontSize: '13.5px',
                    marginTop: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Attendance Status
                </label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                    color: '#0F172A',
                    fontSize: '13.5px',
                    marginTop: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Present">Present</option>
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Overtime">Overtime</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Notes / Shift Reason
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                    color: '#0F172A',
                    fontSize: '13.5px',
                    marginTop: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="donezo-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCheckIn}
                  className="donezo-btn-green"
                >
                  {isSubmittingCheckIn ? 'Recording...' : 'Record Check-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Laptop Excel Two-Way Sync Modal */}
      {showLaptopSyncModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
            border: '1px solid #E2E8F0',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB'
                }}>
                  <Laptop size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Attach & Sync Laptop Excel
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Connect D:\Downloads\Attendance.xlsx to the cloud application
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLaptopSyncModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
              <div style={{
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0'
              }}>
                <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                  Method 1: Direct File Attachment (In-App)
                </div>
                <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px' }}>
                  Click the <strong>"Attach Laptop Excel"</strong> button on the toolbar anytime you want to upload and synchronize your local <code>D:\Downloads\Attendance.xlsx</code> file directly into this cloud deployment.
                </p>
              </div>

              <div style={{
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #DCFCE7'
              }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                  Method 2: Automatic Real-Time Laptop Background Sync
                </div>
                <p style={{ margin: 0, color: '#166534', fontSize: '12.5px' }}>
                  A double-clickable sync script is pre-installed on your laptop at:
                  <br />
                  <code style={{ fontWeight: 700, display: 'inline-block', marginTop: '4px', backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                    D:\Downloads\ProtectoAI\sync_laptop_excel.bat
                  </code>
                  <br />
                  Double-click it once to automatically keep your local <code>D:\Downloads\Attendance.xlsx</code> synchronized in real time with the cloud camera and attendance records!
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowLaptopSyncModal(false);
                  fileInputRef.current?.click();
                }}
                className="donezo-btn-green"
              >
                <Paperclip size={16} />
                <span>Choose & Attach Excel Now</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLaptopSyncModal(false)}
                className="donezo-btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
