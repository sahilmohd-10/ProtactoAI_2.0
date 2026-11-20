import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

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
    <div className="smartnest-viewport">
      <div className="smartnest-phone-frame">
        <div className="smartnest-screen-light">
          {/* Top header with back button and brand from Image 3 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div className="smartnest-brand-header" style={{ margin: 0 }}>
              Protector AI
            </div>
            <div style={{ width: '32px' }} />
          </div>

          <div className="smartnest-card-container">
            <h2 className="smartnest-card-title">
              Create an Account?
            </h2>

            {/* Role Pill Selector */}
            <div className="auth-role-pill-group" style={{ marginBottom: '16px' }}>
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
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FEE2E2',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 500,
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="smartnest-input-group">
                <label className="smartnest-label">Name</label>
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
                <label className="smartnest-label">Email</label>
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

              {/* Agree to Terms Checkbox from Image 3 */}
              <div style={{ margin: '8px 0 16px 0', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{ accentColor: '#2563EB' }}
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

            {/* Social Row */}
            <div style={{ marginTop: '22px', textAlign: 'center' }}>
              <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
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

              <div style={{ marginTop: '20px', fontSize: '13px', color: '#64748B' }}>
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
