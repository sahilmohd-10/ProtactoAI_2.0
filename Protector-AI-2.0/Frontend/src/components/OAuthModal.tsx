import React, { useState, useEffect } from 'react';
import { X, Loader2, ExternalLink, KeyRound, Clock } from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';

interface OAuthModalProps {
  isOpen: boolean;
  provider: 'google' | 'github' | null;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  defaultRole?: 'Administrator' | 'Operator';
}

export const OAuthModal: React.FC<OAuthModalProps> = ({
  isOpen,
  provider,
  onClose,
  onSuccess,
  defaultRole = 'Operator'
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [googleClientId, setGoogleClientId] = useState<string>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || '512272700093-5ebjj1071qjq04j9mdbci2idvtftpkau.apps.googleusercontent.com'
  );
  const [githubClientId, setGithubClientId] = useState<string>(
    import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23li1kJzE3M295HoCn'
  );

  useEffect(() => {
    api.getOAuthConfig().then(cfg => {
      if (cfg?.google_client_id) setGoogleClientId(cfg.google_client_id);
      if (cfg?.github_client_id) setGithubClientId(cfg.github_client_id);
    }).catch(() => { });
  }, []);

  // Initialize Google Identity Services when modal opens with Google provider
  useEffect(() => {
    if (!isOpen || provider !== 'google') return;

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
              const res = await api.verifyGoogleOAuth(response.credential, defaultRole, authToken.trim());
              if (res.success && res.user) {
                onSuccess(res.user);
                onClose();
              } else if (res.pending_approval) {
                setError('⏳ Account Pending Authorization: Your Operator account is awaiting approval from Administrator Mohd Sahil. Once authorized, you will receive your unique Operator Security Token.');
              } else if (res.requires_auth_token) {
                setError('🔑 Administrator Authorization Token is required for Operator login. Enter your unique security token issued by Administrator Mohd Sahil.');
              } else {
                setError('Google verification failed.');
              }
            } catch (err: any) {
              setError(err.message || 'Google verification failed.');
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
  }, [isOpen, provider, googleClientId, defaultRole]);

  if (!isOpen || !provider) return null;

  const handleLaunchGitHubOAuth = () => {
    if (!githubClientId) {
      setError('GitHub Client ID is not configured.');
      return;
    }
    // GitHub redirects to the registered Authorization callback URL in your GitHub OAuth App settings
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      githubClientId
    )}&scope=read:user,user:email`;
    window.location.href = authUrl;
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
        if (e.target === e.currentTarget && !loading) onClose();
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
            padding: '24px 28px 18px 28px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: provider === 'google' ? '#FAFBFC' : '#0F172A',
            color: provider === 'google' ? '#0F172A' : '#FFFFFF'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {provider === 'google' ? (
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
                {provider === 'google' ? 'Sign in with Google' : 'Authorize Protector AI'}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: provider === 'google' ? '#64748B' : '#94A3B8',
                  marginTop: '2px'
                }}
              >
                {provider === 'google' ? 'to continue to ProtectoAI' : 'by @sahilmohd-10'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: provider === 'google' ? '#94A3B8' : '#94A3B8',
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
        <div style={{ padding: '28px 24px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: error.toLowerCase().includes('pending') ? '#FFFBEB' : '#FEF2F2',
                border: error.toLowerCase().includes('pending') ? '1px solid #FDE68A' : '1px solid #FEE2E2',
                color: error.toLowerCase().includes('pending') ? '#B45309' : '#DC2626',
                fontSize: '12.5px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: 1.5
              }}
            >
              {error.toLowerCase().includes('pending') && <Clock size={16} style={{ flexShrink: 0 }} />}
              <span>{error}</span>
            </div>
          )}

          {loading ? (
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', lineHeight: 1.5 }}>
                {provider === 'google'
                  ? 'Authenticate securely using your Google Workspace or Personal account:'
                  : 'Authorize Protector AI 2.0 with your official GitHub account:'}
              </div>

              {defaultRole === 'Operator' && (
                <div style={{ width: '100%', marginBottom: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <KeyRound size={13} color="#0284C7" />
                    <span>Unique Operator Security Token (if authorized)</span>
                  </label>
                  <input
                    type="text"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="e.g. OP-01-A7E91B (leave blank if first time)"
                    className="smartnest-input"
                    style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px' }}
                    disabled={loading}
                  />
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0 2px' }}>
                    First-time OAuth login creates an account pending Administrator authorization. Second-time logins require your unique token.
                  </p>
                </div>
              )}

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
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #F1F5F9',
              fontSize: '11px',
              color: '#94A3B8',
              lineHeight: 1.5,
              textAlign: 'center'
            }}
          >
            {provider === 'google' ? (
              <span>
                To continue, Google shares your verified name and email address with <strong>ProtectoAI</strong>.
              </span>
            ) : (
              <span>
                Protector AI by <strong>@sahilmohd-10</strong> receives verified read access to your public GitHub profile and primary email.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
