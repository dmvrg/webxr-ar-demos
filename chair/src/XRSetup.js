import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

export function setupXR() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x505050);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    50
  );
  camera.position.set(0, 1.6, 3);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    alpha: false
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  document.body.appendChild(renderer.domElement);

  // Hidden XR button
  const xrButton = XRButton.createButton(renderer, {
    optionalFeatures: ['hand-tracking']
  });
  xrButton.style.display = 'none';

  // Clean up default XR/VR/AR buttons if any
  ['VRButton', 'ARButton', 'XRButton'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  document.querySelectorAll(
    '.vr-button, .ar-button, .webxr-button, .xr-button, ' +
      'button[aria-label="Enter VR"], button[aria-label="Enter XR"], button[aria-label="Enter AR"]'
  ).forEach(el => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // Full-page click = enter XR
  document.body.style.cursor = 'pointer';
  document.body.addEventListener('click', () => {
    xrButton.click();
  });

  // Subtle hover feedback
  document.body.style.transition = 'background-color 0.3s ease';
  document.body.addEventListener('mouseenter', () => {
    document.body.style.backgroundColor = 'rgba(0,0,0,0.1)';
  });
  document.body.addEventListener('mouseleave', () => {
    document.body.style.backgroundColor = '';
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  });

  return { scene, camera, renderer };
}

/**
 * Hook external callbacks into XR session lifecycle.
 */
export function attachXRSessionCallbacks(renderer, { onSessionStart, onSessionEnd } = {}) {
  renderer.xr.addEventListener('sessionstart', () => {
    onSessionStart && onSessionStart();
  });

  renderer.xr.addEventListener('sessionend', () => {
    onSessionEnd && onSessionEnd();
  });
}
