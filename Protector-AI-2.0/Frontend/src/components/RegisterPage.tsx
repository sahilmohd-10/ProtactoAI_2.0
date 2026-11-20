import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SpinningDevice3D } from './SpinningDevice3D';

interface RegisterPageProps {
  onRegisterSuccess: (user: AuthUser) => void;
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [role, setRole] = useState<'Administrator' | 'Operator'>('Operator');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service.');
      return;
    }

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Personnel';
    const generatedUsername = trimmedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.floor(Math.random() * 900 + 100);

    setLoading(true);
    try {
      const res = await api.register({
        first_name: firstName,
        last_name: lastName,
        username: generatedUsername,
        email: trimmedEmail,
        password: password,
        confirm_password: password
      });

      if (res.success && res.user) {
        onRegisterSuccess(res.user);
      } else {
        setError('Registration failed. Please check your information.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-viewport">
      <div className="auth-split-viewport">
        {/* Left Side 3D Showcase */}
        <div className="auth-split-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              color: '#60A5FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
              Protector AI
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
            <SpinningDevice3D size={360} />
            <div style={{ textAlign: 'center', marginTop: '20px', maxWidth: '380px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Join the Safety Workspace
              </h3>
              <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: '8px 0 0 0' }}>
                Instant deployment for site personnel, computer vision monitoring, and automated attendance registers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12px' }}>
            <span>SECURE ONBOARDING</span>
            <span>ENTERPRISE READY</span>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div className="auth-split-right">
          <div className="auth-form-card-wide">
            {/* Back button */}
            <div style={{ marginBottom: '18px' }}>
              <button
                type="button"
                onClick={onSwitchToLogin}
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
                  padding: 0
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Login</span>
              </button>
            </div>

            <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB', marginBottom: '8px' }}>
              Protector AI
            </div>

            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.25 }}>
              Create an Account?
            </h2>

            <p style={{ fontSize: '13.5px', color: '#64748B', margin: '0 0 20px 0' }}>
              Register your profile to participate in automated safety surveillance.
            </p>

            {/* Role Pill Selector */}
            <div className="auth-role-pill-group" style={{ marginBottom: '18px' }}>
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

            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FEE2E2',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '18px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="smartnest-input-group">
                <label className="smartnest-label">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Johan orindo"
                  className="smartnest-input"
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div className="smartnest-input-group">
                <label className="smartnest-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joedoe75@gmail.com"
                  className="smartnest-input"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="smartnest-input-group" style={{ position: 'relative' }}>
                <label className="smartnest-label">Password</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="smartnest-input"
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
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div style={{ margin: '8px 0 20px 0', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{ accentColor: '#2563EB', width: '15px', height: '15px' }}
                  />
                  <span>
                    I agree to the <strong style={{ color: '#2563EB' }}>Terms of Service</strong>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="smartnest-btn-primary"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            {/* Social Logins */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
                Or Sign in with
              </span>

              <div className="smartnest-social-row">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="smartnest-social-btn"
                >
                  <span style={{ color: '#1877F2', fontWeight: 800 }}>f</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="smartnest-social-btn"
                >
                  <span style={{ color: '#EA4335', fontWeight: 800 }}>G</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="smartnest-social-btn"
                >
                  <span></span>
                </button>
              </div>

              <div style={{ marginTop: '22px', fontSize: '13.5px', color: '#64748B' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
