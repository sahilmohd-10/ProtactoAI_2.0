import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SpinningDevice3DProps {
  size?: number;
}

export const SpinningDevice3D: React.FC<SpinningDevice3DProps> = ({ size = 280 }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 3.2, 4.8);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      mount.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('WebGL init error:', e);
      return;
    }

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(4, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 2.2); // Cool blue industrial rim light
    dirLight2.position.set(-5, 3, -4);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x60a5fa, 1.5, 10);
    pointLight.position.set(0, 1.5, 1);
    scene.add(pointLight);

    // 3. 3D Device Geometry & Materials (matching Image 3 Hardware)
    const deviceGroup = new THREE.Group();

    // Dark graphite chassis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.28
    });

    const bodyGeo = new THREE.CylinderGeometry(1.7, 1.78, 0.42, 64);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    deviceGroup.add(bodyMesh);

    // Inner top face disc
    const topPlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2
    });
    const topPlateGeo = new THREE.CylinderGeometry(1.62, 1.62, 0.05, 64);
    const topPlateMesh = new THREE.Mesh(topPlateGeo, topPlateMat);
    topPlateMesh.position.y = 0.22;
    deviceGroup.add(topPlateMesh);

    // Raised LIDAR Turret Tower
    const turretMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.3
    });
    const turretGeo = new THREE.CylinderGeometry(0.72, 0.76, 0.32, 48);
    const turretMesh = new THREE.Mesh(turretGeo, turretMat);
    turretMesh.position.y = 0.38;
    deviceGroup.add(turretMesh);

    // Lens Bezel Ring
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.95,
      roughness: 0.15
    });
    const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 16, 48);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.54;
    deviceGroup.add(ringMesh);

    // Optical Glass Lens element (Deep cobalt blue reflective dome)
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.95,
      roughness: 0.08
    });
    const lensGeo = new THREE.SphereGeometry(0.38, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.y = 0.5;
    deviceGroup.add(lensMesh);

    // Glowing Optical Pupil Center (Cyan light)
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
    const pupilGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.y = 0.68;
    deviceGroup.add(pupilMesh);

    // Glowing Neon Blue Sensor Arc
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const arcGeo = new THREE.TorusGeometry(0.58, 0.02, 16, 32, Math.PI * 0.75);
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.rotation.x = Math.PI / 2;
    arcMesh.rotation.z = Math.PI * 0.6;
    arcMesh.position.y = 0.54;
    deviceGroup.add(arcMesh);

    // Bumper Seams / Grooves
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const seamGeo = new THREE.BoxGeometry(0.08, 0.44, 0.35);
    const seam1 = new THREE.Mesh(seamGeo, seamMat);
    seam1.position.set(1.68, 0, 0);
    deviceGroup.add(seam1);

    const seam2 = new THREE.Mesh(seamGeo, seamMat);
    seam2.position.set(-1.68, 0, 0);
    deviceGroup.add(seam2);

    // Soft Contact Shadow Disc beneath
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55
    });
    const shadowGeo = new THREE.CircleGeometry(2.1, 48);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.25;
    scene.add(shadowMesh);

    // Tilt slightly towards camera so the top disc and lens are visible
    deviceGroup.rotation.x = 0.45;
    scene.add(deviceGroup);

    // 4. Interactive Dragging State
    let isDragging = false;
    let prevMouseX = 0;
    let mouseVelocity = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      prevMouseX = clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - prevMouseX;
      prevMouseX = clientX;
      deviceGroup.rotation.y += deltaX * 0.015;
      mouseVelocity = deltaX * 0.008;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 5. Continuous Smooth 3D Spin Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isDragging) {
        // Continuous 3D auto spin
        deviceGroup.rotation.y += 0.016 + mouseVelocity;
        mouseVelocity *= 0.94; // Smooth damping of mouse throw
      }

      // Gentle floating bob in 3D space
      const elapsed = clock.getElapsedTime();
      deviceGroup.position.y = Math.sin(elapsed * 2.2) * 0.06;
      shadowMesh.scale.setScalar(1 - Math.sin(elapsed * 2.2) * 0.04);

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);

      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (mount && renderer && dom.parentNode === mount) {
        mount.removeChild(dom);
      }

      renderer?.dispose();
      bodyGeo.dispose();
      topPlateGeo.dispose();
      turretGeo.dispose();
      ringGeo.dispose();
      lensGeo.dispose();
      pupilGeo.dispose();
      arcGeo.dispose();
      seamGeo.dispose();
      shadowGeo.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        touchAction: 'none'
      }}
    />
  );
};
