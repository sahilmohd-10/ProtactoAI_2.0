import React, { useState } from 'react';
import type { User, AuthUser } from '../types';
import { api } from '../services/api';

interface TeamAccessProps {
  users: User[];
  permissionMatrix: Record<string, string[]>;
  currentUser?: AuthUser | null;
  onRefreshTeam?: () => void;
}

export const TeamAccess: React.FC<TeamAccessProps> = ({
  users,
  currentUser,
  onRefreshTeam
}) => {
  // Always grant full administrative management capability to user
  const canManage = true;
  
  // State for Add Member Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: 'Operator' as 'Administrator' | 'Operator',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Delete Individual User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Prune Test Operators State
  const [isPruning, setIsPruning] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.username.trim() || !formData.email.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      setErrorMsg('First name, last name, username, and email are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTeamUser({
        ...formData,
        password: formData.password || 'Protecto@2026'
      });
      setIsAddModalOpen(false);
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        role: 'Operator',
        password: ''
      });
      showSuccess(`Created user ${formData.username} successfully.`);
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'Administrator' | 'Operator') => {
    try {
      await api.updateTeamUser(userId, { role: newRole });
      showSuccess(`Updated security role to ${newRole}`);
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateTeamUser(userId, { status: newStatus as any });
      showSuccess(`Account status changed to ${newStatus}`);
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: any) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteTeamUser(userToDelete.id);
      showSuccess(`User ${userToDelete.name} removed successfully.`);
      setUserToDelete(null);
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCleanupTestUsers = async () => {
    if (!window.confirm('Are you sure you want to remove all generated test operator accounts?')) {
      return;
    }
    setIsPruning(true);
    try {
      const res = await api.cleanupTestUsers();
      showSuccess(res.message || 'Test accounts pruned successfully.');
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: any) {
      alert(`Failed to prune test accounts: ${err.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const hasTestUsers = users.some(u => u.email.startsWith('worker_') || u.name.includes('Test Operator'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--accent-citron)',
          color: 'var(--text-primary)',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-citron)' }} />
          {successToast}
        </div>
      )}

      {/* Header & Section Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="section-tag" style={{ marginBottom: '6px' }}>
            <span className="section-tag-num">04</span>
            <span>/ AUTHORIZED PERSONNEL & RBAC</span>
          </div>
          <h2 className="display-title" style={{ fontSize: '24px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Team Access & Role Authorization
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '640px' }}>
            Manage authorized site personnel credentials, toggle operational statuses, and configure access roles.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {hasTestUsers && (
            <button
              onClick={handleCleanupTestUsers}
              disabled={isPruning}
              className="btn-secondary"
              style={{
                color: 'var(--safety-violation)',
                borderColor: 'rgba(255, 90, 82, 0.4)',
                backgroundColor: 'rgba(255, 90, 82, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              {isPruning ? 'Pruning...' : 'Prune Test Operators'}
            </button>
          )}

          <button
            onClick={() => {
              if (onRefreshTeam) onRefreshTeam();
              showSuccess('Team roster refreshed.');
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-citron"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Team Member
          </button>
        </div>
      </div>

      {/* Users Roster Table */}
      <div className="precision-surface" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
            SECURITY CREDENTIAL ROSTER ({users.length} REGISTERED IDENTITIES)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="status-pill status-pill-safe">MFA ENFORCED</span>
            <span className="status-pill status-pill-safe" style={{ color: 'var(--accent-citron)', borderColor: 'rgba(215, 255, 100, 0.4)' }}>
              ADMIN PRIVILEGES GRANTED
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
                <th style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Member Identity</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Security Role</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Account Status</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Last Active</th>
                <th style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isRootAdmin = user.email === 'admin@protector.ai' && (user.role === 'Administrator' || (user as any).role === 'Admin');
                const isCurrent = currentUser?.id === user.id || currentUser?.email === user.email;

                return (
                  <tr
                    key={user.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.15s' }}
                  >
                    {/* Identity */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-charcoal)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: user.role === 'Administrator' || (user as any).role === 'Admin' ? 'var(--accent-citron)' : 'var(--text-primary)'
                        }}>
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
                            {isCurrent && (
                              <span style={{
                                fontSize: '9px',
                                fontFamily: 'var(--font-mono)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(215, 255, 100, 0.15)',
                                color: 'var(--accent-citron)',
                                border: '1px solid rgba(215, 255, 100, 0.3)'
                              }}>
                                YOU
                              </span>
                            )}
                            {isRootAdmin && (
                              <span style={{
                                fontSize: '9px',
                                fontFamily: 'var(--font-mono)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(99, 214, 161, 0.15)',
                                color: 'var(--safety-safe)',
                                border: '1px solid rgba(99, 214, 161, 0.3)'
                              }}>
                                ROOT
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Switcher */}
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={user.role === 'Admin' ? 'Administrator' : user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-subtle)',
                          color: user.role === 'Administrator' || user.role === 'Admin' ? 'var(--accent-citron)' : 'var(--text-primary)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Operator">Operator</option>
                      </select>
                    </td>

                    {/* Status Toggle */}
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        onClick={() => handleStatusToggle(user.id, user.status)}
                        title="Click to toggle account status"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <span className={`status-pill ${user.status === 'Active' ? 'status-pill-safe' : 'status-pill-warning'}`} style={{ cursor: 'pointer' }}>
                          {user.status}
                        </span>
                      </button>
                    </td>

                    {/* Last Active */}
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                      {user.last_active ? new Date(user.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Online now'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {isRootAdmin ? (
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                          Protected Root
                        </span>
                      ) : (
                        <button
                          onClick={() => setUserToDelete(user)}
                          style={{
                            fontSize: '11px',
                            padding: '5px 10px',
                            color: 'var(--safety-violation)',
                            backgroundColor: 'rgba(255, 90, 82, 0.08)',
                            border: '1px solid rgba(255, 90, 82, 0.25)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Privileges Matrix */}
      <div className="precision-surface" style={{ padding: '20px' }}>
        <div className="section-tag" style={{ marginBottom: '14px' }}>
          <span className="section-tag-num">02</span>
          <span>/ ROLE PRIVILEGES MATRIX</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-elevated)' }}>
                <th style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: '10px' }}>PERMISSION SCOPE</th>
                <th style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-citron)', textAlign: 'center', fontSize: '10.5px' }}>ADMINISTRATOR</th>
                <th style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'center', fontSize: '10.5px' }}>OPERATOR</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'View Real-Time Optical Feeds', admin: true, op: true },
                { label: 'Acknowledge PPE Infractions', admin: true, op: true },
                { label: 'Resolve Safety Violations', admin: true, op: true },
                { label: 'Permanently Delete Incident Records', admin: true, op: false },
                { label: 'Manage Team Members & Assign Security Roles', admin: true, op: true },
                { label: 'Execute Terminal Administrative Commands', admin: true, op: true },
                { label: 'Calibrate YOLOv8 Inference & Hardware Telemetry', admin: true, op: true },
                { label: 'Export Formal Compliance Audits', admin: true, op: true },
              ].map((perm) => (
                <tr key={perm.label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '9px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {perm.label}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--safety-safe)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    ✓
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    {perm.op ? (
                      <span style={{ color: 'var(--safety-safe)', fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="precision-surface" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border-charcoal)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div className="section-tag" style={{ marginBottom: '4px' }}>
                  <span className="section-tag-num">RBAC</span>
                  <span>/ NEW CREDENTIAL</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Add Team Member</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: 'var(--safety-violation-bg)',
                border: '1px solid var(--safety-violation)',
                color: 'var(--safety-violation)',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
                marginBottom: '14px'
              }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    FIRST NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    LAST NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  USERNAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. john_officer"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  WORK EMAIL *
                </label>
                <input
                  type="email"
                  required
                  placeholder="officer@protector.ai"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    ROLE
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="Operator">Operator</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    PHONE (OPTIONAL)
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  INITIAL PASSWORD (DEFAULT: Protecto@2026)
                </label>
                <input
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 special"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary"
                  style={{ fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-citron"
                  style={{ fontSize: '12px' }}
                >
                  {isSubmitting ? 'Registering...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="precision-surface" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--safety-violation)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--safety-violation)', marginBottom: '8px' }}>
              Confirm Account Removal
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to permanently revoke credentials and delete <strong style={{ color: 'var(--text-primary)' }}>{userToDelete.name}</strong> ({userToDelete.email})?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="btn-secondary"
                style={{ fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                className="btn-danger"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'var(--safety-violation)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isDeleting ? 'Deleting...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
