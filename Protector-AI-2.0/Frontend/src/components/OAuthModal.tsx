import React, { useState } from 'react';
import { X, Check, Loader2, ArrowRight, UserCheck, Shield } from 'lucide-react';
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
  defaultRole = 'Administrator'
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUsername, setCustomUsername] = useState('');

  if (!isOpen || !provider) return null;

  const handleOAuthLogin = async (payload: {
    email: string;
    name: string;
    username?: string;
    avatar?: string;
  }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.oauthLogin({
        provider,
        email: payload.email.trim().toLowerCase(),
        name: payload.name.trim(),
        username: payload.username?.trim(),
        avatar: payload.avatar,
        role: defaultRole
      });

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'OAuth authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    const nameToUse = customName.trim() || customEmail.split('@')[0];
    handleOAuthLogin({
      email: customEmail,
      name: nameToUse,
      username: customUsername.trim() || undefined
    });
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
          maxWidth: '460px',
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
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
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
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
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
        <div style={{ padding: '24px 28px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FEE2E2',
                color: '#DC2626',
                fontSize: '12.5px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
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
          ) : !showCustomInput ? (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '12px' }}>
                {provider === 'google' ? 'Choose an enrolled account:' : 'Select authorized GitHub profile:'}
              </div>

              {provider === 'google' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Account 1: Mohd Sahil */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOAuthLogin({
                        email: 'sahil@protecto.ai',
                        name: 'Mohd Sahil'
                      })
                    }
                    className="oauth-account-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: 700
                      }}
                    >
                      S
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        Mohd Sahil
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        sahil@protecto.ai · Primary Developer
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '3px 8px', borderRadius: '12px' }}>
                      Admin
                    </span>
                  </button>

                  {/* Account 2: Alok */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOAuthLogin({
                        email: 'alok@protecto.ai',
                        name: 'Alok'
                      })
                    }
                    className="oauth-account-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: 700
                      }}
                    >
                      A
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        Alok
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        alok@protecto.ai · Biometric Enrolled
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '3px 8px', borderRadius: '12px' }}>
                      Enrolled
                    </span>
                  </button>

                  {/* Account 3: Faisal */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOAuthLogin({
                        email: 'faisal@protecto.ai',
                        name: 'Faisal'
                      })
                    }
                    className="oauth-account-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#F59E0B',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: 700
                      }}
                    >
                      F
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        Faisal
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        faisal@protecto.ai · Biometric Enrolled
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '3px 8px', borderRadius: '12px' }}>
                      Enrolled
                    </span>
                  </button>
                </div>
              ) : (
                /* GitHub Account Selection */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* GitHub Profile 1: @sahilmohd-10 */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOAuthLogin({
                        email: 'sahilmohd.ai@gmail.com',
                        name: 'Mohd Sahil',
                        username: 'sahilmohd-10'
                      })
                    }
                    className="oauth-account-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: 700
                      }}
                    >
                      S
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        @sahilmohd-10
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        Mohd Sahil · sahilmohd.ai@gmail.com
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A', background: '#F1F5F9', padding: '3px 8px', borderRadius: '12px' }}>
                      Owner
                    </span>
                  </button>

                  {/* GitHub Profile 2: @protecto-operator */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOAuthLogin({
                        email: 'operator@protecto.ai',
                        name: 'Site Operator',
                        username: 'protecto-operator'
                      })
                    }
                    className="oauth-account-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#334155',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: 700
                      }}
                    >
                      O
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        @protecto-operator
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        Industrial Floor Lead · operator@protecto.ai
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', background: '#F1F5F9', padding: '3px 8px', borderRadius: '12px' }}>
                      Operator
                    </span>
                  </button>
                </div>
              )}

              {/* Toggle to custom input */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: provider === 'google' ? '#2563EB' : '#0F172A',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Use another {provider === 'google' ? 'Google' : 'GitHub'} account</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Custom Account Input Form */
            <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  {provider === 'google' ? 'Google Email' : 'GitHub Account Email'} *
                </label>
                <input
                  type="email"
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder={provider === 'google' ? 'user@gmail.com' : 'dev@github.com'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Full Name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {provider === 'github' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="octocat"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: provider === 'google' ? '#2563EB' : '#0F172A',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Privacy Footnote */}
          <div
            style={{
              marginTop: '20px',
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
