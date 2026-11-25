import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Mail, KeyRound, Lock, CheckCircle2, Video, Cpu, Activity, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SpinningDevice3D } from './SpinningDevice3D';
import { OAuthModal } from './OAuthModal';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  // Navigation sub-views:
  // 'start': Full-screen Beginner Page ("Control Everything in One Place")
  // 'login': Full-screen Login Page ("Welcome to Protector AI login now!")
  // 'forgot_email' -> 'forgot_otp' -> 'forgot_reset': 3-step password reset
  const [subView, setSubView] = useState<'start' | 'login' | 'forgot_email' | 'forgot_otp' | 'forgot_reset'>('start');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Administrator' | 'Operator'>('Administrator');
  const [authToken, setAuthToken] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
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
    if (role === 'Operator' && !authToken.trim()) {
      setError('Administrator Authorization Token is required for Operator login. Enter the security key provided by Administrator (Mohd Sahil).');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        username_or_email: trimmedId,
        password,
        role,
        auth_token: authToken.trim()
      });

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP / Password Reset via Telegram & Backend
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    const email = forgotEmail.trim();
    if (!email) {
      setForgotErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      // Dispatch secure cryptographic OTP via Telegram & backend to registered recipient
      const res = await api.forgotPassword(email);
      if (res.success) {
        const targetEmail = res.email || email;
        setForgotSuccessMsg(res.message || `Verification code dispatched to your Telegram (@ProtectoAIbot) and ${targetEmail}.`);
        setSubView('forgot_otp');
      } else {
        setForgotErrorMsg(res.message || 'Could not send verification code.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'No registered account found with this email.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    const code = otpCode.trim();
    if (!code || code.length < 4) {
      setForgotErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp(forgotEmail.trim(), code);
      if (res.success) {
        if (res.reset_token) setResetToken(res.reset_token);
        setForgotSuccessMsg('Code verified! Enter your new password.');
        setSubView('forgot_reset');
      } else {
        setForgotErrorMsg(res.message || 'Incorrect verification code.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setForgotErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({
        email: forgotEmail.trim(),
        otp: otpCode.trim(),
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      if (res.success) {
        setForgotSuccessMsg('Password successfully reset! Please login with your new password.');
        setPassword(newPassword);
        setIdentifier(forgotEmail.trim());
        setTimeout(() => {
          setSubView('login');
          setForgotSuccessMsg(null);
        }, 1500);
      } else {
        setForgotErrorMsg(res.message || 'Failed to reset password.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-viewport">
      {/* =====================================================================
          1. FULL-PAGE BEGINNER SCREEN ("Control Everything in One Place")
         ===================================================================== */}
      {subView === 'start' && (
        <div className="auth-hero-full-container">
          {/* Left Hero Details */}
          <div className="auth-hero-full-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <img src="/logo.png" alt="ProtectoAI" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F5132', letterSpacing: '-0.02em' }}>
                ProtectoAI
              </span>
            </div>
            <h1 className="auth-hero-full-title">
              Control<br />Everything in<br />One Place.
            </h1>

            <p className="auth-hero-full-desc">
              Unified real-time industrial AI surveillance, automated PPE compliance verification, and deep-learning biometric workforce intelligence in one seamless console.
            </p>

            {/* Prominent Start Button */}
            <button
              type="button"
              onClick={() => setSubView('login')}
              className="auth-hero-full-btn"
            >
              <span>Start</span>
              <ArrowRight size={20} strokeWidth={2.4} />
            </button>
          </div>

          {/* Right 3D Spinning Surveillance Hardware Unit */}
          <div className="auth-hero-full-right">
            <SpinningDevice3D size={460} />
          </div>
        </div>
      )}

      {/* =====================================================================
          2. FULL-PAGE LOGIN SCREEN ("Welcome to Protector AI login now!")
         ===================================================================== */}
      {subView === 'login' && (
        <div className="auth-split-viewport">
          {/* Left Desktop Brand & 3D Hardware Display */}
          <div className="auth-split-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="ProtectoAI" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                ProtectoAI
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
              <SpinningDevice3D size={360} />
              <div style={{ textAlign: 'center', marginTop: '20px', maxWidth: '380px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Industrial Safety Intelligence
                </h3>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: '8px 0 0 0' }}>
                  Real-time automated surveillance protecting human workforce across high-hazard environments.
                </p>
              </div>
            </div>
          </div>

          {/* Right Full Form View */}
          <div className="auth-split-right">
            <div className="auth-form-card-wide">
              {/* Back to intro button */}
              <div style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setSubView('start')}
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
                  <span>Back to Intro</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <img src="/logo.png" alt="ProtectoAI" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F5132', letterSpacing: '-0.01em' }}>
                  ProtectoAI
                </span>
              </div>

              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.25 }}>
                Welcome to ProtectoAI<br />login now!
              </h2>

              <p style={{ fontSize: '13.5px', color: '#64748B', margin: '0 0 20px 0' }}>
                Enter your credentials to access your industrial operations console.
              </p>

              {/* Role Pill Selector */}
              <div className="auth-role-pill-group" style={{ marginBottom: '18px' }}>
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
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: error.toLowerCase().includes('pending') ? '#FFFBEB' : '#FEF2F2',
                  border: error.toLowerCase().includes('pending') ? '1px solid #FDE68A' : '1px solid #FEE2E2',
                  color: error.toLowerCase().includes('pending') ? '#B45309' : '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '18px',
                  lineHeight: 1.5
                }}>
                  {error}
                </div>
              )}

              {forgotSuccessMsg && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #DCFCE7',
                  color: '#16A34A',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '18px'
                }}>
                  {forgotSuccessMsg}
                </div>
              )}

              <form onSubmit={handleLoginSubmit}>
                {/* Email / Username */}
                <div className="smartnest-input-group">
                  <label className="smartnest-label">Email or Username</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email or username"
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
                      placeholder="Enter your password"
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

                {/* Administrator Authorization Token - Required for Operator Role */}
                {role === 'Operator' && (
                  <div className="smartnest-input-group" style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="smartnest-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <KeyRound size={14} color="#0284C7" />
                        <span>Unique Administrator Security Token</span>
                      </label>
                      <span style={{ fontSize: '10.5px', color: '#0284C7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Required
                      </span>
                    </div>
                    <input
                      type="text"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="e.g. OP-01-A7E91B"
                      className="smartnest-input"
                      style={{ fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 600, color: '#0F172A' }}
                      disabled={loading}
                    />
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 2px' }}>
                      Unique security passkey issued specifically to your account by Administrator Mohd Sahil.
                    </p>
                  </div>
                )}

                {/* Remember Me & Forgot Password Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '6px 0 20px 0',
                  fontSize: '13px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ accentColor: '#2563EB', width: '15px', height: '15px' }}
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotErrorMsg(null);
                      setForgotSuccessMsg(null);
                      setForgotEmail(identifier.includes('@') ? identifier : 'admin@protector.ai');
                      setSubView('forgot_email');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="smartnest-btn-primary"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              {/* Social Logins & Registration (Available for Operators only, strictly removed for Administrator) */}
              {role === 'Operator' && (
                <div style={{ marginTop: '26px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
                    Or Sign in with
                  </span>

                  <div className="smartnest-social-row">
                    <button
                      type="button"
                      title="Sign in with Google"
                      onClick={() => setOauthProvider('google')}
                      className="smartnest-social-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      title="Sign in with GitHub"
                      onClick={() => setOauthProvider('github')}
                      className="smartnest-social-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F172A">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    </button>
                  </div>

                  <div style={{ marginTop: '22px', fontSize: '13.5px', color: '#64748B' }}>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={onSwitchToRegister}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Create an Account?
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. FULL-PAGE FORGOT PASSWORD FLOW
         ===================================================================== */}
      {(subView === 'forgot_email' || subView === 'forgot_otp' || subView === 'forgot_reset') && (
        <div className="auth-split-viewport">
          <div className="auth-split-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="ProtectoAI" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                ProtectoAI
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
              <SpinningDevice3D size={360} />
              <div style={{ textAlign: 'center', marginTop: '20px', maxWidth: '380px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  Account Security Center
                </h3>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: '8px 0 0 0' }}>
                  Secure cryptographic OTP authentication for rapid account recovery.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12px' }}>
              <span>ZERO-TRUST CREDENTIAL RESET</span>
              <span>10-MIN OTP TIMEOUT</span>
            </div>
          </div>

          <div className="auth-split-right">
            <div className="auth-form-card-wide">
              <div style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setSubView('login')}
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

              {/* Step 1: Send OTP */}
              {subView === 'forgot_email' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                      <Mail size={26} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Reset Password
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748B', margin: '8px 0 0 0' }}>
                      Enter your registered email address to receive a 6-digit verification code.
                    </p>
                  </div>

                  {forgotErrorMsg && (
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                      {forgotErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleSendOtp}>
                    <div className="smartnest-input-group">
                      <label className="smartnest-label">Registered Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="sahilmohammad512@gmail.com"
                        className="smartnest-input"
                        disabled={loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="smartnest-btn-primary"
                    >
                      {loading ? 'Sending code...' : 'Send OTP Code'}
                    </button>
                  </form>
                </>
              )}

              {/* Step 2: Verify OTP */}
              {subView === 'forgot_otp' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                      <KeyRound size={26} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Enter Verification Code
                    </h2>
                    <p style={{ fontSize: '13.5px', color: '#64748B', margin: '8px 0 0 0' }}>
                      Sent to <strong>{forgotEmail}</strong>
                    </p>

                    <a
                      href="https://t.me/ProtectoAIbot"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '12px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        backgroundColor: '#229ED915',
                        border: '1px solid #229ED940',
                        color: '#229ED9',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      <span>📲 Check OTP on Telegram <strong>@ProtectoAIbot</strong></span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {forgotErrorMsg && (
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                      {forgotErrorMsg}
                    </div>
                  )}

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#166534',
                    fontSize: '13px',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🛡️ Confidential OTP Dispatched</span>
                    </div>
                    <span>Check your Telegram (<a href="https://t.me/ProtectoAIbot" target="_blank" rel="noopener noreferrer" style={{ color: '#15803D', fontWeight: 700, textDecoration: 'underline' }}>@ProtectoAIbot</a>) or registered email for your 6-digit code.</span>
                  </div>

                  <form onSubmit={handleVerifyOtp}>
                    <div className="smartnest-input-group">
                      <label className="smartnest-label">6-Digit OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="smartnest-input"
                        style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '6px', fontWeight: 800 }}
                        disabled={loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="smartnest-btn-primary"
                    >
                      {loading ? 'Verifying code...' : 'Verify OTP'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '18px' }}>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Step 3: Reset Password */}
              {subView === 'forgot_reset' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                      <Lock size={26} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Set New Password
                    </h2>
                    <p style={{ fontSize: '13.5px', color: '#64748B', margin: '8px 0 0 0' }}>
                      Enter and confirm your new secure password.
                    </p>
                  </div>

                  {forgotErrorMsg && (
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                      {forgotErrorMsg}
                    </div>
                  )}

                  {forgotSuccessMsg && (
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '13px', marginBottom: '16px' }}>
                      {forgotSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleResetPassword}>
                    <div className="smartnest-input-group">
                      <label className="smartnest-label">New Password</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="smartnest-input"
                        disabled={loading}
                      />
                    </div>

                    <div className="smartnest-input-group">
                      <label className="smartnest-label">Confirm Password</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="smartnest-input"
                        disabled={loading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="smartnest-btn-primary"
                    >
                      {loading ? 'Updating password...' : 'Reset Password'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Google and GitHub Interactive OAuth Modal */}
      <OAuthModal
        isOpen={oauthProvider !== null}
        provider={oauthProvider}
        onClose={() => setOauthProvider(null)}
        onSuccess={onLoginSuccess}
        defaultRole={role}
      />
    </div>
  );
};
