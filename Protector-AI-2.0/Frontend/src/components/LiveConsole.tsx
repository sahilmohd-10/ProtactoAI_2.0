import React, { useState, useEffect, useRef } from 'react';
import type { Camera as CameraType, CameraWorkerStatus } from '../types';
import { api } from '../services/api';

interface LiveConsoleProps {
  cameras: CameraType[];
  onRefreshIncidents: () => void;
}

export const LiveConsole: React.FC<LiveConsoleProps> = ({ cameras, onRefreshIncidents }) => {
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam_01');
  const confidence = 0.45;

  // Real Camera Access Modes: 'hardware' (Device 0 via OpenCV Stream) vs 'browser' (Direct getUserMedia WebRTC)
  const [cameraMode, setCameraMode] = useState<'hardware' | 'browser'>('hardware');
  const [browserStream, setBrowserStream] = useState<MediaStream | null>(null);
  const [browserCamError, setBrowserCamError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState<boolean>(false);
  const [isConnectingCam, setIsConnectingCam] = useState<boolean>(false);
  const [browserMetrics, setBrowserMetrics] = useState<{
    workers: number;
    violations: number;
    compliance_rate: number;
    detections: any[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isInferringRef = useRef<boolean>(false);

  // Persistent Background Camera Worker State (Hardware Device)
  const [workerStatus, setWorkerStatus] = useState<CameraWorkerStatus | null>(null);
  const [workerLoading, setWorkerLoading] = useState<boolean>(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [streamEpoch, setStreamEpoch] = useState<number>(Date.now());

  // Poll authoritative backend camera status
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const st = await api.getCameraWorkerStatus(selectedCameraId);
        if (isMounted) {
          setWorkerStatus(st);
        }
      } catch {
        // quiet poll
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedCameraId]);

  // Switch to Hardware OpenCV sensor (Device 0) seamlessly & start live monitoring
  const switchToHardware = async () => {
    setWorkerLoading(true);

    try {
      // 1. Release browser webcam tracks
      if (browserStream) {
        browserStream.getTracks().forEach((track) => track.stop());
        if (videoRef.current?.srcObject === browserStream) {
          videoRef.current.srcObject = null;
        }
        setBrowserStream(null);
        // Give the browser time to release the device before OpenCV opens it.
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setBrowserCamError(null);
      setShowPermissionGuide(false);
      setCameraMode('hardware');
      setSelectedCameraId('cam_01');
      setStreamEpoch(Date.now());

      // 2. Start hardware camera worker on backend
      setWorkerError(null);
      const res = await api.startCameraWorker('cam_01');
      if (res.status) {
        setWorkerStatus(res.status);
      }
      setStreamEpoch(Date.now());
      onRefreshIncidents();
    } catch (err: any) {
      setWorkerError(err.message || 'Failed to start hardware camera.');
    } finally {
      setWorkerLoading(false);
    }
  };

  // Handle Browser WebCam Stream Lifecycle with automatic hardware release and error categorization
  const startBrowserCamera = async () => {
    if (isConnectingCam) return;
    if (browserStream?.getVideoTracks().some((track) => track.readyState === 'live')) {
      setCameraMode('browser');
      return;
    }

    try {
      setIsConnectingCam(true);
      setBrowserCamError(null);

      if (browserStream) {
        browserStream.getTracks().forEach((track) => track.stop());
        if (videoRef.current?.srcObject === browserStream) {
          videoRef.current.srcObject = null;
        }
        setBrowserStream(null);
      }

      // 1. Release backend OpenCV device 0 handle so Windows DirectShow unlocks the physical camera for the browser
      try {
        await api.releaseHardwareCamera(selectedCameraId);
        await new Promise((r) => setTimeout(r, 350));
      } catch {
        // quiet fallback
      }

      setWorkerStatus((prev) => prev ? { ...prev, status: 'Stopped' } : null);

      // 2. Check Permissions API if supported
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as any });
          if (perm.state === 'denied') {
            setBrowserCamError('Permission denied');
            setShowPermissionGuide(true);
            setCameraMode('hardware');
            setIsConnectingCam(false);
            return;
          }
        } catch {
          // quiet fallback
        }
      }

      // 3. Request client camera media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setBrowserStream(stream);
      setCameraMode('browser');
      setBrowserCamError(null);
      setShowPermissionGuide(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('denied');

      const isNotFound =
        err?.name === 'NotFoundError' ||
        err?.name === 'DevicesNotFoundError' ||
        errMsg.toLowerCase().includes('not found');

      const isBusy =
        err?.name === 'NotReadableError' ||
        err?.name === 'TrackStartError' ||
        errMsg.toLowerCase().includes('in use') ||
        errMsg.toLowerCase().includes('busy');

      if (isDenied) {
        setBrowserCamError('Permission denied');
        setShowPermissionGuide(true);
      } else if (isNotFound) {
        setBrowserCamError('No webcam device found on this system.');
      } else if (isBusy) {
        setBrowserCamError('Camera device is busy or in use by another application.');
      } else {
        setBrowserCamError(errMsg || 'Browser camera access was denied or device is busy.');
      }
      setCameraMode('hardware');
    } finally {
      setIsConnectingCam(false);
    }
  };

  const stopBrowserCamera = () => {
    if (browserStream) {
      browserStream.getTracks().forEach((track) => track.stop());
      if (videoRef.current?.srcObject === browserStream) {
        videoRef.current.srcObject = null;
      }
      setBrowserStream(null);
    }
    setCameraMode('hardware');
  };

  // Connect video element to stream when stream becomes available
  useEffect(() => {
    if (cameraMode === 'browser' && videoRef.current && browserStream) {
      videoRef.current.srcObject = browserStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraMode, browserStream]);

  // Clean up browser camera stream on unmount
  useEffect(() => {
    return () => {
      if (browserStream) {
        browserStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [browserStream]);

  // Real-time YOLOv8 Inference loop for Direct Browser WebCam
  useEffect(() => {
    if (cameraMode !== 'browser' || !browserStream) return;

    let intervalId: any = null;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 640;
    offscreenCanvas.height = 360;
    const offCtx = offscreenCanvas.getContext('2d');

    const runInference = async () => {
      if (!videoRef.current || isInferringRef.current) return;
      if (videoRef.current.readyState < 2) return;

      isInferringRef.current = true;
      try {
        if (offCtx) {
          offCtx.drawImage(videoRef.current, 0, 0, 640, 360);
          offscreenCanvas.toBlob(async (blob) => {
            if (!blob) {
              isInferringRef.current = false;
              return;
            }
            try {
              const res = await api.detectFrame(blob, confidence);
              if (res && res.metrics) {
                setBrowserMetrics(res.metrics);
                drawDetections(res.metrics.detections || [], res.metrics.recognized_worker);
                if (res.metrics.violations && res.metrics.violations > 0) {
                  onRefreshIncidents();
                }
              }
            } catch {
              // ignore transient frame inference errors
            } finally {
              isInferringRef.current = false;
            }
          }, 'image/jpeg', 0.7);
        }
      } catch {
        isInferringRef.current = false;
      }
    };

    const drawDetections = (detections: any[], recognizedWorker?: string) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scaleX = canvas.width / 640;
      const scaleY = canvas.height / 360;

      // Draw identified worker badge at top-left
      if (recognizedWorker) {
        const idText = `IDENTIFIED: ${recognizedWorker.toUpperCase()}`;
        ctx.font = 'bold 12px monospace';
        const textWidth = ctx.measureText(idText).width;
        ctx.fillStyle = 'rgba(5, 7, 11, 0.88)';
        ctx.fillRect(16, 16, textWidth + 30, 28);
        ctx.strokeStyle = '#34C759';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(16, 16, textWidth + 30, 28);
        ctx.fillStyle = '#34C759';
        ctx.beginPath();
        ctx.arc(28, 30, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(idText, 40, 34);
      }

      detections.forEach((det: any) => {
        const [x1, y1, x2, y2] = det.box;
        const boxX = x1 * scaleX;
        const boxY = y1 * scaleY;
        const boxW = (x2 - x1) * scaleX;
        const boxH = (y2 - y1) * scaleY;

        const isViolation = det.is_violation;
        const color = isViolation ? '#FF4D4D' : '#D7FF64';

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        const labelText = `${det.label} ${Math.round(det.confidence * 100)}%`;
        ctx.font = 'bold 12px monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = isViolation ? 'rgba(255, 77, 77, 0.9)' : 'rgba(215, 255, 100, 0.9)';
        ctx.fillRect(boxX, Math.max(0, boxY - 20), textWidth + 8, 20);

        ctx.fillStyle = '#05070B';
        ctx.fillText(labelText, boxX + 4, Math.max(14, boxY - 5));
      });
    };

    intervalId = setInterval(runInference, 450);
    return () => {
      clearInterval(intervalId);
    };
  }, [cameraMode, browserStream, confidence]);

  const handleStartAnalysis = async () => {
    try {
      setWorkerLoading(true);
      setWorkerError(null);
      const res = await api.startCameraWorker(selectedCameraId);
      if (res.status) {
        setWorkerStatus(res.status);
      }
      setStreamEpoch(Date.now());
      onRefreshIncidents();
    } catch (err: any) {
      setWorkerError(err.message || 'Failed to start camera monitoring session.');
    } finally {
      setWorkerLoading(false);
    }
  };

  const handleStopAnalysis = async () => {
    try {
      setWorkerLoading(true);
      setWorkerError(null);
      const res = await api.stopCameraWorker(selectedCameraId);
      if (res.status) {
        setWorkerStatus(res.status);
      }
      setStreamEpoch(Date.now());
    } catch (err: any) {
      setWorkerError(err.message || 'Failed to stop camera monitoring session.');
    } finally {
      setWorkerLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const targetClasses = ['Person', 'Hardhat', 'NO-Hardhat', 'Safety Vest', 'NO-Safety Vest', 'Mask', 'NO-Mask', 'Gloves'];
  const streamUrl = `${api.getVideoFeedUrl(selectedCameraId, confidence, targetClasses)}&_t=${streamEpoch}`;

  const isWorkerRunning = workerStatus?.status === 'Running';
  const isWorkerTransitioning = workerStatus?.status === 'Starting' || workerStatus?.status === 'Stopping' || workerLoading;

  // Active metrics calculation
  const isFeedActive = cameraMode === 'browser' ? !!browserStream : isWorkerRunning;

  const rawWorkers =
    cameraMode === 'browser'
      ? (browserMetrics as any)?.recognized_workers || ((browserMetrics as any)?.recognized_worker ? [(browserMetrics as any).recognized_worker] : [])
      : (workerStatus?.metrics as any)?.recognized_workers || ((workerStatus?.metrics as any)?.recognized_worker ? [(workerStatus?.metrics as any).recognized_worker] : []);

  const isUnregisteredOrUnassigned = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes('unregistered') || 
           lower.includes('unassigned') || 
           lower.includes('unsigned') || 
           lower.includes('unknown');
  };

  const rawWorkersList: string[] = Array.isArray(rawWorkers)
    ? rawWorkers.flatMap((w: string) => (typeof w === 'string' ? w.split(',') : [String(w)])).map((s) => s.trim()).filter(Boolean)
    : (typeof rawWorkers === 'string' ? (rawWorkers as string).split(',').map((s) => s.trim()).filter(Boolean) : []);

  // Filter out any unsigned/unregistered/unknown workers so only verified enrolled personnel appear
  const activeRecognizedWorkers: string[] = rawWorkersList.filter((w) => !isUnregisteredOrUnassigned(w));

  const activeRecognizedWorker = activeRecognizedWorkers.join(', ');

  const activeWorkers = !isFeedActive
    ? 0
    : cameraMode === 'browser'
    ? Math.max(browserMetrics?.workers ?? (activeRecognizedWorkers.length > 0 ? activeRecognizedWorkers.length : 1), activeRecognizedWorkers.length)
    : Math.max(workerStatus?.metrics?.workers || selectedCamera?.current_workers || (activeRecognizedWorkers.length > 0 ? activeRecognizedWorkers.length : 1), activeRecognizedWorkers.length);

  const activeViolations = !isFeedActive
    ? 0
    : cameraMode === 'browser'
    ? (browserMetrics?.violations ?? 0)
    : (workerStatus?.metrics?.violations || selectedCamera?.current_violations || 0);

  const activeCompliance = !isFeedActive
    ? 100.0
    : cameraMode === 'browser'
    ? (browserMetrics?.compliance_rate ?? 100.0)
    : (workerStatus?.metrics?.compliance_rate || selectedCamera?.current_compliance || 95.6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Console Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Live Camera Surveillance
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Active optical sensor stream and computer vision hazard detection.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Camera Source Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={switchToHardware}
              disabled={workerLoading || isConnectingCam}
              style={{
                background: cameraMode === 'hardware' ? 'var(--bg-surface)' : 'transparent',
                border: cameraMode === 'hardware' ? '1px solid var(--border-strong)' : '1px solid transparent',
                color: cameraMode === 'hardware' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: workerLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: cameraMode === 'hardware' && isWorkerRunning ? '#22C55E' : 'var(--text-tertiary)'
              }} />
              {workerLoading && cameraMode === 'hardware' ? 'Connecting...' : 'Device 0 (Hardware)'}
            </button>

            <button
              type="button"
              onClick={startBrowserCamera}
              disabled={isConnectingCam || workerLoading}
              style={{
                background: cameraMode === 'browser' ? 'var(--bg-surface)' : 'transparent',
                border: cameraMode === 'browser' ? '1px solid var(--border-strong)' : '1px solid transparent',
                color: cameraMode === 'browser' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isConnectingCam ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: cameraMode === 'browser' && browserStream ? '#22C55E' : 'var(--text-tertiary)'
              }} />
              {isConnectingCam ? 'Connecting...' : 'Browser WebCam'}
            </button>
          </div>

          {/* Start / Stop Stream Action */}
          {cameraMode === 'browser' ? (
            <button
              type="button"
              onClick={stopBrowserCamera}
              className="btn-danger"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Disconnect WebCam
            </button>
          ) : isWorkerRunning ? (
            <button
              type="button"
              onClick={handleStopAnalysis}
              disabled={isWorkerTransitioning}
              className="btn-danger"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                cursor: isWorkerTransitioning ? 'not-allowed' : 'pointer'
              }}
            >
              {workerLoading ? 'Stopping...' : 'Stop Monitoring'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isWorkerTransitioning}
              className="btn-citron"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                cursor: isWorkerTransitioning ? 'not-allowed' : 'pointer'
              }}
            >
              {workerLoading ? 'Starting...' : 'Start Monitoring'}
            </button>
          )}
        </div>
      </div>

      {/* Camera Warnings / Notices */}
      {browserCamError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '6px',
          backgroundColor: 'var(--safety-violation-bg)',
          border: '1px solid var(--safety-violation-border)',
          gap: '12px'
        }}>
          <div style={{ fontSize: '12.5px', color: 'var(--safety-violation)' }}>
            <strong>Camera Error: </strong>{browserCamError}
          </div>
          <button
            type="button"
            onClick={() => setBrowserCamError(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {workerError && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '6px',
          backgroundColor: 'var(--safety-violation-bg)',
          border: '1px solid var(--safety-violation-border)',
          fontSize: '12.5px',
          color: 'var(--safety-violation)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{workerError}</span>
          <button
            onClick={() => setWorkerError(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Video Stream + Side Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '18px' }}>
        {/* Left: Video Feed & Camera Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              position: 'relative',
              backgroundColor: '#000000',
              border: '1px solid var(--border-medium)',
              borderRadius: '8px',
              overflow: 'hidden',
              aspectRatio: '16 / 9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            {/* Top Video HUD Bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '10px 16px',
              background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, transparent 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: isFeedActive ? '#22C55E' : 'var(--text-tertiary)'
                }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                  {cameraMode === 'browser'
                    ? (browserStream ? 'Client WebCam (Live)' : 'WebCam Standby')
                    : isWorkerRunning
                    ? (selectedCamera?.id === 'cam_01' ? 'Hardware Camera 01 (Live)' : `${selectedCamera?.name}`)
                    : 'Monitoring Stopped'}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {cameraMode === 'browser'
                    ? '(Browser Stream)'
                    : isWorkerRunning
                    ? '(DirectShow 0)'
                    : '(Standby)'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeRecognizedWorker && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(34, 197, 94, 0.25)',
                    border: '1px solid rgba(34, 197, 94, 0.5)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>Identified: {activeRecognizedWorker}</span>
                  </span>
                )}
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                  YOLOv8
                </span>
              </div>
            </div>

            {/* Video Feed Canvas Content */}
            {cameraMode === 'browser' ? (
              browserStream ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none'
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#333333' }} />
                  <span style={{ fontSize: '12px' }}>Camera Disconnected</span>
                </div>
              )
            ) : !isWorkerRunning ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#333333' }} />
                <span style={{ fontSize: '12px' }}>Monitoring Paused</span>
              </div>
            ) : selectedCamera?.status === 'offline' ? (
              <div style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--safety-violation)' }}>
                  Camera Offline
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '320px', margin: 0 }}>
                  {selectedCamera.name} is unreachable. Switch to Camera 01 for live video.
                </p>
                <button
                  onClick={() => setSelectedCameraId('cam_01')}
                  className="btn-secondary"
                  style={{ marginTop: '4px', fontSize: '11.5px', padding: '5px 12px' }}
                >
                  Switch to Camera 01
                </button>
              </div>
            ) : (
              <img
                key={`stream-${selectedCameraId}-${streamEpoch}`}
                src={streamUrl}
                alt="Live Safety Stream"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.stream-fallback')) {
                    const div = document.createElement('div');
                    div.className = 'stream-fallback';
                    div.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:8px; color:var(--text-secondary);';
                    div.innerHTML = `<span style="font-size:12px;">Connecting to hardware camera (Device 0)...</span>`;
                    parent.appendChild(div);
                  }
                }}
              />
            )}
          </div>

          {/* Camera Feeds Selector */}
          <div className="precision-surface" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                AVAILABLE CAMERAS
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {cameras.filter(c => c.status === 'online').length}/{cameras.length} Online
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {/* Direct WebCam */}
              <button
                type="button"
                onClick={startBrowserCamera}
                disabled={isConnectingCam}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: cameraMode === 'browser' ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: cameraMode === 'browser' ? 'var(--accent-citron)' : 'var(--border-subtle)',
                  cursor: isConnectingCam ? 'not-allowed' : 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: cameraMode === 'browser' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    Browser WebCam
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Client Video
                  </div>
                </div>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: cameraMode === 'browser' && browserStream ? '#22C55E' : 'var(--text-tertiary)'
                }} />
              </button>

              {/* Hardware Fleet */}
              {cameras.map((cam) => {
                const isRealHardware = cam.id === 'cam_01' || cam.stream_source === '0';
                const isSelected = cameraMode === 'hardware' && cam.id === selectedCameraId;
                const isOnline = cam.status === 'online';

                return (
                  <button
                    key={cam.id}
                    disabled={workerLoading || isConnectingCam}
                    onClick={() => {
                      switchToHardware();
                      setSelectedCameraId(cam.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent-citron)' : 'var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {isRealHardware ? 'Hardware Camera 01' : cam.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {cam.location}
                      </div>
                    </div>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isOnline ? '#22C55E' : 'var(--safety-violation)'
                    }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Compliance Card */}
          <div className="precision-surface" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              PPE COMPLIANCE
            </span>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0' }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 700,
                color: activeViolations > 0 ? 'var(--safety-violation)' : 'var(--safety-safe)',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1
              }}>
                {Math.round(activeCompliance)}%
              </span>
              <span className={`status-pill ${activeViolations > 0 ? 'status-pill-violation' : 'status-pill-safe'}`}>
                {activeViolations > 0 ? 'Violations Active' : 'Compliant'}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Workers
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {activeWorkers}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Violations
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: activeViolations > 0 ? 'var(--safety-violation)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {activeViolations}
                </div>
              </div>
            </div>

            {/* Identified Workers Section */}
            {activeRecognizedWorkers.length > 0 && (
              <div style={{
                marginTop: '14px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--safety-safe)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    {activeRecognizedWorkers.length > 1 ? `Identified Personnel (${activeRecognizedWorkers.length})` : 'Identified Personnel'}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--safety-safe)', fontWeight: 500 }}>
                    ✓ Marked Present
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeRecognizedWorkers.map((name, idx) => (
                    <span key={idx} style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--safety-safe)' }} />
                      <span>{name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
