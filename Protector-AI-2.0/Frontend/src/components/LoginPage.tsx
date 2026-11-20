import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Mail, KeyRound, Lock, CheckCircle2, Video, Cpu, Activity } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SpinningDevice3D } from './SpinningDevice3D';

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
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [role, setRole] = useState<'Administrator' | 'Operator'>('Administrator');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);

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
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP to Email
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
      const res = await api.forgotPassword(email);
      if (res.success) {
        if (res.otp_preview) {
          setOtpPreview(res.otp_preview);
        }
        setForgotSuccessMsg(`Verification code sent to ${res.email}`);
        setSubView('forgot_otp');
      } else {
        setForgotErrorMsg(res.message || 'Could not send verification code.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'No account found with this email.');
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
            <div className="auth-hero-full-badge">
              <ShieldCheck size={16} />
              <span>PROTECTOR AI • SAFETY INTELLIGENCE</span>
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

            {/* Feature Highlights */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '13.5px' }}>
                <CheckCircle2 size={16} color="#34D399" />
                <span>YOLOv8 25 Hazard Classes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '13.5px' }}>
                <CheckCircle2 size={16} color="#34D399" />
                <span>Deep Biometric Attendance</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '13.5px' }}>
                <CheckCircle2 size={16} color="#34D399" />
                <span>Zero Latency Live Video</span>
              </div>
            </div>
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
                  Industrial Safety Intelligence
                </h3>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: '8px 0 0 0' }}>
                  Real-time automated surveillance protecting human workforce across high-hazard environments.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12px' }}>
              <span>PROPRIETARY BIOMETRIC ENCRYPTION</span>
              <span>v2.0 PRODUCTION</span>
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

              <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB', marginBottom: '8px' }}>
                Protector AI
              </div>

              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.25 }}>
                Welcome to Protector AI<br />login now!
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
                    placeholder="admin or admin@protector.ai"
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

              {/* Social Logins */}
              <div style={{ marginTop: '26px', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
                  Or Sign in with
                </span>

                <div className="smartnest-social-row">
                  <button
                    type="button"
                    title="Facebook Login"
                    onClick={() => {
                      setIdentifier('admin');
                      setPassword('Admin@123');
                    }}
                    className="smartnest-social-btn"
                  >
                    <span style={{ color: '#1877F2', fontWeight: 800 }}>f</span>
                  </button>

                  <button
                    type="button"
                    title="Google Enterprise Login"
                    onClick={() => {
                      setIdentifier('admin');
                      setPassword('Admin@123');
                    }}
                    className="smartnest-social-btn"
                  >
                    <span style={{ color: '#EA4335', fontWeight: 800 }}>G</span>
                  </button>

                  <button
                    type="button"
                    title="Apple Sign In"
                    onClick={() => {
                      setIdentifier('operator');
                      setPassword('operator123');
                    }}
                    className="smartnest-social-btn"
                  >
                    <span></span>
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
                        placeholder="admin@protector.ai"
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
                      <KeyRound size={26} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Enter Verification Code
                    </h2>
                    <p style={{ fontSize: '13.5px', color: '#64748B', margin: '8px 0 0 0' }}>
                      Sent to <strong>{forgotEmail}</strong>
                    </p>
                  </div>

                  {otpPreview && (
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '14px',
                      backgroundColor: '#F0FDF4',
                      border: '1.5px dashed #22C55E',
                      color: '#15803D',
                      fontSize: '13.5px',
                      marginBottom: '18px',
                      textAlign: 'center'
                    }}>
                      <span>Demo Email OTP Code: </span>
                      <strong style={{ fontSize: '18px', letterSpacing: '3px' }}>{otpPreview}</strong>
                    </div>
                  )}

                  {forgotErrorMsg && (
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                      {forgotErrorMsg}
                    </div>
                  )}

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
    </div>
  );
};
