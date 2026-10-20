import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Upload, Trash2, UserPlus, ShieldCheck, User, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { FaceProfile, FaceVisitLog } from '../types';
import { api } from '../services/api';

const captureFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null => {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, 800 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
};

export const PeopleManagement: React.FC = () => {
  const [people, setPeople] = useState<FaceProfile[]>([]);
  const [name, setName] = useState('');
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [enrollMethod, setEnrollMethod] = useState<'camera' | 'upload'>('upload');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPeople = useCallback(async () => {
    try {
      const profiles = await api.getPeople();
      setPeople(profiles);
    } catch (err: any) {
      console.error('Failed to refresh people:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await refreshPeople();
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load people profiles.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [refreshPeople]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    setStatusMessage('Accessing camera hardware...');
    try {
      // Release hardware camera in backend so Windows DirectShow unlocks the device for browser
      try {
        await api.releaseHardwareCamera('cam_01');
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch {
        // quiet fallback
      }

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatusMessage('Camera online. Ensure full face is clearly visible, then click Enroll.');
    } catch (cameraError) {
      setError(
        cameraError instanceof Error
          ? `${cameraError.message}. Alternatively, select 'Upload Photo' to enroll from a picture file.`
          : 'Could not access local camera. Try using the Upload Photo option.'
      );
      setStatusMessage(null);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStatusMessage('Camera paused.');
  };

  // Handle image file selection
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const loadedDataUrls: string[] = [];
    const maxFiles = Math.min(files.length, 5);
    let readCount = 0;

    for (let i = 0; i < maxFiles; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setError('Please select valid image files (.jpg, .jpeg, .png, .webp).');
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) loadedDataUrls.push(result);
        readCount++;
        if (readCount === maxFiles) {
          setUploadedImages(loadedDataUrls);
          setStatusMessage(`${loadedDataUrls.length} photo(s) loaded. Confirm consent and enter name to complete enrollment.`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please provide the person’s full name.');
      return;
    }
    if (!consentRecorded) {
      setError('Explicit biometric consent confirmation is required to proceed.');
      return;
    }

    setIsEnrolling(true);
    setError(null);
    setStatusMessage(null);

    try {
      let imagesToEnroll: string[] = [];

      if (enrollMethod === 'camera') {
        if (!stream || !videoRef.current || !canvasRef.current) {
          throw new Error('Please start the camera before capturing face photos.');
        }
        setStatusMessage('Capturing high-resolution face samples...');
        for (let i = 0; i < 4; i++) {
          const frame = captureFrame(videoRef.current, canvasRef.current);
          if (frame) imagesToEnroll.push(frame);
          if (i < 3) await new Promise((res) => setTimeout(res, 280));
        }
        if (imagesToEnroll.length === 0) {
          throw new Error('Failed to capture frame from camera. Ensure the face is visible and lighted.');
        }
      } else {
        if (uploadedImages.length === 0) {
          throw new Error('Please select or upload at least one face photo.');
        }
        imagesToEnroll = uploadedImages;
      }

      setStatusMessage('Extracting facial biometric landmarks and training encrypted model...');
      await api.enrollPerson({
        name: name.trim(),
        consent_recorded: true,
        images: imagesToEnroll
      });

      setName('');
      setConsentRecorded(false);
      setUploadedImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMessage(`Successfully enrolled "${name.trim()}". Their face model is active and will be identified in the Console stream.`);
      await refreshPeople();
    } catch (enrollError: any) {
      setError(enrollError instanceof Error ? enrollError.message : 'Unable to enroll this person.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDelete = async (profile: FaceProfile) => {
    if (!window.confirm(`Permanently delete biometric model and all historical records for ${profile.name}?`)) return;
    setError(null);
    try {
      await api.deletePerson(profile.id);
      await refreshPeople();
      setStatusMessage(`Deleted biometric profile for ${profile.name}.`);
    } catch (deleteError: any) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete profile.');
    }
  };

  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner Header */}
      <div>
        <div className="section-tag">
          <span className="section-tag-num">04</span>
          <span>/ BIOMETRIC IDENTITY ENROLLMENT</span>
        </div>
        <h1 className="display-title" style={{ fontSize: '28px', marginTop: '10px' }}>
          Personnel & Face Models
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '820px', lineHeight: 1.6 }}>
          Register authorized workers and personnel models for optical verification. When camera monitoring is active in the{' '}
          <strong style={{ color: 'var(--accent-citron)' }}>Console</strong>, Protector AI will automatically identify enrolled people, verify safety compliance, and link their name directly to safety incident reports.
        </p>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '20px' }}>
        
        {/* Left Column: Enrollment Studio */}
        <section className="precision-surface" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} style={{ color: 'var(--accent-citron)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Enroll New Person</h2>
            </div>

            {/* Method Toggle: Camera vs File Upload */}
            <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => { setEnrollMethod('upload'); stopCamera(); setError(null); }}
                style={{
                  background: enrollMethod === 'upload' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: enrollMethod === 'upload' ? 'var(--accent-citron)' : 'var(--text-tertiary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Upload size={13} /> Upload Photo
              </button>
              <button
                type="button"
                onClick={() => { setEnrollMethod('camera'); setError(null); }}
                style={{
                  background: enrollMethod === 'camera' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: enrollMethod === 'camera' ? 'var(--accent-citron)' : 'var(--text-tertiary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Camera size={13} /> Live Camera
              </button>
            </div>
          </div>

          {/* Visual Input / Viewport Area */}
          {enrollMethod === 'camera' ? (
            <div>
              <div style={{
                background: '#04060A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                overflow: 'hidden',
                aspectRatio: '16 / 9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {stream ? (
                  <video
                    ref={videoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                    <Camera size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: '12px' }}>Camera is currently standby</div>
                    <div style={{ fontSize: '10.5px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                      Click "Start Camera" below to capture biometric face crop
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {!stream ? (
                  <button className="btn-secondary" type="button" onClick={startCamera} style={{ fontSize: '11.5px', padding: '6px 14px' }}>
                    <Camera size={14} /> Start Camera
                  </button>
                ) : (
                  <button className="btn-secondary" type="button" onClick={stopCamera} style={{ fontSize: '11.5px', padding: '6px 14px', color: 'var(--safety-violation)' }}>
                    <CameraOff size={14} /> Stop Camera
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'var(--bg-app)',
                  border: '1.5px dashed var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-citron)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Upload size={28} style={{ color: 'var(--accent-citron)', opacity: 0.8 }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Click to select face photo(s)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  PNG, JPG, or WEBP up to 10MB • Clear headshot or badge photo
                </div>
              </div>

              {/* Uploaded Photos Thumbnails Preview */}
              {uploadedImages.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                    SELECTED PHOTOS ({uploadedImages.length}):
                  </div>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {uploadedImages.map((src, idx) => (
                      <div key={idx} style={{ width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--accent-citron)', flexShrink: 0 }}>
                        <img src={src} alt="Face sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Controls */}
          <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
            <div>
              <label htmlFor="person-name" style={{ display: 'block', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                PERSON'S FULL NAME
              </label>
              <input
                id="person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                disabled={isEnrolling}
                placeholder="e.g. Mohd Sahil, Jane Doe"
                className="auth-input"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '11.5px', lineHeight: 1.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consentRecorded}
                onChange={(e) => setConsentRecorded(e.target.checked)}
                disabled={isEnrolling}
                style={{ marginTop: '2px', accentColor: 'var(--accent-citron)', cursor: 'pointer' }}
              />
              <span>
                I confirm this person explicitly consented to biometric enrollment and repeat identification for safety monitoring.
              </span>
            </label>

            {/* Notification & Feedback Alerts */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 77, 77, 0.08)',
                border: '1px solid rgba(255, 77, 77, 0.3)',
                color: 'var(--safety-violation)',
                fontSize: '11.5px'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {statusMessage && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.3)',
                color: 'var(--safety-safe)',
                fontSize: '11.5px'
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{statusMessage}</span>
              </div>
            )}

            <button
              className="btn-citron"
              type="submit"
              disabled={
                isEnrolling ||
                !name.trim() ||
                !consentRecorded ||
                (enrollMethod === 'camera' ? !stream : uploadedImages.length === 0)
              }
              style={{
                marginTop: '4px',
                padding: '9px 18px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}
            >
              <UserPlus size={15} />
              {isEnrolling ? 'TRAINING & ENROLLING...' : 'ENROLL WITH CONSENT'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '10.5px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent-citron)' }} />
              <span>
                Source photos are converted into mathematical facial feature vectors and encrypted locally.
              </span>
            </div>
          </form>
        </section>

        {/* Right Column: Enrolled People Directory */}
        <section className="precision-surface" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: 'var(--accent-citron)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Enrolled People ({people.length})
              </h2>
            </div>

            <button
              onClick={() => void refreshPeople()}
              className="btn-secondary"
              title="Refresh directory"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Search Bar for Enrolled People */}
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Search enrolled personnel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="auth-input"
              style={{ width: '100%', fontSize: '12px', padding: '7px 10px' }}
            />
          </div>

          {/* Profiles Listing */}
          {isLoading ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Loading enrolled profiles...
            </div>
          ) : filteredPeople.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              {searchQuery ? 'No enrolled people match this search query.' : 'No personnel profiles enrolled yet.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '520px', paddingRight: '4px' }}>
              {filteredPeople.map((person) => (
                <div
                  key={person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(235, 255, 0, 0.12)',
                      border: '1px solid rgba(235, 255, 0, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-citron)',
                      fontWeight: 700,
                      fontSize: '14px',
                      flexShrink: 0
                    }}>
                      {person.name.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {person.name}
                        </span>
                        <span className="status-pill status-pill-safe" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          MODEL ACTIVE
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                        {person.visit_count} detection logs · Last seen {person.last_seen_at ? new Date(person.last_seen_at).toLocaleTimeString() : 'Never'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDelete(person)}
                    aria-label={`Delete ${person.name}`}
                    title={`Delete ${person.name}'s biometric profile`}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '7px 8px',
                      color: 'var(--safety-violation)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 77, 77, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              All biometric recognition and safety compliance verification happens live on the active stream inside the{' '}
              <strong style={{ color: 'var(--accent-citron)' }}>Console</strong>. Any detected violations will link the worker's name into the{' '}
              <strong style={{ color: 'var(--accent-citron)' }}>Incidents</strong> log.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
};
