import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, ExternalLink, KeyRound, Clock, ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

interface OAuthModalProps {
  isOpen: boolean;
  provider: 'google' | 'github' | null;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  defaultRole?: 'Administrator' | 'Operator';
  initialStep?: 'select' | 'token_prompt';
  initialCredential?: string;
  initialEmail?: string;
  initialUsername?: string;
}

export const OAuthModal: React.FC<OAuthModalProps> = ({
  isOpen,
  provider,
  onClose,
  onSuccess,
  defaultRole = 'Operator',
  initialStep = 'select',
  initialCredential = '',
  initialEmail = '',
  initialUsername = ''
}) => {
  const [step, setStep] = useState<'select' | 'token_prompt'>(initialStep);
  const [loading, setLoading] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Operator token state
  const [tokenInput, setTokenInput] = useState('');
  const [pendingCredential, setPendingCredential] = useState(initialCredential);
  const [pendingEmail, setPendingEmail] = useState(initialEmail);
  const [pendingUsername, setPendingUsername] = useState(initialUsername);

  const [googleClientId, setGoogleClientId] = useState<string>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || '512272700093-5ebjj1071qjq04j9mdbci2idvtftpkau.apps.googleusercontent.com'
  );
  const [githubClientId, setGithubClientId] = useState<string>(
    import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23li1kJzE3M295HoCn'
  );

  const tokenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getOAuthConfig().then(cfg => {
      if (cfg?.google_client_id) setGoogleClientId(cfg.google_client_id);
      if (cfg?.github_client_id) setGithubClientId(cfg.github_client_id);
    }).catch(() => { });
  }, []);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialStep === 'token_prompt') {
        setStep('token_prompt');
        if (initialCredential) setPendingCredential(initialCredential);
        if (initialEmail) setPendingEmail(initialEmail);
        if (initialUsername) setPendingUsername(initialUsername);
      } else {
        setStep('select');
        setPendingCredential('');
        setPendingEmail('');
        setPendingUsername('');
        setTokenInput('');
      }
      setError(null);
    }
  }, [isOpen, initialStep, initialCredential, initialEmail, initialUsername]);

  // Focus token input when switching to token_prompt
  useEffect(() => {
    if (step === 'token_prompt') {
      setTimeout(() => {
        tokenInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  // Initialize Google Identity Services when modal opens with Google provider on select step
  useEffect(() => {
    if (!isOpen || provider !== 'google' || step !== 'select') return;

    const initGoogleGsi = () => {
      const g = (window as any).google;
      if (!g || !g.accounts || !g.accounts.id) return;

      try {
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: { credential: string }) => {
            if (!response.credential) return;
            setLoading(true);
            setError(null);
            try {
              const res = await api.verifyGoogleOAuth(response.credential, defaultRole, tokenInput.trim());
              if (res.success && res.user) {
                onSuccess(res.user);
                onClose();
              } else if (res.pending_approval) {
                setError('⏳ Account Pending Authorization: Your Operator account is awaiting approval from Administrator Mohd Sahil. Once authorized, you will receive your unique Operator Security Token.');
              } else if (res.requires_auth_token) {
                // Authorized before: directly prompt for token!
                setPendingCredential(response.credential);
                setPendingEmail(res.email || '');
                setPendingUsername(res.username || '');
                setStep('token_prompt');
                setError(null);
              } else {
                setError('Google verification failed. Please try again.');
              }
            } catch (err: any) {
              if (err.requires_auth_token || (err.message && err.message.toLowerCase().includes('token is required'))) {
                // Authorized before: directly prompt for token!
                setPendingCredential(response.credential);
                setPendingEmail(err.email || '');
                setPendingUsername(err.username || '');
                setStep('token_prompt');
                setError(null);
              } else if (err.pending_approval || (err.message && err.message.toLowerCase().includes('pending authorization'))) {
                setError('⏳ Account Pending Authorization: Your Operator account is awaiting approval from Administrator Mohd Sahil. Once authorized, you will receive your unique Operator Security Token.');
              } else {
                setError(err.message || 'Google verification failed.');
              }
            } finally {
              setLoading(false);
            }
          }
        });

        const btnContainer = document.getElementById('google-live-btn-slot');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          g.accounts.id.renderButton(btnContainer, {
            theme: 'filled_blue',
            size: 'large',
            width: 360,
            text: 'continue_with',
            shape: 'pill'
          });
        }
      } catch (e) {
        console.warn('Google Identity Services render error:', e);
      }
    };

    if (document.getElementById('google-gsi-sdk')) {
      initGoogleGsi();
    } else {
      const script = document.createElement('script');
      script.id = 'google-gsi-sdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleGsi();
      document.body.appendChild(script);
    }
  }, [isOpen, provider, googleClientId, defaultRole, step, tokenInput]);

  if (!isOpen || !provider) return null;

  const handleLaunchGitHubOAuth = () => {
    if (!githubClientId) {
      setError('GitHub Client ID is not configured.');
      return;
    }
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      githubClientId
    )}&scope=read:user,user:email`;
    window.location.href = authUrl;
  };

  // Submit token verification for previously authorized operator
  const handleVerifyTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setError('Please enter your unique Operator Security Token issued by Administrator Mohd Sahil.');
      return;
    }
    if (!pendingCredential) {
      setError('OAuth session expired. Please sign in again.');
      setStep('select');
      return;
    }

    setTokenVerifying(true);
    setError(null);
    try {
      let res;
      if (provider === 'google') {
        res = await api.verifyGoogleOAuth(pendingCredential, defaultRole, token);
      } else {
        res = await api.exchangeGitHubOAuth(pendingCredential, defaultRole, token);
      }

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError('Token verification failed. Please check your token and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Access Denied: Invalid Operator Security Token.');
    } finally {
      setTokenVerifying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !tokenVerifying) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '22px 28px 18px 28px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: step === 'token_prompt' ? '#0F172A' : (provider === 'google' ? '#FAFBFC' : '#0F172A'),
            color: step === 'token_prompt' ? '#FFFFFF' : (provider === 'google' ? '#0F172A' : '#FFFFFF')
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {step === 'token_prompt' ? (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <KeyRound size={20} color="#60A5FA" />
              </div>
            ) : provider === 'google' ? (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
              </div>
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </div>
            )}
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>
                {step === 'token_prompt'
                  ? 'Operator Token Required'
                  : provider === 'google'
                    ? 'Sign in with Google'
                    : 'Authorize Protector AI'}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: step === 'token_prompt' ? '#94A3B8' : (provider === 'google' ? '#64748B' : '#94A3B8'),
                  marginTop: '2px'
                }}
              >
                {step === 'token_prompt'
                  ? 'Authorized Operator Verification'
                  : provider === 'google'
                    ? 'to continue to ProtectoAI'
                    : 'by @sahilmohd-10'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading || tokenVerifying}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '26px 24px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: error.toLowerCase().includes('pending') ? '#FFFBEB' : '#FEF2F2',
                border: error.toLowerCase().includes('pending') ? '1px solid #FDE68A' : '1px solid #FEE2E2',
                color: error.toLowerCase().includes('pending') ? '#B45309' : '#DC2626',
                fontSize: '12.5px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: 1.5
              }}
            >
              {error.toLowerCase().includes('pending') ? (
                <Clock size={16} style={{ flexShrink: 0 }} />
              ) : (
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
              )}
              <span>{error}</span>
            </div>
          )}

          {/* STEP 2: OPERATOR SECURITY TOKEN PROMPT (When account is authorized) */}
          {step === 'token_prompt' ? (
            <form onSubmit={handleVerifyTokenSubmit}>
              {/* Account identity badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <ShieldCheck size={16} color="#16A34A" />
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#1E293B',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}
                  >
                    {pendingEmail || pendingUsername || 'Authorized Account'}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D'
                  }}
                >
                  Authorized
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
                Your Operator account is authorized by <strong>Administrator Mohd Sahil</strong>. Please enter your unique <strong>Operator Security Token</strong> to complete login.
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px'
                  }}
                >
                  <KeyRound size={14} color="#2563EB" />
                  <span>Unique Security Token (Passkey)</span>
                </label>
                <input
                  ref={tokenInputRef}
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="e.g. OP-ALOK-2026 or OP-01-A7E91B"
                  disabled={tokenVerifying}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #2563EB',
                    backgroundColor: '#F8FAFC',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    letterSpacing: '1px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
                  }}
                />
                <p style={{ fontSize: '11px', color: '#64748B', margin: '6px 0 0 2px' }}>
                  Enter the token issued to your name in the Team & Auth console.
                </p>
              </div>

              <button
                type="submit"
                disabled={tokenVerifying || !tokenInput.trim()}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  backgroundColor: tokenVerifying || !tokenInput.trim() ? '#94A3B8' : '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: tokenVerifying || !tokenInput.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tokenVerifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Security Token...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Verify Token & Log In</span>
                  </>
                )}
              </button>

              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('select');
                    setError(null);
                  }}
                  disabled={tokenVerifying}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>Use a different account</span>
                </button>
              </div>
            </form>
          ) : loading ? (
            /* LOADING STATE */
            <div
              style={{
                padding: '36px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              <Loader2 size={32} className="animate-spin" color={provider === 'google' ? '#2563EB' : '#0F172A'} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                {provider === 'google' ? 'Connecting to Google OAuth...' : 'Authorizing via GitHub OAuth...'}
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                Synchronizing session token and credentials
              </div>
            </div>
          ) : (
            /* STEP 1: INITIAL PROVIDER SELECTION SCREEN */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', lineHeight: 1.5 }}>
                {provider === 'google'
                  ? 'Authenticate securely using your Google Workspace or Personal account:'
                  : 'Authorize Protector AI 2.0 with your official GitHub account:'}
              </div>

              {provider === 'google' ? (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
                  <div id="google-live-btn-slot" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLaunchGitHubOAuth}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '14px',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1E293B')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0F172A')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>Authorize with GitHub Account</span>
                  <ExternalLink size={16} />
                </button>
              )}
            </div>
          )}

          {/* Privacy Footnote */}
          <div
            style={{
              marginTop: '22px',
              paddingTop: '14px',
              borderTop: '1px solid #F1F5F9',
              fontSize: '11px',
              color: '#94A3B8',
              lineHeight: 1.5,
              textAlign: 'center'
            }}
          >
            {provider === 'google' ? (
              <span>
                To continue, Google shares your verified identity with <strong>ProtectoAI</strong>.
              </span>
            ) : (
              <span>
                Protector AI by <strong>@sahilmohd-10</strong> receives verified read access to your public GitHub profile and email.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
