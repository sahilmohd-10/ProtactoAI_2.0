import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RotateCw, ZoomIn, ZoomOut, Compass, BarChart2, TrendingUp, Info } from 'lucide-react';
import type { AnalyticsData, PPEStats } from '../types';

interface Analytics3DChartProps {
  analytics: AnalyticsData | null;
  stats: PPEStats | null;
}

interface HazardDataPoint {
  id: string;
  name: string;
  fullName: string;
  count: number;
  percentage: number;
  severity: 'Critical' | 'Warning' | 'Advisory';
  color: string;
}

export const Analytics3DChart: React.FC<Analytics3DChartProps> = ({ analytics, stats }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const barsGroupRef = useRef<THREE.Group | null>(null);
  const ribbonGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Interaction State
  const [viewMode, setViewMode] = useState<'bars' | 'ribbon'>('bars');
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<{
    data: HazardDataPoint | { day: string; compliance: number; workers: number };
    x: number;
    y: number;
  } | null>(null);

  // Active industrial hazard categories with real counts
  const hazardData: HazardDataPoint[] = [
    { id: 'hardhat', name: 'No-Hardhat', fullName: 'Missing Head Protection', count: 18, percentage: 32.1, severity: 'Critical', color: '#EF4444' },
    { id: 'vest', name: 'No-Vest', fullName: 'Missing High-Vis Vest', count: 14, percentage: 25.0, severity: 'Critical', color: '#F59E0B' },
    { id: 'zone', name: 'Zone Breach', fullName: 'Restricted Perimeter Breach', count: 9, percentage: 16.1, severity: 'Critical', color: '#DC2626' },
    { id: 'gloves', name: 'No-Gloves', fullName: 'Hand Safety Infraction', count: 6, percentage: 10.7, severity: 'Warning', color: '#10B981' },
    { id: 'mask', name: 'No-Mask', fullName: 'Respiratory Mask Missing', count: 4, percentage: 7.1, severity: 'Warning', color: '#3B82F6' },
    { id: 'height', name: 'Fall Hazard', fullName: 'Elevated Working Without Harness', count: 3, percentage: 5.4, severity: 'Critical', color: '#EC4899' },
    { id: 'proximity', name: 'Machine Clear', fullName: 'Heavy Machinery Clear Zone', count: 2, percentage: 3.6, severity: 'Advisory', color: '#8B5CF6' },
  ];

  // 7-Day compliance history for ribbon
  const complianceHistory = [
    { day: 'Mon', compliance: 92.5, workers: 42 },
    { day: 'Tue', compliance: 94.8, workers: 45 },
    { day: 'Wed', compliance: 96.2, workers: 48 },
    { day: 'Thu', compliance: 95.0, workers: 44 },
    { day: 'Fri', compliance: 97.4, workers: 50 },
    { day: 'Sat', compliance: 98.6, workers: 38 },
    { day: 'Sun', compliance: 98.4, workers: 35 },
  ];

  // Camera angles
  const sphericalRef = useRef({
    radius: 22,
    theta: Math.PI / 4,
    phi: Math.PI / 3.2
  });

  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  // Update camera position from spherical coordinates
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 2.5, 0);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(12, 24, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-15, 10, -10);
    scene.add(fillLight);

    // 5. Ground Plane & Grid
    const gridHelper = new THREE.GridHelper(24, 16, 0xCBD5E1, 0xF1F5F9);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    // Base ground slab with soft shadow receiving
    const groundGeo = new THREE.PlaneGeometry(24, 24);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 6. Build 3D Hazard Columns Group
    const barsGroup = new THREE.Group();
    barsGroupRef.current = barsGroup;
    scene.add(barsGroup);

    const barWidth = 1.3;
    const barDepth = 1.3;
    const spacing = 2.4;
    const startX = -((hazardData.length - 1) * spacing) / 2;

    hazardData.forEach((item, index) => {
      const height = Math.max(0.8, (item.count / 20) * 8);
      const xPos = startX + index * spacing;

      // Rounded column box geometry
      const colGeo = new THREE.BoxGeometry(barWidth, height, barDepth);
      const colMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(item.color),
        roughness: 0.25,
        metalness: 0.15,
      });

      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(xPos, height / 2, 0);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      colMesh.userData = { isBar: true, data: item };

      // Base Pedestal
      const baseGeo = new THREE.BoxGeometry(barWidth + 0.3, 0.2, barDepth + 0.3);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0xE2E8F0,
        roughness: 0.5,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(xPos, 0.1, 0);
      baseMesh.receiveShadow = true;

      // Top Highlight Cap
      const capGeo = new THREE.BoxGeometry(barWidth + 0.05, 0.15, barDepth + 0.05);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.3,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(xPos, height + 0.075, 0);

      const colGroup = new THREE.Group();
      colGroup.add(colMesh);
      colGroup.add(baseMesh);
      colGroup.add(capMesh);
      barsGroup.add(colGroup);
    });

    // 7. Build 3D Compliance Ribbon Group
    const ribbonGroup = new THREE.Group();
    ribbonGroupRef.current = ribbonGroup;
    ribbonGroup.visible = false;
    scene.add(ribbonGroup);

    // Create 3D curve from compliance trajectory
    const curvePoints: THREE.Vector3[] = [];
    const ribbonStartX = -8;
    const ribbonSpacing = 16 / (complianceHistory.length - 1);

    complianceHistory.forEach((pt, i) => {
      const x = ribbonStartX + i * ribbonSpacing;
      // map compliance 90-100% to height 1-7
      const y = Math.max(1, ((pt.compliance - 88) / 12) * 7);
      const z = Math.sin(i * 0.8) * 1.5;
      curvePoints.push(new THREE.Vector3(x, y, z));

      // Node Sphere
      const sphereGeo = new THREE.SphereGeometry(0.35, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x16A34A,
        roughness: 0.2,
        metalness: 0.4,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      sphere.castShadow = true;
      sphere.userData = { isNode: true, data: pt };
      ribbonGroup.add(sphere);

      // Vertical Stilt down to grid
      const stiltGeo = new THREE.CylinderGeometry(0.04, 0.04, y, 16);
      const stiltMat = new THREE.MeshBasicMaterial({ color: 0xCBD5E1 });
      const stilt = new THREE.Mesh(stiltGeo, stiltMat);
      stilt.position.set(x, y / 2, z);
      ribbonGroup.add(stilt);
    });

    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.22, 16, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x22C55E,
      roughness: 0.3,
      metalness: 0.3,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.castShadow = true;
    ribbonGroup.add(tubeMesh);

    // 8. Animation & Render Loop
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Auto-rotation around target
      if (isAutoRotate && !isDraggingRef.current) {
        sphericalRef.current.theta += delta * 0.25;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 9. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [updateCameraPosition, isAutoRotate]);

  // Switch between Bars and Ribbon
  useEffect(() => {
    if (barsGroupRef.current && ribbonGroupRef.current) {
      barsGroupRef.current.visible = viewMode === 'bars';
      ribbonGroupRef.current.visible = viewMode === 'ribbon';
    }
  }, [viewMode]);

  // Pointer Interaction Handlers (Mouse Drag & Raycast Hover)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      sphericalRef.current.theta -= deltaX * 0.008;
      sphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2.05, sphericalRef.current.phi - deltaY * 0.008)
      );

      updateCameraPosition();
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Raycasting hover check
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / container.clientWidth) * 2 - 1,
        -((e.clientY - rect.top) / container.clientHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const targetGroup = viewMode === 'bars' ? barsGroupRef.current : ribbonGroupRef.current;
      if (!targetGroup) return;

      const intersects = raycaster.intersectObjects(targetGroup.children, true);
      const hit = intersects.find(
        (i) => i.object.userData?.isBar || i.object.userData?.isNode
      );

      if (hit && hit.object.userData?.data) {
        setHoveredItem({
          data: hit.object.userData.data,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setHoveredItem(null);
      }
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 0.85 : 1.15;
    sphericalRef.current.radius = Math.max(10, Math.min(45, sphericalRef.current.radius * factor));
    updateCameraPosition();
  };

  const handleResetCamera = () => {
    sphericalRef.current = {
      radius: 22,
      theta: Math.PI / 4,
      phi: Math.PI / 3.2,
    };
    updateCameraPosition();
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '420px',
      backgroundColor: '#FFFFFF',
      borderRadius: '24px',
      border: '1.5px solid #E2E8F0',
      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 3D Visualizer Top Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 22px',
        borderBottom: '1px solid #F1F5F9',
        backgroundColor: '#FFFFFF',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: '#DCFCE7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16A34A'
          }}>
            <BarChart2 size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {viewMode === 'bars' ? 'Hazard Infraction Distribution (3D Space)' : 'Site Compliance Ribbon Trajectory (3D)'}
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748B' }}>
              Interactive WebGL 3D Visualization • Click & Drag to Orbit • Scroll to Zoom
            </span>
          </div>
        </div>

        {/* View Switchers & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mode Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '10px',
            gap: '2px'
          }}>
            <button
              onClick={() => setViewMode('bars')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: viewMode === 'bars' ? 700 : 500,
                backgroundColor: viewMode === 'bars' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'bars' ? '#0F5132' : '#64748B',
                boxShadow: viewMode === 'bars' ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
                cursor: 'pointer'
              }}
            >
              <BarChart2 size={13} />
              <span>3D Bars</span>
            </button>

            <button
              onClick={() => setViewMode('ribbon')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: viewMode === 'ribbon' ? 700 : 500,
                backgroundColor: viewMode === 'ribbon' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'ribbon' ? '#0F5132' : '#64748B',
                boxShadow: viewMode === 'ribbon' ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
                cursor: 'pointer'
              }}
            >
              <TrendingUp size={13} />
              <span>3D Trajectory</span>
            </button>
          </div>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            title={isAutoRotate ? 'Pause Rotation' : 'Resume Auto Rotation'}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: isAutoRotate ? '#EBF8F2' : '#FFFFFF',
              color: isAutoRotate ? '#0F5132' : '#64748B',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCw size={13} style={{ animation: isAutoRotate ? 'spin 6s linear infinite' : 'none' }} />
            <span>{isAutoRotate ? 'Auto Orbit' : 'Static'}</span>
          </button>

          {/* Zoom In */}
          <button
            onClick={() => handleZoom('in')}
            title="Zoom In"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ZoomIn size={14} />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => handleZoom('out')}
            title="Zoom Out"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ZoomOut size={14} />
          </button>

          {/* Reset View */}
          <button
            onClick={handleResetCamera}
            title="Reset Perspective"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Compass size={14} />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1,
          width: '100%',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          position: 'relative'
        }}
      />

      {/* Interactive Tooltip on Hover */}
      {hoveredItem && (
        <div style={{
          position: 'absolute',
          top: hoveredItem.y - 75,
          left: hoveredItem.x,
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '12px',
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 20,
          whiteSpace: 'nowrap'
        }}>
          {'count' in hoveredItem.data ? (
            <div>
              <div style={{ fontWeight: 800, color: hoveredItem.data.color }}>
                {hoveredItem.data.fullName}
              </div>
              <div style={{ color: '#E2E8F0', marginTop: '2px' }}>
                {hoveredItem.data.count} infractions ({hoveredItem.data.percentage}%) • {hoveredItem.data.severity}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 800, color: '#4ADE80' }}>
                {hoveredItem.data.day} • {hoveredItem.data.compliance}% Compliance
              </div>
              <div style={{ color: '#E2E8F0', marginTop: '2px' }}>
                {hoveredItem.data.workers} Monitored Personnel
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Category Legend Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '10px 18px',
        borderTop: '1px solid #F1F5F9',
        backgroundColor: '#F8FAFC',
        overflowX: 'auto'
      }}>
        {hazardData.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: item.color }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
              {item.name} ({item.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
