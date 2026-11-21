import React, { useState, useEffect } from 'react';
import type { User, AuthUser } from '../types';
import { api } from '../services/api';

interface TeamAccessProps {
  users: User[];
  permissionMatrix: Record<string, string[]>;
  currentUser?: AuthUser | null;
  onRefreshTeam?: () => void;
  onSwitchToFaceTraining?: () => void;
}

export const TeamAccess: React.FC<TeamAccessProps> = ({
  users,
  currentUser,
  onRefreshTeam,
  onSwitchToFaceTraining
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

  // Operator Authorization Token Management
  const [operatorToken, setOperatorToken] = useState('OP-AUTH-2026');
  const [isTokenLoading, setIsTokenLoading] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await api.getOperatorTokens();
        if (res?.active_token) {
          setOperatorToken(res.active_token);
        }
      } catch (e) {
        // Fallback gracefully
      }
    };
    fetchToken();
  }, []);

  const handleGenerateNewToken = async () => {
    setIsTokenLoading(true);
    try {
      const res = await api.createOperatorToken();
      if (res?.active_token) {
        setOperatorToken(res.active_token);
        showSuccess(`Generated new Operator Authorization Token: ${res.active_token}`);
      }
    } catch (err: any) {
      alert(`Failed to generate token: ${err.message}`);
    } finally {
      setIsTokenLoading(false);
    }
  };

  // Delete Individual User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Prune Test Operators State
  const [isPruning, setIsPruning] = useState(false);

  // Filter Tabs & Authorization State
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'operator' | 'admin'>('all');
  const [authorizingUserId, setAuthorizingUserId] = useState<number | null>(null);

  const handleAuthorizeUser = async (user: User) => {
    setAuthorizingUserId(user.id);
    try {
      const res = await api.authorizeUser(user.id);
      if (res?.success) {
        showSuccess(`Authorized operator ${user.name}! Unique Token: ${res.token || 'Issued'}`);
        if (onRefreshTeam) onRefreshTeam();
      }
    } catch (err: any) {
      alert(`Failed to authorize operator: ${err.message}`);
    } finally {
      setAuthorizingUserId(null);
    }
  };

  const handleRegenerateToken = async (user: User) => {
    try {
      const res = await api.regenerateUserToken(user.id);
      if (res?.success) {
        showSuccess(`Generated new unique token for ${user.name}: ${res.token}`);
        if (onRefreshTeam) onRefreshTeam();
      }
    } catch (err: any) {
      alert(`Failed to regenerate token: ${err.message}`);
    }
  };

  const handleRevokeUser = async (user: User) => {
    if (!confirm(`Revoke operator authorization and access token for ${user.name}? This operator will be blocked from logging in.`)) return;
    try {
      const res = await api.revokeUserAuthorization(user.id);
      if (res?.success) {
        showSuccess(`Revoked authorization for ${user.name}. Status set to Pending.`);
        if (onRefreshTeam) onRefreshTeam();
      }
    } catch (err: any) {
      alert(`Failed to revoke operator: ${err.message}`);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4500);
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
      const createdRes = await api.createTeamUser({
        ...formData,
        password: formData.password || 'Protecto@2026'
      });
      setIsAddModalOpen(false);
      const assignedToken = (createdRes as any)?.operator_auth_token || operatorToken;
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        role: 'Operator',
        password: ''
      });
      showSuccess(`Created operator ${formData.username}! Hand them Password & Authorization Token: ${assignedToken}`);
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
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Team Access & Role Permissions
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', maxWidth: '640px' }}>
            Manage user accounts, assign Administrator or Operator roles, and configure role-based access control.
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

          {onSwitchToFaceTraining && (
            <button
              onClick={onSwitchToFaceTraining}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0F5132',
                backgroundColor: 'rgba(15, 81, 50, 0.08)',
                borderColor: 'rgba(15, 81, 50, 0.3)'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Face Training Studio
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

      {/* Administrator Operator Authorization Control Panel */}
      <div style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1.5px solid var(--border-subtle)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0284C7',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <circle cx="12" cy="11" r="2"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Operator Authorization Gatekeeper
              </span>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '100px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#16A34A',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontWeight: 700
              }}>
                MANDATORY ENFORCED
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', maxWidth: '580px', lineHeight: 1.4 }}>
              Operators can only log in if they provide their username, password, and this Administrator-issued security token. Anyone without this token is blocked.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active Key:</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284C7', fontFamily: 'monospace', letterSpacing: '1px' }}>
              {operatorToken}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(operatorToken);
              showSuccess(`Copied Operator Authorization Token (${operatorToken}) to clipboard.`);
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Token
          </button>

          <button
            type="button"
            onClick={handleGenerateNewToken}
            disabled={isTokenLoading}
            className="btn-citron"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {isTokenLoading ? 'Generating...' : 'Generate New Token'}
          </button>
        </div>
      </div>

      {/* Users Roster Table with Authorization Filter Tabs */}
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
          {/* Filter Navigation Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: filterTab === 'all' ? 'var(--bg-app)' : 'transparent',
                color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: filterTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              ALL MEMBERS ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('pending')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: filterTab === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: filterTab === 'pending' ? '#D97706' : users.filter(u => u.status === 'Pending').length > 0 ? '#F59E0B' : 'var(--text-tertiary)'
              }}
            >
              <span>PENDING APPROVAL</span>
              <span style={{
                backgroundColor: users.filter(u => u.status === 'Pending').length > 0 ? '#F59E0B' : 'var(--border-subtle)',
                color: users.filter(u => u.status === 'Pending').length > 0 ? '#000000' : 'var(--text-tertiary)',
                borderRadius: '100px',
                fontSize: '10px',
                padding: '1px 6px',
                fontWeight: 800
              }}>
                {users.filter(u => u.status === 'Pending').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('operator')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: filterTab === 'operator' ? 'var(--bg-app)' : 'transparent',
                color: filterTab === 'operator' ? 'var(--text-primary)' : 'var(--text-tertiary)'
              }}
            >
              OPERATORS ({users.filter(u => u.role === 'Operator').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('admin')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: filterTab === 'admin' ? 'var(--bg-app)' : 'transparent',
                color: filterTab === 'admin' ? 'var(--text-primary)' : 'var(--text-tertiary)'
              }}
            >
              ADMINISTRATORS
            </button>
          </div>

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
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Unique Security Token</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>Last Active</th>
                <th style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(u => {
                  if (filterTab === 'pending') return u.status === 'Pending';
                  if (filterTab === 'operator') return u.role === 'Operator';
                  if (filterTab === 'admin') return u.role === 'Administrator' || (u as any).role === 'Admin';
                  return true;
                })
                .map((user) => {
                const isRootAdmin = user.email === 'admin@protector.ai' && (user.role === 'Administrator' || (user as any).role === 'Admin');
                const isCurrent = currentUser?.id === user.id || currentUser?.email === user.email;
                const isPending = user.status === 'Pending';

                return (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s',
                      backgroundColor: isPending ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
                    }}
                  >
                    {/* Identity */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: isPending ? '1.5px solid #F59E0B' : '1px solid var(--border-charcoal)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: isPending ? '#D97706' : user.role === 'Administrator' || (user as any).role === 'Admin' ? 'var(--accent-citron)' : 'var(--text-primary)'
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

                    {/* Status Display */}
                    <td style={{ padding: '12px 14px' }}>
                      {isPending ? (
                        <span
                          className="status-pill"
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#D97706',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            fontWeight: 700,
                            fontSize: '10px'
                          }}
                        >
                          ⏳ PENDING APPROVAL
                        </span>
                      ) : (
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
                            ✓ {user.status}
                          </span>
                        </button>
                      )}
                    </td>

                    {/* Unique Security Token */}
                    <td style={{ padding: '12px 14px' }}>
                      {user.role === 'Operator' ? (
                        user.operator_auth_token ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0284C7',
                              backgroundColor: 'var(--bg-app)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              letterSpacing: '0.5px'
                            }}>
                              {user.operator_auth_token}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(user.operator_auth_token!);
                                showSuccess(`Copied unique token for ${user.name} (${user.operator_auth_token})`);
                              }}
                              className="btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              title="Copy Token"
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                            {isPending ? 'Pending Issuance' : 'OP-AUTH-2026 (Default)'}
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          Master Administrator
                        </span>
                      )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {isPending ? (
                            <button
                              type="button"
                              disabled={authorizingUserId === user.id}
                              onClick={() => handleAuthorizeUser(user)}
                              className="btn-citron"
                              style={{
                                fontSize: '11px',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              {authorizingUserId === user.id ? 'Authorizing...' : 'Authorize & Issue Token'}
                            </button>
                          ) : user.role === 'Operator' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRegenerateToken(user)}
                                className="btn-secondary"
                                style={{ fontSize: '10.5px', padding: '3px 8px' }}
                                title="Regenerate a brand new unique security passkey"
                              >
                                ↻ New Token
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeUser(user)}
                                style={{
                                  fontSize: '10.5px',
                                  padding: '3px 8px',
                                  color: '#EF4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Revoke authorization"
                              >
                                Revoke
                              </button>
                            </>
                          ) : null}

                          <button
                            onClick={() => setUserToDelete(user)}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
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
                        </div>
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
