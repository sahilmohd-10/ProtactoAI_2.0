import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  X,
  Camera,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin
} from 'lucide-react';
import type { Incident } from '../types';
import { api } from '../services/api';

const formatDisplayTime = (timeStr?: string | null): string => {
  if (!timeStr) return '--:--:--';
  let str = timeStr.trim();
  if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

interface IncidentManagementProps {
  incidents: Incident[];
  onRefresh: () => void;
}

export const IncidentManagement: React.FC<IncidentManagementProps> = ({ incidents, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'In Review' | 'Resolved'>('All');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Auto-refresh poll every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      onRefresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  // Filter incidents
  const filtered = incidents.filter((inc) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ = !q || (
      (inc.title || '').toLowerCase().includes(q) ||
      (inc.id || '').toLowerCase().includes(q) ||
      (inc.category || '').toLowerCase().includes(q) ||
      (inc.location || '').toLowerCase().includes(q) ||
      (inc.worker_id || '').toLowerCase().includes(q)
    );
    const matchesSev = severityFilter === 'All' || inc.severity === severityFilter;
    const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;
    return matchesQ && matchesSev && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIncidents = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isAllFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async (deleteAll = false) => {
    const count = deleteAll ? filtered.length : selectedIds.size;
    if (count === 0) return;

    const confirmMsg = deleteAll
      ? `Permanently delete all ${filtered.length} matching incident records? This action cannot be undone.`
      : `Permanently delete ${count} selected incident record${count > 1 ? 's' : ''}? This action cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    setIsUpdating(true);
    try {
      const idsToDelete = deleteAll ? filtered.map((i) => i.id) : Array.from(selectedIds);
      try {
        await api.batchDeleteIncidents(idsToDelete, deleteAll && filtered.length === incidents.length);
      } catch {
        // Robust fallback: delete via individual confirmed endpoints
        await Promise.all(idsToDelete.map((id) => api.deleteIncident(id, true).catch(() => null)));
      }
      setSelectedIds(new Set());
      setSelectedIncident(null);
      onRefresh();
    } catch (err: any) {
      alert(`Error deleting incidents: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, notes?: string) => {
    setIsUpdating(true);
    try {
      await api.updateIncident(id, { status: newStatus, notes });
      onRefresh();
      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident(prev => prev ? { ...prev, status: newStatus as any, resolution_notes: notes || prev.resolution_notes } : null);
      }
    } catch (err: any) {
      alert(`Error updating incident: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Permanently remove incident record ${id}?`)) return;
    setIsUpdating(true);
    try {
      await api.deleteIncident(id, true);
      setDeleteId(null);
      setSelectedIncident(null);
      onRefresh();
    } catch (err: any) {
      alert(`Error removing incident: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCSV = () => {
    window.open(`${api.baseUrl}/api/incidents/export?format=csv`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        padding: '20px 24px',
        border: '1px solid #E2E8F0'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Safety Incident Register
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Comprehensive infraction tracking, safety protocol investigations, and resolution logs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleToggleSelectAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: isAllFilteredSelected ? '#E2E8F0' : '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filtered.length})`}</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => handleBatchDelete(false)}
              disabled={isUpdating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                backgroundColor: '#DC2626',
                border: 'none',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
              }}
            >
              <Trash2 size={15} />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Export CSV Log</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        padding: '16px 20px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#F8FAFC', padding: '8px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident ID, category, worker, location..."
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: '#0F172A' }}
          />
        </div>

        {/* Severity Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>SEVERITY:</span>
          {(['All', 'High', 'Medium', 'Low'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setSeverityFilter(s); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: severityFilter === s ? 700 : 500,
                backgroundColor: severityFilter === s ? '#0F5132' : '#F1F5F9',
                color: severityFilter === s ? '#FFFFFF' : '#475569',
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>STATUS:</span>
          {(['All', 'Open', 'In Review', 'Resolved'] as const).map(st => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: statusFilter === st ? 700 : 500,
                backgroundColor: statusFilter === st ? '#1E293B' : '#F1F5F9',
                color: statusFilter === st ? '#FFFFFF' : '#475569',
                cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          borderRadius: '16px',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11.5px',
              fontWeight: 800
            }}>
              {selectedIds.size}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>
              {selectedIds.size} incident{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
              ({Math.round((selectedIds.size / Math.max(1, filtered.length)) * 100)}% of filtered view)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set(filtered.map(i => i.id)))}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Select All Filtered ({filtered.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                backgroundColor: 'transparent',
                color: '#94A3B8',
                border: 'none',
                padding: '6px 10px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Deselect All
            </button>

            <button
              type="button"
              onClick={() => handleBatchDelete(false)}
              disabled={isUpdating}
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
              }}
            >
              <Trash2 size={13} />
              <span>{isUpdating ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Structured Clean Incidents Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={handleToggleSelectAll}
                  style={{ width: '16px', height: '16px', accentColor: '#0F5132', cursor: 'pointer' }}
                  title={isAllFilteredSelected ? "Deselect All" : "Select All"}
                />
              </th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>INCIDENT ID</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>SEVERITY</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>CATEGORY & TITLE</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>LOCATION</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>TIMESTAMP</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>STATUS</th>
              <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pageIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                  No matching incident records found.
                </td>
              </tr>
            ) : (
              pageIncidents.map((inc) => (
                <tr
                  key={inc.id}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    backgroundColor: selectedIds.has(inc.id) ? '#F1F5F9' : '#FFFFFF',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(inc.id)) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(inc.id)) e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                >
                  {/* Select Checkbox */}
                  <td style={{ padding: '14px 16px', width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inc.id)}
                      onClick={(e) => handleToggleSelectOne(inc.id, e)}
                      onChange={() => {}}
                      style={{ width: '16px', height: '16px', accentColor: '#0F5132', cursor: 'pointer' }}
                    />
                  </td>
                  {/* ID */}
                  <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                    {inc.id}
                  </td>

                  {/* Severity Badge */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: inc.severity === 'High' ? '#FEF2F2' : (inc.severity === 'Medium' ? '#FEF3C7' : '#EFF6FF'),
                      color: inc.severity === 'High' ? '#DC2626' : (inc.severity === 'Medium' ? '#B45309' : '#1D4ED8')
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: inc.severity === 'High' ? '#DC2626' : (inc.severity === 'Medium' ? '#F59E0B' : '#3B82F6')
                      }} />
                      {inc.severity}
                    </span>
                  </td>

                  {/* Category & Title */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                        {inc.title || inc.category}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        {inc.category} {inc.worker_id && !['Unassigned', 'Persistent-Engine'].includes(inc.worker_id) ? `• ${inc.worker_id}` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Location */}
                  <td style={{ padding: '14px 18px', fontSize: '13px', color: '#475569' }}>
                    {inc.location || 'North Floor — Camera 01'}
                  </td>

                  {/* Timestamp */}
                  <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748B' }}>
                    {inc.timestamp ? formatDisplayTime(inc.timestamp) : (inc.time_ago || '--')}
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 10px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: inc.status === 'Resolved' ? '#DCFCE7' : (inc.status === 'In Review' ? '#FEF3C7' : '#FEE2E2'),
                      color: inc.status === 'Resolved' ? '#166534' : (inc.status === 'In Review' ? '#92400E' : '#991B1B')
                    }}>
                      {inc.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setResolutionNotes(inc.resolution_notes || '');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>

                      {inc.status !== 'Resolved' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(inc.id, 'Resolved', 'Marked resolved by operator')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#EBF8F2',
                            color: '#0F5132',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Resolve
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(inc.id)}
                        title="Delete record"
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#94A3B8',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          fontSize: '12.5px',
          color: '#64748B'
        }}>
          <span>Showing {pageIncidents.length} of {filtered.length} total infractions</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 700, color: '#0F172A' }}>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Incident Inspection Modal */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '640px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>
                  {selectedIncident.id} • INCIDENT INSPECTION
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '2px 0 0 0' }}>
                  {selectedIncident.title || selectedIncident.category}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Snapshot image if available */}
              {selectedIncident.snapshot_url && (
                <div style={{ width: '100%', height: '220px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#0F172A', border: '1px solid #E2E8F0' }}>
                  <img
                    src={`${api.baseUrl}${selectedIncident.snapshot_url}`}
                    alt="Infraction Snapshot"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>SEVERITY LEVEL</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: selectedIncident.severity === 'High' ? '#DC2626' : '#F59E0B', marginTop: '2px' }}>
                    {selectedIncident.severity} Severity
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>LOCATION / CAMERA</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedIncident.location || 'North Floor Camera 01'}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>DETECTION CONFIDENCE</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedIncident.confidence ? `${Math.round(selectedIncident.confidence * 100)}%` : '92%'}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>CURRENT STATUS</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: selectedIncident.status === 'Resolved' ? '#166534' : '#991B1B', marginTop: '2px' }}>
                    {selectedIncident.status}
                  </div>
                </div>
              </div>

              {/* Resolution Notes */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  SUPERVISOR RESOLUTION NOTES
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record corrective actions taken, personnel counselled, or site safety clearance..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    fontFamily: 'sans-serif',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                onClick={() => handleDelete(selectedIncident.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid #FCA5A5',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Delete Record
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'Resolved', resolutionNotes)}
                  disabled={isUpdating}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0F5132',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isUpdating ? 'Saving...' : 'Resolve & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
