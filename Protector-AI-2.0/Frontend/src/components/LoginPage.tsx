import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
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
        {/* Left Hero / Teaser Card (Image 1 Left Card) */}
        <aside className="auth-hero-card">
          <div className="auth-hero-illustration">
            <svg viewBox="0 0 240 200" fill="none" style={{ width: '100%', height: '100%' }}>
              {/* Soft desk background */}
              <circle cx="120" cy="100" r="82" fill="#EFF6FF" />
              {/* Plant on desk */}
              <path d="M190 140 C190 120 205 110 205 110 C205 110 208 126 195 140 Z" fill="#60A5FA" />
              <path d="M192 140 C192 125 180 115 180 115 C180 115 178 128 188 140 Z" fill="#93C5FD" />
              <rect x="184" y="138" width="14" height="20" rx="3" fill="#64748B" />
              {/* Desk surface */}
              <path d="M40 156 L205 156" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              {/* Person seated */}
              {/* Chair back */}
              <path d="M68 95 L68 155" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <path d="M60 115 L68 115" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              {/* Head & Hair */}
              <circle cx="105" cy="74" r="14" fill="#F87171" opacity="0.3" />
              <circle cx="104" cy="73" r="12" fill="#FBBF24" />
              <path d="M96 66 C98 60 112 60 114 66 C114 68 108 67 106 69 C102 69 98 68 96 66 Z" fill="#1E293B" />
              {/* Body / Blue Shirt */}
              <path d="M92 90 C92 84 116 84 116 90 L120 125 L88 125 Z" fill="#1D4ED8" />
              {/* Arms & Laptop */}
              <path d="M116 98 L138 120 L132 125 L112 104 Z" fill="#1E40AF" />
              {/* Laptop */}
              <path d="M128 122 L158 122 L150 144 L122 144 Z" fill="#334155" />
              <path d="M138 102 L164 122 L158 125 L132 105 Z" fill="#0F172A" />
              {/* Screen logo mark */}
              <circle cx="148" cy="113" r="2.5" fill="#60A5FA" />
              {/* Coffee mug */}
              <rect x="110" y="112" width="9" height="12" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
              <path d="M119 115 C122 115 122 119 119 119" stroke="#94A3B8" strokeWidth="1.5" fill="none" />
              {/* Pants / Legs */}
              <path d="M90 125 L120 125 L144 175 L132 175 L110 135 L96 175 L84 175 Z" fill="#0F172A" />
              {/* Shoes */}
              <path d="M132 175 L148 175 C150 175 152 178 150 180 L132 180 Z" fill="#1E293B" />
              <path d="M84 175 L100 175 C102 175 104 178 102 180 L84 180 Z" fill="#1E293B" />
            </svg>
          </div>

          <h2 className="auth-hero-title">
            Discover Your<br />Safety Workspace here
          </h2>
          <p className="auth-hero-desc">
            Explore all industrial safety capabilities, automated PPE compliance, and unified workforce intelligence.
          </p>

          <div className="auth-hero-buttons">
            <button
              type="button"
              className="auth-hero-btn-login"
            >
              Login
            </button>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="auth-hero-btn-register"
            >
              Register
            </button>
          </div>
        </aside>

        {/* Center / Right Form Card (Image 1 Center Card) */}
        <main className="auth-main-card">
          <h1 className="auth-card-main-title">Login here</h1>
          <p className="auth-card-main-subtitle">
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
            {/* Email / Username Input */}
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
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
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
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
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
              {/* Google Button */}
              <button
                type="button"
                title="Sign in with Google Enterprise SSO"
                onClick={() => {
                  setIdentifier('admin');
                  setPassword('admin123');
                }}
                style={{
                  width: '52px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#ECEFF1',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#1E293B',
                  transition: 'background-color 0.15s ease'
                }}
              >
                G
              </button>

              {/* Apple Button */}
              <button
                type="button"
                title="Sign in with Apple ID"
                onClick={() => {
                  setIdentifier('operator');
                  setPassword('operator123');
                }}
                style={{
                  width: '52px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#ECEFF1',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: '#1E293B',
                  transition: 'background-color 0.15s ease'
                }}
              >
                
              </button>

              {/* Enterprise SSO Button */}
              <button
                type="button"
                title="Single Sign-On (SAML / OIDC)"
                onClick={() => {
                  setIdentifier('admin');
                  setPassword('admin123');
                }}
                style={{
                  width: '52px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#ECEFF1',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#1E293B',
                  transition: 'background-color 0.15s ease'
                }}
              >
                SSO
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
