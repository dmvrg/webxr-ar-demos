import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

export function SetupXRScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x505050);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 1.6, 3);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    shadowMap: {
      enabled: true,
      type: THREE.PCFSoftShadowMap
    }
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const xrRoot = new THREE.Group();
  xrRoot.visible = false;
  scene.add(xrRoot);

  const xrButton = XRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] });
  xrButton.style.display = 'none';
  document.body.appendChild(xrButton);

  // Make entire page clickable for entering WebXR
  document.body.style.cursor = 'pointer';
  document.body.addEventListener('click', () => {
    xrButton.click();
  });

  // Add visual feedback for clickable area
  document.body.style.transition = 'background-color 0.3s ease';
  document.body.addEventListener('mouseenter', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  });
  document.body.addEventListener('mouseleave', () => {
    document.body.style.backgroundColor = '';
  });

  const clock = new THREE.Clock();
  const startCbs = [];
  const endCbs = [];

  let xrSessionStartTime = null;
  let compositionPositioned = false;

  renderer.xr.addEventListener('sessionstart', () => {
    xrSessionStartTime = Date.now();
    compositionPositioned = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
    document.body.classList.add('xr-presenting');
    xrRoot.visible = true;
    startCbs.forEach(fn => fn());
  });

  renderer.xr.addEventListener('sessionend', () => {
    xrSessionStartTime = null;
    compositionPositioned = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.classList.remove('xr-presenting');
    xrRoot.visible = false;
    endCbs.forEach(fn => fn());
  });

  function onXRSessionStart(fn) {
    startCbs.push(fn);
  }

  function onXRSessionEnd(fn) {
    endCbs.push(fn);
  }

  function positionCompositionAtHeadHeight(baseComposition) {
    if (compositionPositioned || !xrSessionStartTime || !baseComposition) return;
    
    const elapsedTime = Date.now() - xrSessionStartTime;
    if (elapsedTime < 1000) {
      return;
    }
    
    const headHeight = camera.position.y;
    const headDistance = camera.position.z;
    
    baseComposition.position.set(0, headHeight - 0.2, headDistance - 1.0);
    compositionPositioned = true;
  }

  function getXRSessionStartTime() {
    return xrSessionStartTime;
  }

  function isCompositionPositioned() {
    return compositionPositioned;
  }

  return {
    scene,
    camera,
    renderer,
    xrRoot,
    clock,
    onXRSessionStart,
    onXRSessionEnd,
    positionCompositionAtHeadHeight,
    getXRSessionStartTime,
    isCompositionPositioned
  };
}
