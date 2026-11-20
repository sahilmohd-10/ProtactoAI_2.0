import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Upload,
  Trash2,
  UserPlus,
  ShieldCheck,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Scan,
  RotateCcw
} from 'lucide-react';
import type { FaceProfile } from '../types';
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
  const [enrollMethod, setEnrollMethod] = useState<'camera' | 'upload'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 5-Second Multi-Angle Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scanTimeRemaining, setScanTimeRemaining] = useState<number>(5.0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState<number>(0);
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [collectedSampleThumbs, setCollectedSampleThumbs] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 5 Guided Scanning Directions (1 sec each across 5 sec total)
  const SCAN_DIRECTIONS = [
    { id: 'centre', order: '1. LOOK CENTRE', title: 'Look Directly at Center', voice: 'Look center', icon: Crosshair, color: '#3B82F6' },
    { id: 'right', order: '2. TURN RIGHT', title: 'Turn Face to Right ➔', voice: 'Turn face right', icon: ArrowRight, color: '#10B981' },
    { id: 'left', order: '3. TURN LEFT', title: 'Turn Face to Left ⬅', voice: 'Turn face left', icon: ArrowLeft, color: '#8B5CF6' },
    { id: 'top', order: '4. TILT UP', title: 'Tilt Face Upwards ⬆', voice: 'Tilt face up', icon: ArrowUp, color: '#F59E0B' },
    { id: 'down', order: '5. TILT DOWN', title: 'Tilt Face Downwards ⬇', voice: 'Tilt face down', icon: ArrowDown, color: '#EC4899' },
  ];

  const speakInstruction = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {
        // quiet fallback
      }
    }
  };

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
      setStatusMessage('Camera online. Ready for 5-second multi-angle biometric face training.');
    } catch (cameraError) {
      setError(
        cameraError instanceof Error
          ? `${cameraError.message}. Alternatively, select 'Upload Photo' to enroll from picture files.`
          : 'Could not access local camera. Try using the Upload Photo option.'
      );
      setStatusMessage(null);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setIsScanning(false);
    setStatusMessage('Camera paused.');
  };

  // 5-Second Multi-Angle Scanning & Training Routine
  const executeFiveSecondScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the person's full name first.");
      return;
    }
    if (!consentRecorded) {
      setError('Explicit biometric consent confirmation is required to proceed.');
      return;
    }

    setError(null);
    setStatusMessage(null);

    // Auto-start camera if standby
    if (!stream) {
      await startCamera();
      await new Promise((res) => setTimeout(res, 600));
    }

    if (!videoRef.current || !canvasRef.current) {
      setError('Camera video element is not ready. Please click Start Camera.');
      return;
    }

    setIsScanning(true);
    setCapturedCount(0);
    setCollectedSampleThumbs([]);
    setScanTimeRemaining(5.0);

    const capturedFrames: string[] = [];
    const startTime = Date.now();
    const totalDuration = 5000; // 5000ms

    try {
      for (let phase = 0; phase < SCAN_DIRECTIONS.length; phase++) {
        setCurrentPhaseIndex(phase);
        speakInstruction(SCAN_DIRECTIONS[phase].voice);

        // 3 samples per 1-second direction phase
        for (let sub = 0; sub < 3; sub++) {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, (totalDuration - elapsed) / 1000);
          setScanTimeRemaining(Number(remaining.toFixed(1)));

          const frame = captureFrame(videoRef.current, canvasRef.current);
          if (frame) {
            capturedFrames.push(frame);
            setCollectedSampleThumbs((prev) => [...prev.slice(-8), frame]);
            setCapturedCount(capturedFrames.length);
          }
          await new Promise((res) => setTimeout(res, 310));
        }
      }

      setScanTimeRemaining(0.0);
      setIsScanning(false);
      speakInstruction('Scan complete. Training biometric model.');
      setStatusMessage(`Captured ${capturedFrames.length} multi-angle biometric samples. Training encrypted model...`);
      setIsEnrolling(true);

      await api.enrollPerson({
        name: name.trim(),
        consent_recorded: true,
        images: capturedFrames
      });

      setName('');
      setConsentRecorded(false);
      setCollectedSampleThumbs([]);
      setStatusMessage(`Successfully trained and enrolled "${name.trim()}" across all face directions!`);
      await refreshPeople();
    } catch (enrollError: any) {
      setError(enrollError instanceof Error ? enrollError.message : 'Unable to complete biometric enrollment.');
    } finally {
      setIsScanning(false);
      setIsEnrolling(false);
    }
  };

  // Handle image file selection fallback
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const loadedDataUrls: string[] = [];
    const maxFiles = Math.min(files.length, 10);
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

  const handleEnrollUploaded = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please provide the person's full name.");
      return;
    }
    if (!consentRecorded) {
      setError('Explicit biometric consent confirmation is required to proceed.');
      return;
    }
    if (uploadedImages.length === 0) {
      setError('Please select or upload at least one face photo.');
      return;
    }

    setIsEnrolling(true);
    setError(null);
    setStatusMessage('Extracting facial biometric landmarks and training encrypted model...');

    try {
      await api.enrollPerson({
        name: name.trim(),
        consent_recorded: true,
        images: uploadedImages
      });

      setName('');
      setConsentRecorded(false);
      setUploadedImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMessage(`Successfully enrolled "${name.trim()}". Their face model is active.`);
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

  const activeDirection = SCAN_DIRECTIONS[currentPhaseIndex];
  const ActiveIcon = activeDirection.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Header Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        padding: '22px 26px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>
              PROTECTOAI • BIOMETRIC FACE ENROLLMENT STUDIO
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0', letterSpacing: '-0.02em' }}>
            Biometric Personnel Training & Directory
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            5-Second multi-angle biometric face scanner (Centre, Right, Left, Top, Down) for industrial verification.
          </p>
        </div>

        <button
          onClick={refreshPeople}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #CBD5E1',
            borderRadius: '10px',
            color: '#0F172A',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '22px' }}>
        
        {/* Left Column: 5-Second Biometric Training Studio */}
        <section style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EBF8F2', color: '#0F5132', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scan size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  5-Second 360° Face Training Studio
                </h2>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Multi-angle deep learning template generation
                </span>
              </div>
            </div>

            {/* Method Toggle: Camera vs File Upload */}
            <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => { setEnrollMethod('camera'); setError(null); }}
                style={{
                  background: enrollMethod === 'camera' ? '#FFFFFF' : 'transparent',
                  color: enrollMethod === 'camera' ? '#0F5132' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: enrollMethod === 'camera' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: enrollMethod === 'camera' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Camera size={13} /> Live Camera (5s Scan)
              </button>

              <button
                type="button"
                onClick={() => { setEnrollMethod('upload'); stopCamera(); setError(null); }}
                style={{
                  background: enrollMethod === 'upload' ? '#FFFFFF' : 'transparent',
                  color: enrollMethod === 'upload' ? '#0F5132' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: enrollMethod === 'upload' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: enrollMethod === 'upload' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Upload size={13} /> Upload Photos
              </button>
            </div>
          </div>

          {/* Visual Input / Viewport Area */}
          {enrollMethod === 'camera' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* 5-Direction Progress Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {SCAN_DIRECTIONS.map((dir, idx) => {
                  const isActive = isScanning && currentPhaseIndex === idx;
                  const isDone = isScanning && currentPhaseIndex > idx;
                  return (
                    <div
                      key={dir.id}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        backgroundColor: isActive ? dir.color : (isDone ? '#DCFCE7' : '#F1F5F9'),
                        color: isActive ? '#FFFFFF' : (isDone ? '#15803D' : '#64748B'),
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? `0 4px 12px ${dir.color}40` : 'none',
                        border: isActive ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent'
                      }}
                    >
                      {dir.order}
                    </div>
                  );
                })}
              </div>

              {/* Video Camera Container with Live 5-Second HUD Overlay */}
              <div style={{
                background: '#04060A',
                border: isScanning ? '2.5px solid #10B981' : '1px solid #CBD5E1',
                borderRadius: '16px',
                overflow: 'hidden',
                aspectRatio: '16 / 10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'border-color 0.2s ease'
              }}>
                {stream ? (
                  <>
                    <video
                      ref={videoRef}
                      muted
                      autoPlay
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Biometric Head Silhouette Frame Overlay */}
                    <div style={{
                      position: 'absolute',
                      width: '210px',
                      height: '270px',
                      border: isScanning ? '3px dashed #10B981' : '2px dashed rgba(255, 255, 255, 0.4)',
                      borderRadius: '50% 50% 45% 45%',
                      pointerEvents: 'none',
                      animation: isScanning ? 'pulse 1s infinite' : 'none'
                    }} />

                    {/* Crosshair Center Reference */}
                    <div style={{
                      position: 'absolute',
                      width: '24px',
                      height: '24px',
                      borderLeft: '1.5px solid rgba(255,255,255,0.5)',
                      borderRight: '1.5px solid rgba(255,255,255,0.5)',
                      pointerEvents: 'none'
                    }} />
                    <div style={{
                      position: 'absolute',
                      width: '24px',
                      height: '24px',
                      borderTop: '1.5px solid rgba(255,255,255,0.5)',
                      borderBottom: '1.5px solid rgba(255,255,255,0.5)',
                      pointerEvents: 'none'
                    }} />

                    {/* Active Scanning Live Order Banner */}
                    {isScanning && (
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(8px)',
                        padding: '10px 20px',
                        borderRadius: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#FFFFFF',
                        border: `1.5px solid ${activeDirection.color}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 10,
                        animation: 'bounce 0.8s infinite alternate'
                      }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: activeDirection.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF'
                        }}>
                          <ActiveIcon size={18} strokeWidth={2.6} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.02em' }}>
                          {activeDirection.title}
                        </span>
                      </div>
                    )}

                    {/* Timer & Samples Badge */}
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '14px',
                      right: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '100px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)'
                      }}>
                        {isScanning ? `⏱ ${scanTimeRemaining}s Remaining` : 'Camera Active'}
                      </span>

                      {isScanning && (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '100px',
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          backdropFilter: 'blur(4px)'
                        }}>
                          {capturedCount} Samples Captured
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                    <Camera size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Camera Hardware Standby</div>
                    <div style={{ fontSize: '11px', marginTop: '4px', color: '#64748B' }}>
                      Click "Start Camera" to launch optical preview for 5-second multi-angle scan
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Camera Start / Stop Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {!stream ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #CBD5E1',
                      color: '#0F172A',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Camera size={14} />
                    <span>Start Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #FCA5A5',
                      color: '#DC2626',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <CameraOff size={14} />
                    <span>Pause Camera</span>
                  </button>
                )}

                <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Covers: Centre, Right, Left, Top, Down (5 sec)
                </span>
              </div>

              {/* Live Captured Thumbnails Strip */}
              {collectedSampleThumbs.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  padding: '8px 0',
                  borderTop: '1px solid #F1F5F9'
                }}>
                  {collectedSampleThumbs.map((thumb, idx) => (
                    <div key={idx} style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '2px solid #10B981',
                      flexShrink: 0
                    }}>
                      <img src={thumb} alt="sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#F8FAFC',
                  border: '1.5px dashed #CBD5E1',
                  borderRadius: '16px',
                  padding: '28px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Upload size={32} color="#0F5132" />
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                  Click to select face photos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  Upload between 1 and 15 images covering front, left, and right angles
                </div>
              </div>

              {uploadedImages.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
                    SELECTED PHOTOS ({uploadedImages.length}):
                  </div>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {uploadedImages.map((src, idx) => (
                      <div key={idx} style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #10B981', flexShrink: 0 }}>
                        <img src={src} alt="Face sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Controls */}
          <form
            onSubmit={enrollMethod === 'camera' ? executeFiveSecondScan : handleEnrollUploaded}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}
          >
            <div>
              <label htmlFor="person-name" style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
                PERSON'S FULL NAME
              </label>
              <input
                id="person-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                disabled={isScanning || isEnrolling}
                placeholder="e.g. Mohd Sahil, Alok, Faisal"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#0F172A',
                  outline: 'none'
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '12px', lineHeight: 1.4, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consentRecorded}
                onChange={(e) => setConsentRecorded(e.target.checked)}
                disabled={isScanning || isEnrolling}
                style={{ marginTop: '2px', accentColor: '#0F5132', cursor: 'pointer' }}
              />
              <span>
                I confirm this person explicitly consented to biometric enrollment and continuous optical identification for safety compliance.
              </span>
            </label>

            {/* Notification Alerts */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                fontSize: '12px'
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
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                fontSize: '12px'
              }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            {enrollMethod === 'camera' ? (
              <button
                type="submit"
                disabled={isScanning || isEnrolling || !name.trim() || !consentRecorded}
                style={{
                  marginTop: '4px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  backgroundColor: '#0F5132',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: (isScanning || isEnrolling || !name.trim() || !consentRecorded) ? 'not-allowed' : 'pointer',
                  opacity: (isScanning || isEnrolling || !name.trim() || !consentRecorded) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(15, 81, 50, 0.25)'
                }}
              >
                <Scan size={16} />
                <span>
                  {isScanning
                    ? `SCANNING FACE: ${activeDirection.title.toUpperCase()} (${scanTimeRemaining}s)...`
                    : (isEnrolling ? 'TRAINING BIOMETRIC MODEL...' : 'START 5-SECOND MULTI-ANGLE SCAN & ENROLL')}
                </span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isEnrolling || !name.trim() || !consentRecorded || uploadedImages.length === 0}
                style={{
                  marginTop: '4px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  backgroundColor: '#0F5132',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: (isEnrolling || !name.trim() || !consentRecorded || uploadedImages.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (isEnrolling || !name.trim() || !consentRecorded || uploadedImages.length === 0) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <UserPlus size={16} />
                <span>{isEnrolling ? 'TRAINING MODEL...' : 'ENROLL FROM UPLOADED PHOTOS'}</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '11px' }}>
              <ShieldCheck size={14} color="#0F5132" />
              <span>
                Facial landmark vectors are encrypted with AES-256 and stored locally in the secure biometric store.
              </span>
            </div>
          </form>
        </section>

        {/* Right Column: Enrolled People Directory */}
        <section style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Enrolled Personnel Directory ({people.length})
              </h2>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Authorized workers eligible for live identification & automatic attendance logging
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enrolled personnel..."
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>

          {/* Personnel List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '480px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '12.5px' }}>
                Loading enrolled profiles...
              </div>
            ) : filteredPeople.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '12.5px' }}>
                {searchQuery ? 'No enrolled people match this search query.' : 'No personnel profiles enrolled yet.'}
              </div>
            ) : (
              filteredPeople.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#0F5132',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '13px'
                    }}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>ID #{p.id}</span>
                        <span>•</span>
                        <span style={{ color: '#16A34A', fontWeight: 700 }}>Biometric Active</span>
                        {p.visit_count ? (
                          <>
                            <span>•</span>
                            <span>{p.visit_count} visit(s) logged</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(p)}
                    title="Remove Profile"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#FEE2E2',
                      border: 'none',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
