import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Lock,
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import type { User, AuthUser } from '../types';
import { api } from '../services/api';

interface TeamAccessProps {
  users: User[];
  permissionMatrix?: Record<string, string[]>;
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
  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Administrator' | 'Operator'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Active' | 'Inactive'>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals & Async States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [authorizingUserId, setAuthorizingUserId] = useState<number | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [operatorToken, setOperatorToken] = useState('OP-AUTH-2026');

  // Copy Feedback State
  const [copiedMasterToken, setCopiedMasterToken] = useState(false);
  const [copiedTokenUserId, setCopiedTokenUserId] = useState<number | null>(null);

  // Success Toast
  const [successToast, setSuccessToast] = useState('');

  // Add Member Form
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

  // Auto-fetch Master Operator Token
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

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4500);
  };

  const handleCopyMasterToken = () => {
    navigator.clipboard.writeText(operatorToken);
    setCopiedMasterToken(true);
    showSuccess(`Copied Master Token (${operatorToken}) to clipboard.`);
    setTimeout(() => setCopiedMasterToken(false), 2000);
  };

  const handleCopyUserToken = (user: User, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenUserId(user.id);
    showSuccess(`Copied unique passkey for ${user.name} (${token})`);
    setTimeout(() => setCopiedTokenUserId(null), 2000);
  };

  const handleGenerateNewToken = async () => {
    setIsTokenLoading(true);
    try {
      const res = await api.createOperatorToken();
      if (res?.active_token) {
        setOperatorToken(res.active_token);
        showSuccess(`Generated brand new Master Security Token: ${res.active_token}`);
      }
    } catch (err: any) {
      alert(`Failed to generate token: ${err.message}`);
    } finally {
      setIsTokenLoading(false);
    }
  };

  const handleAuthorizeUser = async (user: User) => {
    setAuthorizingUserId(user.id);
    try {
      const res: any = await (api as any).authorizeUser(user.id);
      if (res?.success) {
        showSuccess(`Authorized operator ${user.name}! Unique Passkey: ${res?.token || 'Issued'}`);
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
      const res: any = await (api as any).regenerateUserToken(user.id);
      if (res?.success) {
        showSuccess(`Regenerated passkey for ${user.name}: ${res?.token}`);
        if (onRefreshTeam) onRefreshTeam();
      }
    } catch (err: any) {
      alert(`Failed to regenerate token: ${err.message}`);
    }
  };

  const handleRevokeUser = async (user: User) => {
    if (!confirm(`Revoke operator authorization and access token for ${user.name}? This operator will be blocked from logging in.`)) return;
    try {
      const res: any = await (api as any).revokeUserAuthorization(user.id);
      if (res?.success) {
        showSuccess(`Revoked authorization for ${user.name}. Status reverted to Pending.`);
        if (onRefreshTeam) onRefreshTeam();
      }
    } catch (err: any) {
      alert(`Failed to revoke operator: ${err.message}`);
    }
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

  // Filter Logic (Identical to Incidents)
  const filtered = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      ((u as any).operator_auth_token || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'All' ||
      (roleFilter === 'Administrator' && (u.role === 'Administrator' || (u as any).role === 'Admin')) ||
      (roleFilter === 'Operator' && u.role === 'Operator');

    const matchesStatus =
      statusFilter === 'All' ||
      String(u.status).toLowerCase() === statusFilter.toLowerCase();

    return matchesQ && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Metrics
  const pendingCount = users.filter((u) => String(u.status) === 'Pending').length;
  const activeOpsCount = users.filter((u) => u.role === 'Operator' && String(u.status) === 'Active').length;
  const adminCount = users.filter((u) => u.role === 'Administrator' || (u as any).role === 'Admin').length;
  const hasTestUsers = users.some(
    (u) => u.email.startsWith('worker_') || u.name.includes('Test Operator')
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
          {successToast}
        </div>
      )}

      {/* Top Header & Actions Card (Organized like Incidents) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0F172A',
              margin: 0,
              letterSpacing: '-0.02em'
            }}
          >
            Team Access & Authentication
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Manage authorized operators, enforce Administrator security tokens, and oversee team credentials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {hasTestUsers && (
            <button
              type="button"
              onClick={handleCleanupTestUsers}
              disabled={isPruning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '12px',
                color: '#B91C1C',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isPruning ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>{isPruning ? 'Pruning...' : 'Prune Test Operators'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onRefreshTeam) onRefreshTeam();
              showSuccess('Team roster refreshed.');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              backgroundColor: '#0F5132',
              border: 'none',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15, 81, 50, 0.25)'
            }}
          >
            <UserPlus size={15} />
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Total Personnel */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px 20px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              flexShrink: 0
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {users.length}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>
              Total Registered Accounts
            </div>
          </div>
        </div>

        {/* Card 2: Active Operators */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px 20px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#E0F2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284C7',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', lineHeight: 1.1 }}>
              {activeOpsCount}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>
              Active Authorized Operators
            </div>
          </div>
        </div>

        {/* Card 3: Pending Approval */}
        <div
          style={{
            backgroundColor: pendingCount > 0 ? '#FFFBEB' : '#FFFFFF',
            borderRadius: '20px',
            padding: '18px 20px',
            border: pendingCount > 0 ? '1.5px solid #FCD34D' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: pendingCount > 0 ? 'pointer' : 'default'
          }}
          onClick={() => {
            if (pendingCount > 0) {
              setStatusFilter('Pending');
              setCurrentPage(1);
            }
          }}
          title={pendingCount > 0 ? 'Click to filter pending operators' : ''}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: pendingCount > 0 ? '#FEF3C7' : '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pendingCount > 0 ? '#D97706' : '#94A3B8',
              flexShrink: 0
            }}
          >
            <AlertCircle size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: pendingCount > 0 ? '#D97706' : '#0F172A',
                lineHeight: 1.1
              }}
            >
              {pendingCount}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: pendingCount > 0 ? '#B45309' : '#64748B',
                marginTop: '2px'
              }}
            >
              {pendingCount > 0 ? 'Pending Admin Authorization' : 'All Operators Authorized'}
            </div>
          </div>
        </div>

        {/* Card 4: Master Security Passkey */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '16px 20px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
                flexShrink: 0
              }}
            >
              <Key size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Master Access Key
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#0F5132',
                  letterSpacing: '0.5px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {operatorToken}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleCopyMasterToken}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Copy Master Token"
            >
              {copiedMasterToken ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
              <span>{copiedMasterToken ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleGenerateNewToken}
              disabled={isTokenLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#F1F5F9',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isTokenLoading ? 'not-allowed' : 'pointer'
              }}
              title="Generate New Token"
            >
              <RefreshCw size={12} className={isTokenLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Card (Matching Incidents Style) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '16px 20px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#F8FAFC',
            padding: '8px 14px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            flex: 1,
            minWidth: '240px',
            maxWidth: '420px'
          }}
        >
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search member by name, username, email, token..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontSize: '13px',
              color: '#0F172A'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Role Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>ROLE:</span>
            {(['All', 'Administrator', 'Operator'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: roleFilter === r ? 700 : 500,
                  backgroundColor: roleFilter === r ? '#0F5132' : '#F1F5F9',
                  color: roleFilter === r ? '#FFFFFF' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {r === 'Administrator' ? 'Admins' : r === 'Operator' ? 'Operators' : 'All Roles'}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>STATUS:</span>
            {(['All', 'Pending', 'Active', 'Inactive'] as const).map((st) => {
              const count =
                st === 'Pending'
                  ? pendingCount
                  : st === 'Active'
                  ? users.filter((u) => String(u.status) === 'Active').length
                  : st === 'Inactive'
                  ? users.filter((u) => String(u.status) === 'Inactive').length
                  : users.length;

              const isSelected = statusFilter === st;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    backgroundColor: isSelected
                      ? st === 'Pending'
                        ? '#D97706'
                        : '#1E293B'
                      : st === 'Pending' && pendingCount > 0
                      ? '#FEF3C7'
                      : '#F1F5F9',
                    color: isSelected
                      ? '#FFFFFF'
                      : st === 'Pending' && pendingCount > 0
                      ? '#B45309'
                      : '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{st}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '100px',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                      fontWeight: 800
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Structured Clean Members Table Card (Matching Incidents Table) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                  MEMBER IDENTITY
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                  SECURITY ROLE
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                  ACCOUNT STATUS
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                  SECURITY PASSKEY
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
                  LAST ACTIVE
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 700, color: '#64748B', textAlign: 'right' }}>
                  ADMIN ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Users size={32} color="#CBD5E1" />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>No matching team members found</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search criteria or filter tags.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageUsers.map((user) => {
                  const isRootAdmin =
                    user.email === 'admin@protector.ai' &&
                    (user.role === 'Administrator' || (user as any).role === 'Admin');
                  const isPending = String(user.status) === 'Pending';
                  const isOperator = user.role === 'Operator';
                  const userPasskey = (user as any).operator_auth_token;
                  const initials = user.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U';

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isPending ? '#FFFBEB' : '#FFFFFF',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Member Identity */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              backgroundColor: isRootAdmin
                                ? '#0F5132'
                                : isOperator
                                ? '#E0F2FE'
                                : '#F1F5F9',
                              color: isRootAdmin
                                ? '#FFFFFF'
                                : isOperator
                                ? '#0284C7'
                                : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 800,
                              flexShrink: 0
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              {user.email}
                              {user.username && user.username !== user.email && (
                                <span style={{ marginLeft: '6px', color: '#94A3B8', fontFamily: 'monospace' }}>
                                  (@{user.username})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Security Role */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: isOperator ? '#F0F9FF' : '#F5F3FF',
                            color: isOperator ? '#0369A1' : '#6D28D9',
                            border: `1px solid ${isOperator ? '#BAE6FD' : '#DDD6FE'}`
                          }}
                        >
                          {isOperator ? <Shield size={12} /> : <Lock size={12} />}
                          <span>{user.role}</span>
                        </span>
                      </td>

                      {/* Account Status */}
                      <td style={{ padding: '14px 18px' }}>
                        {isPending ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FCD34D'
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: '#F59E0B'
                              }}
                            />
                            Pending Approval
                          </span>
                        ) : String(user.status) === 'Active' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                              border: '1px solid #86EFAC'
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: '#22C55E'
                              }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: '#F1F5F9',
                              color: '#64748B',
                              border: '1px solid #CBD5E1'
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Security Passkey */}
                      <td style={{ padding: '14px 18px' }}>
                        {isOperator ? (
                          userPasskey ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <code
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  color: '#0369A1',
                                  backgroundColor: '#F0F9FF',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #BAE6FD',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                {userPasskey}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyUserToken(user, userPasskey)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#0F172A',
                                  cursor: 'pointer',
                                  fontSize: '11px'
                                }}
                                title="Copy Passkey"
                              >
                                {copiedTokenUserId === user.id ? (
                                  <Check size={11} color="#16A34A" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: isPending ? '#D97706' : '#94A3B8', fontStyle: 'italic' }}>
                              {isPending ? 'Pending Issuance' : 'OP-AUTH-2026 (Default)'}
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>
                            Root Admin Access
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td style={{ padding: '14px 18px', fontSize: '12px', color: '#64748B' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} color="#94A3B8" />
                          <span>
                            {user.last_active
                              ? new Date(user.last_active).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Active today'}
                          </span>
                        </div>
                      </td>

                      {/* Admin Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {isRootAdmin ? (
                          <span style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>
                            Protected Master
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            {isPending ? (
                              <button
                                type="button"
                                disabled={authorizingUserId === user.id}
                                onClick={() => handleAuthorizeUser(user)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '6px 12px',
                                  backgroundColor: '#0F5132',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: authorizingUserId === user.id ? 'not-allowed' : 'pointer',
                                  boxShadow: '0 2px 6px rgba(15, 81, 50, 0.25)'
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>{authorizingUserId === user.id ? 'Authorizing...' : 'Authorize'}</span>
                              </button>
                            ) : isOperator ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRegenerateToken(user)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '5px 9px',
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#0F172A',
                                    cursor: 'pointer'
                                  }}
                                  title="Issue a new unique token"
                                >
                                  <RefreshCw size={11} />
                                  <span>Token</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeUser(user)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '5px 9px',
                                    backgroundColor: '#FEE2E2',
                                    border: '1px solid #FCA5A5',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#B91C1C',
                                    cursor: 'pointer'
                                  }}
                                  title="Revoke operator authorization"
                                >
                                  Revoke
                                </button>
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                color: '#EF4444',
                                cursor: 'pointer'
                              }}
                              title="Delete Member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Matching Incidents Pagination) */}
        {filtered.length > pageSize && (
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '12.5px', color: '#64748B' }}>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} members
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: currentPage === 1 ? '#94A3B8' : '#0F172A',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', padding: '0 6px' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: currentPage === totalPages ? '#F1F5F9' : '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: currentPage === totalPages ? '#94A3B8' : '#0F172A',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal (Apple HIG Style) */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px 28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Add Team Member
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Register an operator or administrator credential.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#B91C1C',
                  borderRadius: '10px',
                  fontSize: '12px',
                  marginBottom: '16px',
                  fontWeight: 600
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    FIRST NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      color: '#0F172A',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    LAST NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      color: '#0F172A',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                  USERNAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. operator_john"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                  WORK EMAIL *
                </label>
                <input
                  type="email"
                  required
                  placeholder="officer@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    color: '#0F172A',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    ROLE
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      color: '#0F172A',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Operator">Operator</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                    PHONE (OPTIONAL)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '9px 12px',
                      color: '#0F172A',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
                  INITIAL PASSWORD (DEFAULT: Protecto@2026)
                </label>
                <input
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 special"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    color: '#0F172A',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '10px',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#0F5132',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(15, 81, 50, 0.25)'
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px 28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', margin: 0, marginBottom: '8px' }}>
              Confirm Account Removal
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to permanently revoke credentials and remove{' '}
              <strong style={{ color: '#0F172A' }}>{userToDelete.name}</strong> ({userToDelete.email})?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '10px',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isDeleting ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
