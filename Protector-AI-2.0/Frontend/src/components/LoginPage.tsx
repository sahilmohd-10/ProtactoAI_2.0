import React, { useState } from 'react';
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
    <div className="auth-viewport">
      {/* Precision ambient background glow */}
      <div className="auth-ambient-glow" />

      <div className="auth-card-container">
        {/* Brand header */}
        <div className="auth-brand-header">
          <div className="auth-brand-badge">
            <span className="auth-brand-badge-dot" />
            <span>Industrial Safety Platform 2.0</span>
          </div>
          <h1 className="auth-title">
            Protector AI
          </h1>
          <p className="auth-subtitle">
            Autonomous Safety Operations &amp; PPE Vision Control
          </p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Authenticate Access</h2>
            <p className="auth-card-desc">Select your designated operational role to proceed.</p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--safety-violation)', marginTop: '4px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Role selector segmented control */}
            <div className="auth-field">
              <label className="auth-label">
                Operational Role
              </label>
              <div className="auth-role-selector">
                <button
                  type="button"
                  onClick={() => setRole('Administrator')}
                  className={`auth-role-btn ${role === 'Administrator' ? 'active' : ''}`}
                >
                  Administrator
                </button>
                <button
                  type="button"
                  onClick={() => setRole('Operator')}
                  className={`auth-role-btn ${role === 'Operator' ? 'active' : ''}`}
                >
                  Operator
                </button>
              </div>
            </div>

            {/* Username or Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-identifier">
                Username or Email
              </label>
              <input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin or alex.vance@protector.ai"
                autoComplete="username"
                className="auth-input"
                disabled={loading}
              />
            </div>

            {/* Password with Show/Hide toggle */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  autoComplete="current-password"
                  className="auth-input"
                  style={{ paddingRight: '40px' }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="auth-eye-btn"
                >
                  {showPassword ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <>
                  <div className="spinner-icon" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Log In as {role}</span>
              )}
            </button>
          </form>


          {/* Switch to Register */}
          <div className="auth-switch-text">
            Don't have an operator account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="auth-link"
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="auth-footer-note">
          Argon2id Encrypted &middot; Backend RBAC Enforcement &middot; v2.0
        </div>
      </div>
    </div>
  );
};
