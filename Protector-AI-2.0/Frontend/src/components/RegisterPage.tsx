import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Clock, CheckCircle2, X, FileText, Check } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SpinningDevice3D } from './SpinningDevice3D';
import { OAuthModal } from './OAuthModal';
import { registerWithFirebase, loginWithGooglePopup } from '../services/firebase';

interface RegisterPageProps {
  onRegisterSuccess: (user: AuthUser) => void;
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [role] = useState<'Operator'>('Operator');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredPending, setRegisteredPending] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);

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
      setError('You must review and agree to the Terms of Service to create an account.');
      setShowTermsModal(true);
      return;
    }

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Personnel';
    const generatedUsername = trimmedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.floor(Math.random() * 900 + 100);

    setLoading(true);
    try {
      // 1. Register with Firebase Authentication and dispatch email verification
      try {
        await registerWithFirebase(trimmedEmail, password, trimmedName);
      } catch (fbErr: any) {
        console.warn('Firebase registration notice:', fbErr?.message || fbErr);
      }

      // 2. Register with backend database
      const res = await api.register({
        first_name: firstName,
        last_name: lastName,
        username: generatedUsername,
        email: trimmedEmail,
        password: password,
        confirm_password: password
      });

      if (res.success && res.user) {
        if ((res.user.status as string) === 'Pending' || res.pending_approval) {
          setRegisteredPending(true);
        } else {
          onRegisterSuccess(res.user);
        }
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src="/logo.png" alt="ProtectoAI" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F5132', letterSpacing: '-0.01em' }}>
                ProtectoAI
              </span>
            </div>

            {registeredPending ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <Clock size={32} />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
                  Account Created!
                </h2>
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#FFFBEB',
                  border: '1.5px solid #FDE68A',
                  color: '#92400E',
                  fontSize: '13.5px',
                  margin: '18px 0',
                  textAlign: 'left',
                  lineHeight: 1.5
                }}>
                  <strong style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                    ⏳ Status: Pending Administrator Authorization
                  </strong>
                  Your Operator account has been registered. For industrial workspace security, an Administrator (<strong>Mohd Sahil</strong>) must verify your account and issue your <strong>Unique Security Token</strong> before you can log in.
                </div>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="smartnest-btn-primary"
                  style={{ width: '100%', marginTop: '10px' }}
                >
                  Proceed to Login
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.25 }}>
                  Create an Account?
                </h2>

                <p style={{ fontSize: '13.5px', color: '#64748B', margin: '0 0 20px 0' }}>
                  Register your profile to participate in automated safety surveillance.
                </p>

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

                  {/* Terms Checkbox & All-Condition Window Trigger */}
                  <div style={{ margin: '10px 0 20px 0', fontSize: '13px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', userSelect: 'none' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!agreeTerms) {
                            setShowTermsModal(true);
                          } else {
                            setAgreeTerms(false);
                          }
                        }}
                        aria-checked={agreeTerms}
                        role="checkbox"
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: agreeTerms ? 'none' : '2px solid #CBD5E1',
                          backgroundColor: agreeTerms ? '#2563EB' : '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                          boxShadow: agreeTerms ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none'
                        }}
                      >
                        {agreeTerms && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
                      </button>

                      <span style={{ color: '#64748B' }}>
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={() => setShowTermsModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563EB',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '13px',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          Terms of Service
                        </button>
                      </span>
                    </div>
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
                      title="Sign up with Google"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          setError(null);
                          const { idToken } = await loginWithGooglePopup();
                          const res = await api.firebaseLogin(idToken, 'Operator');
                          if (res.success && res.user) {
                            onRegisterSuccess(res.user);
                          } else if (res.pending_approval) {
                            setRegisteredPending(true);
                          } else {
                            setOauthProvider('google');
                          }
                        } catch (gErr: any) {
                          if (gErr?.code === 'auth/popup-closed-by-user') {
                            // User closed popup
                            return;
                          }
                          console.warn('Google popup notice, falling back to modal:', gErr);
                          setOauthProvider('google');
                        } finally {
                          setLoading(false);
                        }
                      }}
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
                      title="Sign up with GitHub"
                      onClick={() => setOauthProvider('github')}
                      className="smartnest-social-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F172A">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Google and GitHub Interactive OAuth Modal */}
      <OAuthModal
        isOpen={oauthProvider !== null}
        provider={oauthProvider}
        onClose={() => setOauthProvider(null)}
        onSuccess={onRegisterSuccess}
        defaultRole={role}
      />

      {/* Terms of Service & Industrial Safety Operational Policy (All-Condition Window) */}
      {showTermsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTermsModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '88vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#0F172A',
                color: '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#60A5FA',
                    border: '1px solid rgba(96, 165, 250, 0.3)'
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    Terms of Service & Operational Policies
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    ProtectoAI 2.0 Industrial Safety & Biometric Intelligence Platform
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Conditions Body */}
            <div
              style={{
                padding: '24px 28px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#EFF6FF',
                  borderRadius: '12px',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <ShieldCheck size={20} color="#2563EB" style={{ flexShrink: 0 }} />
                <span>
                  Please carefully read and review all platform conditions. Agreeing to these terms is mandatory for accessing ProtectoAI surveillance, biometric logging, and industrial safety telemetry.
                </span>
              </div>

              {/* Condition 1 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  1. Personnel Biometric Identification & Optical Facial Processing
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  By enrolling or registering, you authorize ProtectoAI to process optical video frames using Haar Cascades, CLAHE contrast enhancement, and Local Binary Patterns Histograms (LBPH) to identify authorized personnel and automate shift attendance. All biometric facial representations are stored in local, encrypted SQLite registries with AES-256 protected templates.
                </p>
              </div>

              {/* Condition 2 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  2. Autonomous Computer Vision PPE Surveillance & OSHA Standards
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  ProtectoAI continuously evaluates 25 industrial hazard classes (including Hardhats, High-Visibility Vests, Protective Eyewear, Gloves, Fall-Protection Harnesses, and Heavy Equipment interactions) pursuant to OSHA industrial safety mandates. All camera feeds are monitored in real-time to alert personnel of hazardous breaches.
                </p>
              </div>

              {/* Condition 3 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  3. Individual Security Tokens & Operator Access Credentials
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  New operator registrations are subject to explicit approval by Administrator Mohd Sahil (<code>sahilmohammad512@gmail.com</code>). Once authorized, each operator receives an individual, cryptographically unique security token. This token is non-transferable and must never be shared. Unauthorized credential sharing will result in permanent revocation of platform privileges.
                </p>
              </div>

              {/* Condition 4 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  4. Automated Incident Logging & Permanent Audit Records
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  When safety infractions occur (e.g. missing PPE, hazardous zone intrusion), the system captures an optical snapshot, timestamps the occurrence, and records the incident immutably in the compliance database. Official OSHA-ready safety audits and attendance registers may be exported by authorized administrators.
                </p>
              </div>

              {/* Condition 5 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  5. Supervisory Administrator Authority & Access Revocation
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  The Administrator retains the right to approve, place on hold, regenerate tokens for, or revoke access of any operator at any time to preserve industrial site security and physical workforce protection.
                </p>
              </div>

              {/* Condition 6 */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  6. System Usage & Site Safety Compliance
                </h4>
                <p style={{ margin: 0, color: '#475569' }}>
                  ProtectoAI is an intelligent supervisory decision-support system. It supplements, but does not replace, mandatory industrial safety protocols, physical safety barriers, personal vigilance, or emergency response procedures. Operators must follow all on-site regulatory directives.
                </p>
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                {agreeTerms ? (
                  <span style={{ color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} /> You have agreed to all conditions
                  </span>
                ) : (
                  <span>Click "I Agree to All Conditions" to accept & proceed</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Decline & Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAgreeTerms(true);
                    setShowTermsModal(false);
                    setError(null);
                  }}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>I Agree to All Conditions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
