import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

import { GameState3D } from './GameState3D.js';
import { BoardView } from './BoardView.js';
import { EndGameUI } from './EndGameUI.js';
import { HandInput } from './HandInput.js';

// -------------------------------------
// GSAP config
// -------------------------------------
gsap.ticker.lagSmoothing(0);
gsap.ticker.fps(60);

// Optional: kill logs in production
// console.log = function () {};

// -------------------------------------
// Basic Three.js setup
// -------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  50
);
camera.position.set(0, 1.6, 3);
scene.add(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// XR button (hidden, full-page click to enter XR)
const xrButton = XRButton.createButton(renderer, {
  optionalFeatures: ['hand-tracking'],
});
xrButton.style.display = 'none';
xrButton.style.opacity = '0';
xrButton.style.visibility = 'hidden';
xrButton.style.pointerEvents = 'none';
xrButton.style.position = 'absolute';
xrButton.style.width = '0';
xrButton.style.height = '0';
xrButton.style.padding = '0';
xrButton.style.margin = '0';
xrButton.style.border = 'none';
xrButton.style.overflow = 'hidden';
document.body.appendChild(xrButton);

// Entire page enters XR on click
document.body.style.cursor = 'pointer';
document.body.addEventListener('click', () => {
  xrButton.click();
});

// Tiny hover feedback
document.body.addEventListener('mouseenter', () => {
  document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
});
document.body.addEventListener('mouseleave', () => {
  document.body.style.backgroundColor = '';
});

// -------------------------------------
// Lights 
// -------------------------------------
const ambientLight = new THREE.AmbientLight(0xb4c8ff, 1.4);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xfff0dd, 2.8);
keyLight.position.set(2, 4, 2);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xb4e5ff, 1.8);
fillLight.position.set(-3, 2, 1);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x8eb8ff, 1.2);
rimLight.position.set(-1, 3, -2);
scene.add(rimLight);

const groundLight = new THREE.DirectionalLight(0xffffff, 0.4);
groundLight.position.set(0, -3, 0);
scene.add(groundLight);

// -------------------------------------
// Materials 
// -------------------------------------
const orangeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xff9737,
  metalness: 0.25,
  roughness: 0.4,
  sheen: 0.6,
  sheenRoughness: 0.6,
  clearcoat: 0.45,
  clearcoatRoughness: 0.45,
  emissive: 0xff9737,
  emissiveIntensity: 0.25,
  envMapIntensity: 1.3,
});

const lightBlueMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x60aeff,
  metalness: 0.25,
  roughness: 0.4,
  emissive: 0x60aeff,
  emissiveIntensity: 0.25,
  clearcoat: 0.45,
  clearcoatRoughness: 0.45,
  envMapIntensity: 1.3,
});

// -------------------------------------
// GLTF loading helpers
// -------------------------------------
const gltfLoader = new GLTFLoader();

function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (error) => reject(error)
    );
  });
}

// -------------------------------------
// XR session → position board at head height
// -------------------------------------
let xrSessionStartTime = null;
let compositionPositioned = false;
let boardView = null; // will be set in startApp()

renderer.xr.addEventListener('sessionstart', () => {
  xrSessionStartTime = Date.now();
  compositionPositioned = false;
  document.body.classList.add('xr-presenting');
});

renderer.xr.addEventListener('sessionend', () => {
  xrSessionStartTime = null;
  compositionPositioned = false;
  document.body.classList.remove('xr-presenting');
});

function positionCompositionAtHeadHeight() {
  if (!xrSessionStartTime || compositionPositioned || !boardView?.baseComposition) return;

  const elapsed = Date.now() - xrSessionStartTime;
  if (elapsed < 1000) return; // wait ~1s after entering XR

  const headHeight = camera.position.y;
  const headDistance = camera.position.z;

  boardView.baseComposition.position.set(0, headHeight, headDistance - 1.0);
  compositionPositioned = true;
}

// -------------------------------------
// Main app bootstrap
// -------------------------------------
const clock = new THREE.Clock();

let gameState = null;
let endGameUI = null;
let handInput = null;

const MOVE_COOLDOWN = 800;
let lastMoveTime = 0;

// Load X/O models, then start
Promise.all([
  loadGLTF('/static/x.glb'),
  loadGLTF('/static/o.glb'),
]).then(([xGltf, oGltf]) => {
  const xModelTemplate = xGltf.scene;
  xModelTemplate.traverse((child) => {
    if (child.isMesh) {
      child.material = lightBlueMaterial;
    }
  });

  const oModelTemplate = oGltf.scene;
  oModelTemplate.traverse((child) => {
    if (child.isMesh) {
      child.material = orangeMaterial;
    }
  });

  startApp(xModelTemplate, oModelTemplate).catch((err) => {
    console.error('Error starting app:', err);
  });
}).catch((err) => {
  console.error('Error loading X/O models:', err);
  // You *could* still start with no X/O models if you want
});

// -------------------------------------
// Start the app once assets are ready
// -------------------------------------
async function startApp(xModelTemplate, oModelTemplate) {
  gameState = new GameState3D();

  // Board rendering
  boardView = new BoardView(scene, {
    orangeMaterial,
    lightBlueMaterial,
    xModelTemplate,
    oModelTemplate,
  });

  // Load the tic-tac-toe grid model
  await boardView.loadGridModel('/static/tictactoe.glb');

  // End-game UI
  endGameUI = new EndGameUI(boardView.baseComposition, {
    xModelTemplate,
    orangeMaterial,
    lightBlueMaterial,
  });

  // Hand input
  handInput = new HandInput(renderer, scene, {
    chairRotationSpeed: 4.0,
    maxUpDownRotation: Math.PI / 3,
  });

  // Let hand input know which plane is the button
  handInput.setButtonPlane(endGameUI.getButtonPlane());

  // Button press → animate + reset game
  endGameUI.onButtonPress(() => {
    resetGame();
  });

  // When hand input detects button hit, trigger UI press animation
  handInput.setButtonHitCallback(() => {
    endGameUI.triggerButtonPress();
  });

  // Hand pinch → place O + trigger AI, etc.
  handInput.setPlaceOCallback(({ hand, thumbWorldPos }) => {
    if (!boardView.baseGrid || gameState.isGameOver) return;

    const now = Date.now();
    if (now - lastMoveTime < MOVE_COOLDOWN) return;

    const nearestSphere = boardView.findNearestSphere(thumbWorldPos);
    if (!nearestSphere) return;
    if (!boardView.isSphereFree(nearestSphere.uuid)) return;

    const coords = boardView.getGridCoordsFromSphere(nearestSphere.uuid);
    if (!coords) return;

    // Update logical game state
    const moveResult = gameState.makeMove(coords.x, coords.y, coords.z, 'O');
    if (!moveResult.success) return;

    // Spawn visual O
    const worldPos = new THREE.Vector3();
    nearestSphere.getWorldPosition(worldPos);
    const localPos = boardView.worldToLocalOnGrid(worldPos);
    boardView.spawnO(localPos);

    nearestSphere.visible = false;
    boardView.markSphereUsed(nearestSphere.uuid, 'O');

    lastMoveTime = now;

    // Check winner (player)
    if (gameState.winner) {
        if (gameState.winner !== 'draw') {
          endGameUI.showWinner(gameState.winner);
  
          const line = gameState.getWinningLine();
          if (line) {
            boardView.showWinningLine(line.start, line.end);
          }
        }
        return;
    }

    // Computer turn (X) with small delay
    setTimeout(() => {
      if (gameState.isGameOver) return;

      const best = gameState.findBestMove('X');
      if (!best) return;

      const sphere = boardView.findSphereByGridPos(best.x, best.y, best.z);
      if (!sphere || !boardView.isSphereFree(sphere.uuid)) return;

      const compResult = gameState.makeMove(best.x, best.y, best.z, 'X');
      if (!compResult.success) return;

      const worldPos2 = new THREE.Vector3();
      sphere.getWorldPosition(worldPos2);
      const localPos2 = boardView.worldToLocalOnGrid(worldPos2);
      boardView.spawnX(localPos2);

      sphere.visible = false;
      boardView.markSphereUsed(sphere.uuid, 'X');

      if (gameState.winner && gameState.winner !== 'draw') {
        endGameUI.showWinner(gameState.winner);

        const line = gameState.getWinningLine();
        if (line) {
          boardView.showWinningLine(line.start, line.end);
        }
      }
    }, 500);
  });

  // Hand pinch drag → rotate board
  handInput.setRotateCallback(({ deltaX, deltaY, speed, maxUpDownRotation }) => {
    if (!boardView.baseGrid) return;

    // Horizontal rotation (Y axis)
    boardView.baseGrid.rotation.y += deltaX * speed;

    // Vertical rotation (X axis) with clamp
    const newX = boardView.baseGrid.rotation.x - deltaY * speed;
    const clampedX = Math.max(-maxUpDownRotation, Math.min(maxUpDownRotation, newX));
    boardView.baseGrid.rotation.x = clampedX;
  });

  // Start render loop

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
  
    gsap.ticker.tick(delta);
  
    handInput.update(delta);
    positionCompositionAtHeadHeight();
  
    renderer.render(scene, camera);
  });
  

}

// -------------------------------------
// Reset game state + visuals
// -------------------------------------
function resetGame() {
  // Reset logic
  gameState.reset();
  lastMoveTime = 0;

  // Reset visuals
  boardView.resetVisuals();
  endGameUI.hideAll();
}

// -------------------------------------
// Resize handling
// -------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
