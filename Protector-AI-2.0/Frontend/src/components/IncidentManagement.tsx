import React, { useState, useEffect } from 'react';
import type { Incident } from '../types';
import { api } from '../services/api';

interface IncidentManagementProps {
  incidents: Incident[];
  onRefresh: () => void;
}

export const IncidentManagement: React.FC<IncidentManagementProps> = ({ incidents, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Auto-refresh incidents continuously every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      onRefresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  // Reset to first page when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, severityFilter, statusFilter]);

  // Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    const rawWorker = inc.worker_id || '';
    const extractedName = !['Persistent-Engine', 'Auto-Flagged', 'Unassigned Worker', 'Unassigned'].includes(rawWorker)
      ? rawWorker
      : (inc.title?.match(/\(([^)]+)\)/)?.[1] || '');

    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || (
      (inc.title || '').toLowerCase().includes(q) ||
      (inc.id || '').toLowerCase().includes(q) ||
      (inc.location || '').toLowerCase().includes(q) ||
      (inc.worker_id || '').toLowerCase().includes(q) ||
      (inc.category || '').toLowerCase().includes(q) ||
      (inc.assigned_to || '').toLowerCase().includes(q) ||
      extractedName.toLowerCase().includes(q)
    );

    const matchesSeverity = severityFilter === 'All' || inc.severity === severityFilter;
    const matchesStatus = statusFilter === 'All' || inc.status === statusFilter;

    return matchesQuery && matchesSeverity && matchesStatus;
  });

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredIncidents.length);
  const paginatedIncidents = filteredIncidents.slice(startIndex, endIndex);

  const handleUpdateStatus = async (id: string, newStatus: string, notes?: string) => {
    try {
      setIsUpdating(true);
      await api.updateIncident(id, { status: newStatus, notes });
      onRefresh();
      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident({ ...selectedIncident, status: newStatus as any, resolution_notes: notes || selectedIncident.resolution_notes });
      }
    } catch (err: any) {
      alert(`Error updating incident: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    try {
      setIsUpdating(true);
      await api.deleteIncident(id, true);
      setDeleteConfirmationId(null);
      setSelectedIncident(null);
      onRefresh();
    } catch (err: any) {
      alert(`Error deleting incident: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCSV = async () => {
    window.open(`${api.baseUrl}/api/incidents/export?format=csv`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div className="section-tag" style={{ marginBottom: '6px' }}>
            <span className="section-tag-num">02</span>
            <span>/ INCIDENT AUDIT TRAIL</span>
          </div>
          <h2 className="display-title" style={{ fontSize: '24px' }}>
            Safety Violations & Infraction Records
          </h2>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-secondary"
        >
          Export CSV Log
        </button>
      </div>

      {/* Filter Bar (Clean, Typography-driven) */}
      <div className="precision-surface" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '460px', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)', fontSize: '13px', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search person name, incident ID, category, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '5px',
                padding: '8px 30px 8px 30px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Severity Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginRight: '4px' }}>
              Severity:
            </span>
            {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: severityFilter === sev ? 'var(--accent-citron)' : 'var(--border-subtle)',
                  backgroundColor: severityFilter === sev ? 'var(--accent-citron-subtle)' : 'transparent',
                  color: severityFilter === sev ? 'var(--accent-citron)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {sev.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginRight: '4px' }}>
              Status:
            </span>
            {['All', 'Open', 'In Review', 'Acknowledged', 'Resolved'].map((stat) => (
              <button
                key={stat}
                onClick={() => setStatusFilter(stat)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10.5px',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: statusFilter === stat ? 'var(--accent-citron)' : 'var(--border-subtle)',
                  backgroundColor: statusFilter === stat ? 'var(--accent-citron-subtle)' : 'transparent',
                  color: statusFilter === stat ? 'var(--accent-citron)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {stat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Structured Table */}
      <div className="precision-surface" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              DATABASE AUDIT RECORDS ({filteredIncidents.length} TOTAL)
            </span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.25)', padding: '2px 8px', borderRadius: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--safety-safe)' }} className="animate-signal-pulse" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--safety-safe)', fontWeight: 600 }}>
                LIVE AUTO-REFRESH (3s)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
              PAGE {validCurrentPage} OF {totalPages}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-citron)' }}>
              SQLITE VERIFIED
            </span>
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            NO INCIDENT RECORDS FOUND MATCHING QUERY
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <th style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Incident ID & Title</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Category</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Severity</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Location</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Person / Name</th>
                  <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIncidents.map((inc) => {
                  const isCritical = inc.severity === 'Critical';
                  const isHigh = inc.severity === 'High';
                  const isResolved = inc.status === 'Resolved';

                  return (
                    <tr
                      key={inc.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.1s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inc.title}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {inc.id}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {inc.category}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className={`status-pill ${isCritical ? 'status-pill-violation' : (isHigh ? 'status-pill-warning' : 'status-pill-neutral')}`}>
                          {inc.severity}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {inc.location}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {(() => {
                          const rawWorker = inc.worker_id || '';
                          const extractedName = !['Persistent-Engine', 'Auto-Flagged', 'Unassigned Worker', 'Unassigned'].includes(rawWorker)
                            ? rawWorker
                            : (inc.title.match(/\(([^)]+)\)/)?.[1] || null);

                          if (extractedName && !['Persistent-Engine', 'Auto-Flagged', 'Unassigned Worker', 'Unassigned'].includes(extractedName)) {
                            const names = extractedName.split(',').map((n: string) => n.trim()).filter(Boolean);
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {names.map((name: string, idx: number) => (
                                  <span key={idx} className="status-pill status-pill-safe" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                                    <span style={{ fontSize: '12px' }}>👤</span>
                                    <span>{name}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          return (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              Unassigned
                            </span>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className={`status-pill ${isResolved ? 'status-pill-safe' : 'status-pill-neutral'}`}>
                          {inc.status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setSelectedIncident(inc);
                              setResolutionNotes(inc.resolution_notes || '');
                            }}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                          >
                            Inspect
                          </button>

                          {inc.status !== 'Resolved' && (
                            <button
                              onClick={() => handleUpdateStatus(inc.id, 'Resolved', 'Resolved via incident table action')}
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--safety-safe)' }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredIncidents.length > 0 && (
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            {/* Record count info */}
            <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredIncidents.length === 0 ? 0 : startIndex + 1}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{endIndex}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{filteredIncidents.length}</strong> records
              </span>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </span>
            </div>

            {/* Page number buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage <= 1}
                className="btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  opacity: validCurrentPage <= 1 ? 0.35 : 1,
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
                title="First Page"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  opacity: validCurrentPage <= 1 ? 0.35 : 1,
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
                title="Previous Page"
              >
                ‹ Prev
              </button>

              {/* Numbered page buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 2;
                })
                .map((pageNum, idx, arr) => {
                  const prevPage = arr[idx - 1];
                  const hasGap = prevPage && pageNum - prevPage > 1;
                  const isActive = pageNum === validCurrentPage;

                  return (
                    <React.Fragment key={pageNum}>
                      {hasGap && (
                        <span style={{ padding: '0 4px', color: 'var(--text-tertiary)' }}>...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          minWidth: '28px',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: isActive ? 700 : 500,
                          backgroundColor: isActive ? 'var(--accent-citron)' : 'var(--bg-app)',
                          color: isActive ? '#0A0D12' : 'var(--text-secondary)',
                          border: isActive ? '1px solid var(--accent-citron)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
                title="Next Page"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage >= totalPages}
                className="btn-secondary"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Incident Detail Inspection Modal */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 7, 11, 0.88)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="precision-surface-elevated" style={{
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedIncident(null)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className={`status-pill ${selectedIncident.severity === 'Critical' ? 'status-pill-violation' : 'status-pill-warning'}`}>
                {selectedIncident.severity}
              </span>
              <span className="status-pill status-pill-neutral">
                {selectedIncident.status}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                {selectedIncident.id}
              </span>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
              {selectedIncident.title}
            </h3>

            {/* Evidence Image Preview */}
            <div style={{
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: '#05070B',
              border: '1px solid var(--border-charcoal)',
              marginBottom: '16px',
              aspectRatio: '16 / 9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedIncident.snapshot_url ? (
                <img
                  src={selectedIncident.snapshot_url.startsWith('http') ? selectedIncident.snapshot_url : `${api.baseUrl}${selectedIncident.snapshot_url}`}
                  alt="Incident Optical Evidence"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  OPTICAL SNAPSHOT ARCHIVED IN EDGE STORAGE
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>LOCATION</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedIncident.location}</div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>IDENTIFIED PERSON(S) / NAME</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  {(() => {
                    const rawWorker = selectedIncident.worker_id || '';
                    const personName = !['Persistent-Engine', 'Auto-Flagged', 'Unassigned Worker', 'Unassigned'].includes(rawWorker)
                      ? rawWorker
                      : (selectedIncident.title.match(/\(([^)]+)\)/)?.[1] || 'Unassigned Worker');
                    const isKnown = !['Persistent-Engine', 'Auto-Flagged', 'Unassigned Worker', 'Unassigned'].includes(personName);

                    if (isKnown) {
                      const names = personName.split(',').map((n: string) => n.trim()).filter(Boolean);
                      return names.map((name: string, idx: number) => (
                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px' }}>👤 {name}</span>
                          <span className="status-pill status-pill-safe" style={{ fontSize: '9px', padding: '1px 5px' }}>TRAINED FACE</span>
                        </div>
                      ));
                    }

                    return <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px' }}>Unassigned Worker</span>;
                  })()}
                </div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>RECORDED AT</span>
                <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{selectedIncident.timestamp ? new Date(selectedIncident.timestamp).toLocaleString() : 'Recent'}</div>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>ASSIGNED TO</span>
                <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{selectedIncident.assigned_to}</div>
              </div>
            </div>

            {/* Resolution Notes Input */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                AUDIT RESOLUTION NOTES
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter corrective action details..."
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <button
                onClick={() => setDeleteConfirmationId(selectedIncident.id)}
                className="btn-danger"
                style={{ fontSize: '11.5px', padding: '6px 12px' }}
              >
                Delete Record
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedIncident.status === 'Open' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedIncident.id, 'Acknowledged', resolutionNotes)}
                    disabled={isUpdating}
                    className="btn-secondary"
                    style={{ fontSize: '11.5px', padding: '6px 12px' }}
                  >
                    Acknowledge
                  </button>
                )}

                <button
                  onClick={() => handleUpdateStatus(selectedIncident.id, 'Resolved', resolutionNotes)}
                  disabled={isUpdating}
                  className="btn-citron"
                  style={{ fontSize: '11.5px', padding: '6px 14px' }}
                >
                  {selectedIncident.status === 'Resolved' ? 'Update Notes' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 7, 11, 0.9)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '20px'
        }}>
          <div className="precision-surface-elevated" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--safety-violation)', textTransform: 'uppercase', marginBottom: '8px' }}>
              CONFIRM PERMANENT RECORD DELETION
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to delete incident <strong>{deleteConfirmationId}</strong>? This action is audited and irreversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setDeleteConfirmationId(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteIncident(deleteConfirmationId)}
                className="btn-danger"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
