import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Play, CheckCircle2, ShieldCheck, Mail, KeyRound, Lock } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SpinningDevice3D } from './SpinningDevice3D';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  // Navigation sub-views:
  // 'start': Image 3 Screen 1 (Dark Beginner Page: "Control Everything in One Place")
  // 'login': Image 3 Screen 2 (White Login Card: "Welcome to Protector AI login now!")
  // 'forgot_email': Step 1 of Forgot Password
  // 'forgot_otp': Step 2 of Forgot Password (Match Email OTP)
  // 'forgot_reset': Step 3 of Forgot Password (Enter New Password & Confirm)
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
    <div className="smartnest-viewport">
      <div className="smartnest-phone-frame">
        {/* =====================================================================
            SCREEN 1: IMAGE 3 LEFT — BEGINNER / START SCREEN
           ===================================================================== */}
        {subView === 'start' && (
          <div className="smartnest-screen-dark">
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' }}>
                Protector AI
              </span>
              <h1 className="smartnest-hero-title">
                Control<br />Everything in<br />One Place
              </h1>
            </div>

            {/* Interactive 3D Spinning Smart Surveillance Hardware Device */}
            <div style={{
              width: '100%',
              height: '310px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <SpinningDevice3D size={290} />
            </div>

            {/* Single "Start" Button */}
            <button
              type="button"
              onClick={() => setSubView('login')}
              style={{
                width: '100%',
                padding: '16px 0',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '100px',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s ease',
                marginTop: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1D4ED8';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563EB';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>Start</span>
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* =====================================================================
            SCREEN 2: IMAGE 3 CENTER — LOGIN SCREEN
           ===================================================================== */}
        {subView === 'login' && (
          <div className="smartnest-screen-light">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setSubView('start')}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <ArrowLeft size={16} />
                <span>Intro</span>
              </button>
              <div className="smartnest-brand-header" style={{ margin: 0 }}>
                Protector AI
              </div>
              <div style={{ width: '40px' }} />
            </div>

            <div className="smartnest-card-container">
              <h2 className="smartnest-card-title">
                Welcome to<br />Protector AI login now!
              </h2>

              {/* Role Pill Selector */}
              <div className="auth-role-pill-group" style={{ marginBottom: '16px' }}>
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
                  fontSize: '12.5px',
                  fontWeight: 500,
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              {forgotSuccessMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #DCFCE7',
                  color: '#16A34A',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  marginBottom: '16px'
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

                {/* Remember Me & Forgot Password Row from Image 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '4px 0 16px 0',
                  fontSize: '12px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ accentColor: '#2563EB' }}
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
                      fontSize: '12px',
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

              {/* Or Sign in with */}
              <div style={{ marginTop: '22px', textAlign: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
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

                <div style={{ marginTop: '20px', fontSize: '13px', color: '#64748B' }}>
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
        )}

        {/* =====================================================================
            SCREEN 4: FORGOT PASSWORD WIZARD (EMAIL OTP -> VERIFY -> RESET)
           ===================================================================== */}
        {(subView === 'forgot_email' || subView === 'forgot_otp' || subView === 'forgot_reset') && (
          <div className="smartnest-screen-light">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setSubView('login')}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <ArrowLeft size={16} />
                <span>Back to Login</span>
              </button>
              <div className="smartnest-brand-header" style={{ margin: 0 }}>
                Protector AI
              </div>
              <div style={{ width: '40px' }} />
            </div>

            <div className="smartnest-card-container">
              {/* STEP 1: Enter Email */}
              {subView === 'forgot_email' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px'
                    }}>
                      <Mail size={22} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Reset Password
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0' }}>
                      Enter your email to receive a 6-digit OTP code.
                    </p>
                  </div>

                  {forgotErrorMsg && (
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', marginBottom: '14px' }}>
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

              {/* STEP 2: Enter & Match OTP */}
              {subView === 'forgot_otp' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px'
                    }}>
                      <KeyRound size={22} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Enter Verification Code
                    </h2>
                    <p style={{ fontSize: '12.5px', color: '#64748B', margin: '6px 0 0 0' }}>
                      Sent to <strong>{forgotEmail}</strong>
                    </p>
                  </div>

                  {otpPreview && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      backgroundColor: '#F0FDF4',
                      border: '1.5px dashed #22C55E',
                      color: '#15803D',
                      fontSize: '12.5px',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <span>Demo Email OTP Code: </span>
                      <strong style={{ fontSize: '16px', letterSpacing: '2px' }}>{otpPreview}</strong>
                    </div>
                  )}

                  {forgotErrorMsg && (
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', marginBottom: '14px' }}>
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
                        style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', fontWeight: 700 }}
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

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* STEP 3: Set New Password & Confirm */}
              {subView === 'forgot_reset' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px'
                    }}>
                      <Lock size={22} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Set New Password
                    </h2>
                    <p style={{ fontSize: '12.5px', color: '#64748B', margin: '6px 0 0 0' }}>
                      Enter your new password below.
                    </p>
                  </div>

                  {forgotErrorMsg && (
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', marginBottom: '14px' }}>
                      {forgotErrorMsg}
                    </div>
                  )}

                  {forgotSuccessMsg && (
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '12px', marginBottom: '14px' }}>
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
        )}
      </div>
    </div>
  );
};
