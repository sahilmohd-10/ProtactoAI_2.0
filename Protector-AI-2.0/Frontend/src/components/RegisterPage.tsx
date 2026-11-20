import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

interface RegisterPageProps {
  onRegisterSuccess: (user: AuthUser) => void;
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'Administrator' | 'Operator'>('Operator');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateFrontend = (): boolean => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = 'First Name is required.';
    if (!lastName.trim()) errors.lastName = 'Last Name is required.';
    if (!username.trim() || username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else {
      if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters long.';
      } else if (!/[A-Z]/.test(password)) {
        errors.password = 'Must include at least 1 uppercase letter.';
      } else if (!/[a-z]/.test(password)) {
        errors.password = 'Must include at least 1 lowercase letter.';
      } else if (!/[0-9]/.test(password)) {
        errors.password = 'Must include at least 1 number.';
      }
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateFrontend()) {
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword
      });

      if (res.success && res.user) {
        onRegisterSuccess(res.user);
      } else {
        setGeneralError('Registration was unsuccessful. Please check your inputs.');
      }
    } catch (err: any) {
      const msg = err.message || 'An error occurred during account registration.';
      if (msg.includes('username') || msg.includes('taken')) {
        setFieldErrors(prev => ({ ...prev, username: 'Username already in use.' }));
      } else if (msg.includes('email')) {
        setFieldErrors(prev => ({ ...prev, email: 'Email address already registered.' }));
      } else {
        setGeneralError(msg);
      }
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
              <circle cx="120" cy="100" r="82" fill="#EFF6FF" />
              <path d="M190 140 C190 120 205 110 205 110 C205 110 208 126 195 140 Z" fill="#60A5FA" />
              <path d="M192 140 C192 125 180 115 180 115 C180 115 178 128 188 140 Z" fill="#93C5FD" />
              <rect x="184" y="138" width="14" height="20" rx="3" fill="#64748B" />
              <path d="M40 156 L205 156" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
              <path d="M68 95 L68 155" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <circle cx="104" cy="73" r="12" fill="#FBBF24" />
              <path d="M96 66 C98 60 112 60 114 66 C114 68 108 67 106 69 C102 69 98 68 96 66 Z" fill="#1E293B" />
              <path d="M92 90 C92 84 116 84 116 90 L120 125 L88 125 Z" fill="#1D4ED8" />
              <path d="M116 98 L138 120 L132 125 L112 104 Z" fill="#1E40AF" />
              <path d="M128 122 L158 122 L150 144 L122 144 Z" fill="#334155" />
              <rect x="110" y="112" width="9" height="12" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
              <path d="M90 125 L120 125 L144 175 L132 175 L110 135 L96 175 L84 175 Z" fill="#0F172A" />
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
              onClick={onSwitchToLogin}
              className="auth-hero-btn-register"
            >
              Login
            </button>
            <button
              type="button"
              className="auth-hero-btn-login"
            >
              Register
            </button>
          </div>
        </aside>

        {/* Center / Right Form Card (Image 1 Right Card: Create Account) */}
        <main className="auth-main-card">
          <h1 className="auth-card-main-title">Create Account</h1>
          <p className="auth-card-main-subtitle">
            Create an account so you can explore all<br />the safety features
          </p>

          {/* Role Pill Selector */}
          <div className="auth-role-pill-group">
            <button
              type="button"
              onClick={() => setRole('Operator')}
              className={`auth-role-pill ${role === 'Operator' ? 'active' : ''}`}
            >
              Operator
            </button>
            <button
              type="button"
              onClick={() => setRole('Administrator')}
              className={`auth-role-pill ${role === 'Administrator' ? 'active' : ''}`}
            >
              Administrator
            </button>
          </div>

          {generalError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FEE2E2',
              color: '#DC2626',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '14px'
            }}>
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* First & Last Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="auth-field-modern">
                <input
                  id="reg-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="auth-input-modern"
                  disabled={loading}
                />
                {fieldErrors.firstName && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>{fieldErrors.firstName}</span>}
              </div>
              <div className="auth-field-modern">
                <input
                  id="reg-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="auth-input-modern"
                  disabled={loading}
                />
                {fieldErrors.lastName && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>{fieldErrors.lastName}</span>}
              </div>
            </div>

            {/* Username & Email */}
            <div className="auth-field-modern">
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="auth-input-modern"
                disabled={loading}
              />
              {fieldErrors.username && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>{fieldErrors.username}</span>}
            </div>

            <div className="auth-field-modern">
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="auth-input-modern"
                disabled={loading}
              />
              {fieldErrors.email && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>{fieldErrors.email}</span>}
            </div>

            {/* Password */}
            <div className="auth-field-modern" style={{ position: 'relative' }}>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="auth-input-modern"
                style={{ paddingRight: '44px' }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
            {fieldErrors.password && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '-10px', marginBottom: '8px', display: 'block' }}>{fieldErrors.password}</span>}

            {/* Confirm Password */}
            <div className="auth-field-modern" style={{ position: 'relative' }}>
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="auth-input-modern"
                style={{ paddingRight: '44px' }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && <span style={{ color: '#DC2626', fontSize: '11px', marginTop: '-10px', marginBottom: '8px', display: 'block' }}>{fieldErrors.confirmPassword}</span>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="auth-btn-primary-modern"
            >
              {loading ? (
                <>
                  <div className="spinner-icon" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Sign up</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Already have an account link */}
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="auth-switch-link-modern"
              >
                Already have an account
              </button>
            </div>
          </form>

          {/* Social / SSO Section */}
          <div style={{ marginTop: '22px', textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '14px'
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
                title="Sign in with Google"
                onClick={onSwitchToLogin}
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
                  color: '#1E293B'
                }}
              >
                G
              </button>
              <button
                type="button"
                title="Sign in with Apple"
                onClick={onSwitchToLogin}
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
                  color: '#1E293B'
                }}
              >
                
              </button>
              <button
                type="button"
                title="Enterprise SSO"
                onClick={onSwitchToLogin}
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
                  color: '#1E293B'
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
