import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        errors.password = 'Password must include at least one uppercase letter.';
      } else if (!/[a-z]/.test(password)) {
        errors.password = 'Password must include at least one lowercase letter.';
      } else if (!/[0-9]/.test(password)) {
        errors.password = 'Password must include at least one digit.';
      } else if (!/[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/]/.test(password)) {
        errors.password = 'Password must include at least one special character.';
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
    setSuccessMessage(null);

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
        setSuccessMessage('Operator account registered successfully! Initializing workspace...');
        setTimeout(() => {
          onRegisterSuccess(res.user);
        }, 800);
      } else {
        setGeneralError('Registration was unsuccessful. Please check your inputs.');
      }
    } catch (err: any) {
      const msg = err.message || 'An error occurred during account registration.';
      if (msg.includes('username') || msg.includes('taken')) {
        setFieldErrors(prev => ({ ...prev, username: 'This username is already taken. Please choose another username.' }));
      } else if (msg.includes('email')) {
        setFieldErrors(prev => ({ ...prev, email: 'An account with this email address already exists.' }));
      } else {
        setGeneralError(msg);
      }
      setPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-viewport">
      <div className="auth-card-container-wide">
        {/* Brand header */}
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
            Create Operator Account
          </h1>
          <p className="auth-subtitle">
            Register authorized credentials for safety surveillance and incident monitoring.
          </p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Account details</h2>
            <p className="auth-card-desc">Enter your user information to create a new operator login.</p>
          </div>

          {generalError && (
            <div className="auth-error-banner" role="alert">
              <span>{generalError}</span>
            </div>
          )}

          {successMessage && (
            <div className="auth-success-banner" role="status">
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Name Fields: First & Last */}
            <div className="form-grid-2">
              <div className="auth-field">
                <label className="auth-label" htmlFor="reg-firstname">
                  First Name
                </label>
                <input
                  id="reg-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (fieldErrors.firstName) setFieldErrors(prev => ({ ...prev, firstName: '' }));
                  }}
                  placeholder="Jane"
                  className={`auth-input ${fieldErrors.firstName ? 'auth-input-error' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.firstName && (
                  <p className="auth-field-error">{fieldErrors.firstName}</p>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="reg-lastname">
                  Last Name
                </label>
                <input
                  id="reg-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (fieldErrors.lastName) setFieldErrors(prev => ({ ...prev, lastName: '' }));
                  }}
                  placeholder="Doe"
                  className={`auth-input ${fieldErrors.lastName ? 'auth-input-error' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.lastName && (
                  <p className="auth-field-error">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Username & Email Grid */}
            <div className="form-grid-2">
              <div className="auth-field">
                <label className="auth-label" htmlFor="reg-username">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) setFieldErrors(prev => ({ ...prev, username: '' }));
                  }}
                  placeholder="jdoe_safety"
                  autoComplete="username"
                  className={`auth-input ${fieldErrors.username ? 'auth-input-error' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.username && (
                  <p className="auth-field-error">{fieldErrors.username}</p>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="reg-email">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  placeholder="jane.doe@company.com"
                  autoComplete="email"
                  className={`auth-input ${fieldErrors.email ? 'auth-input-error' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.email && (
                  <p className="auth-field-error">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className={`auth-input ${fieldErrors.password ? 'auth-input-error' : ''}`}
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
              {fieldErrors.password && (
                <p className="auth-field-error">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-confirm-password">
                Confirm Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={`auth-input ${fieldErrors.confirmPassword ? 'auth-input-error' : ''}`}
                  style={{ paddingRight: '40px' }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="auth-eye-btn"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="auth-field-error">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <>
                  <div className="spinner-icon" />
                  <span>Registering Account...</span>
                </>
              ) : (
                <>
                  <span>Create Operator Account</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Return to Login */}
          <div className="auth-switch-text">
            Already have an authorized account?
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="auth-link"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
