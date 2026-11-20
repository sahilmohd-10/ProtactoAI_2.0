import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
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
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-citron)',
            marginBottom: '4px'
          }}>
            <ShieldCheck size={22} />
          </div>
          <h1 className="auth-title">
            Protector AI
          </h1>
          <p className="auth-subtitle">
            Industrial Safety Operations &amp; PPE Monitoring
          </p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Sign in</h2>
            <p className="auth-card-desc">Enter your credentials to access the safety workspace.</p>
          </div>

          {error && (
            <div className="auth-error-banner" role="alert">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Role selector segmented control */}
            <div className="auth-field">
              <label className="auth-label">
                Account Role
              </label>
              <div className="auth-role-selector" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'Administrator'}
                  onClick={() => setRole('Administrator')}
                  className={`auth-role-btn ${role === 'Administrator' ? 'active' : ''}`}
                >
                  Administrator
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'Operator'}
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
                placeholder="name@company.com or username"
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
                  placeholder="••••••••"
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in as {role}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Switch to Register */}
          <div className="auth-switch-text">
            Don't have an operator account?
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="auth-link"
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
