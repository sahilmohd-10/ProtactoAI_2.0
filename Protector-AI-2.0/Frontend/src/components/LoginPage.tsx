import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  // Step 1: Page 1 (Discover / Welcome Card) -> Step 2: Page 2 (Login Form Card)
  const [currentPage, setCurrentPage] = useState<'welcome' | 'login'>('welcome');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Administrator' | 'Operator'>('Administrator');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        username_or_email: trimmedId,
        password,
        role
      });

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-blue-viewport">
      {/* Background 3D organic ambient glows */}
      <div className="auth-bg-decor-circle auth-bg-shape-1" />
      <div className="auth-bg-decor-circle auth-bg-shape-2" />

      <div className="auth-modern-layout">
        {/* =====================================================================
            PAGE 1: DISCOVER YOUR SAFETY WORKSPACE (EXACT MATCH TO USER IMAGE 1)
           ===================================================================== */}
        {currentPage === 'welcome' && (
          <aside className="auth-single-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            {/* SVG Illustration: Worker with yellow safety hardhat walking with laptop */}
            <div style={{ width: '230px', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <svg viewBox="0 0 240 200" fill="none" style={{ width: '100%', height: '100%' }}>
                {/* Background circle */}
                <circle cx="120" cy="100" r="76" fill="#EFF6FF" />

                {/* Door frame on left */}
                <path d="M78 48 L78 152" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
                <path d="M60 100 L78 100" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />

                {/* Floor line */}
                <path d="M42 152 L198 152" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />

                {/* Plant on right */}
                <rect x="176" y="132" width="16" height="20" rx="3" fill="#64748B" />
                <path d="M184 132 C184 112 170 102 170 102 C170 102 186 112 184 132 Z" fill="#60A5FA" />
                <path d="M184 132 C184 116 198 108 198 108 C198 108 186 118 184 132 Z" fill="#93C5FD" />

                {/* Walking Worker */}
                {/* Yellow Hardhat */}
                <circle cx="125" cy="54" r="16" fill="#FACC15" />
                <path d="M110 57 C112 45 138 45 140 57 Z" fill="#EAB308" />
                <path d="M108 57 L142 57" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />

                {/* Blue Safety Jacket / Uniform */}
                <path d="M112 70 C112 66 138 66 138 70 L144 114 L106 114 Z" fill="#1D4ED8" />

                {/* White ID Card on Chest */}
                <rect x="126" y="78" width="10" height="13" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1" />
                <circle cx="131" cy="82" r="1.5" fill="#3B82F6" />

                {/* Arms and Laptop Case */}
                <path d="M112 76 L98 94 L104 98 L116 82 Z" fill="#1E40AF" />
                <path d="M136 76 L152 98 L146 102 L132 82 Z" fill="#1E40AF" />

                {/* Black Briefcase / Laptop Bag */}
                <g transform="rotate(-15 152 105)">
                  <rect x="144" y="96" width="30" height="22" rx="4" fill="#1E293B" />
                  <path d="M152 96 L152 91 C152 89 166 89 166 91 L166 96" stroke="#475569" strokeWidth="2" fill="none" />
                  <circle cx="159" cy="107" r="2.5" fill="#60A5FA" />
                </g>

                {/* Dark Navy Trousers - Walking Stride */}
                {/* Left Leg Forward */}
                <path d="M112 114 L102 162 L120 162 L124 114 Z" fill="#0F172A" />
                {/* Right Leg Back */}
                <path d="M132 114 L150 162 L134 162 L122 114 Z" fill="#0F172A" />

                {/* Shoes */}
                <path d="M98 162 L122 162 C124 162 125 165 123 167 L98 167 Z" fill="#1E293B" />
                <path d="M130 162 L154 162 C156 162 157 165 155 167 L130 167 Z" fill="#1E293B" />
              </svg>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#1E3A8A',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              margin: '0 0 14px 0'
            }}>
              Discover Your<br />Safety Workspace here
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              lineHeight: 1.55,
              margin: '0 0 32px 0',
              maxWidth: '320px'
            }}>
              Explore all industrial safety capabilities, automated PPE compliance, and unified workforce intelligence.
            </p>

            {/* Dual Action Buttons */}
            <div style={{ display: 'flex', width: '100%', gap: '14px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage('login')}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  backgroundColor: '#1D4ED8',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '15px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(29, 78, 216, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                Login
              </button>

              <button
                type="button"
                onClick={onSwitchToRegister}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 700,
                  fontSize: '15px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Register
              </button>
            </div>
          </aside>
        )}

        {/* =====================================================================
            PAGE 2: LOGIN HERE FORM CARD (EXACT MATCH TO USER IMAGE 2)
           ===================================================================== */}
        {currentPage === 'login' && (
          <main className="auth-single-card">
            {/* Top Back Navigation Button */}
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage('welcome')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 0'
                }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            </div>

            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#1E3A8A',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0'
            }}>
              Login here
            </h1>

            <p style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1E293B',
              margin: '0 0 22px 0',
              lineHeight: 1.4
            }}>
              Welcome back you've<br />been missed!
            </p>

            {/* Role Pill Selector */}
            <div className="auth-role-pill-group">
              <button
                type="button"
                onClick={() => setRole('Administrator')}
                className={`auth-role-pill ${role === 'Administrator' ? 'active' : ''}`}
              >
                Administrator
              </button>
              <button
                type="button"
                onClick={() => setRole('Operator')}
                className={`auth-role-pill ${role === 'Operator' ? 'active' : ''}`}
              >
                Operator
              </button>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FEE2E2',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email or Username Input */}
              <div className="auth-field-modern">
                <input
                  id="login-id"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or Username"
                  autoComplete="username"
                  className="auth-input-modern"
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="auth-field-modern" style={{ position: 'relative' }}>
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="auth-input-modern"
                  style={{ paddingRight: '44px' }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Forgot password link */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => alert('Password reset: Please contact your site System Administrator.')}
                  className="auth-forgot-link"
                >
                  Forgot your password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="auth-btn-primary-modern"
              >
                {loading ? (
                  <>
                    <div className="spinner-icon" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Create new account link */}
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="auth-switch-link-modern"
                >
                  Create new account
                </button>
              </div>
            </form>

            {/* Social / SSO Section */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1D4ED8' }}>
                  Or continue with
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  title="Sign in with Google Enterprise SSO"
                  onClick={() => {
                    setIdentifier('admin');
                    setPassword('admin123');
                  }}
                  style={{
                    width: '54px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: '#ECEFF1',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#1E293B'
                  }}
                >
                  G
                </button>

                <button
                  type="button"
                  title="Sign in with Apple ID"
                  onClick={() => {
                    setIdentifier('operator');
                    setPassword('operator123');
                  }}
                  style={{
                    width: '54px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: '#ECEFF1',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '17px',
                    color: '#1E293B'
                  }}
                >
                  
                </button>

                <button
                  type="button"
                  title="Single Sign-On (SAML / OIDC)"
                  onClick={() => {
                    setIdentifier('admin');
                    setPassword('admin123');
                  }}
                  style={{
                    width: '54px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: '#ECEFF1',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#1E293B'
                  }}
                >
                  SSO
                </button>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};
