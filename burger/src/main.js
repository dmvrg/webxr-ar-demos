import * as THREE from 'three';
import gsap from 'gsap';
import { SetupXRScene } from './XRScene.js';
import { CreateBurgerMaterials } from './BurgerMaterials.js';
import { LoadBurgerModels } from './BurgerModels.js';
import { CreateBurgerStack } from './BurgerStack.js';
import { CreateLights } from './Lights.js';
import { CreateBurgerUI } from './BurgerUI.js';
import { CreateHandTracking } from './HandTracking.js';

// Configure GSAP
gsap.ticker.lagSmoothing(0);
gsap.ticker.fps(60);

// Disable console logging in production
console.log = function() {};

// Initialize XR Scene
const { scene, camera, renderer, xrRoot, clock, onXRSessionStart, onXRSessionEnd, positionCompositionAtHeadHeight, isCompositionPositioned } = SetupXRScene();

// Initialize Materials
const { EnhanceModelMaterials } = CreateBurgerMaterials();

// Load Models
let models = null;
LoadBurgerModels(EnhanceModelMaterials).then(loadedModels => {
  models = loadedModels;
  initializeApp();
});

function initializeApp() {
  if (!models) return;

  // Create Lights
  const { mainLight, fitShadowCameraToObject } = CreateLights(xrRoot);

  // Create Burger Stack
  const burgerStack = CreateBurgerStack({
    scene,
    xrRoot,
    mainLight,
    bunTop: models.bunTop,
    bunBottom: models.bunBottom,
    onion: models.onion.clone(),
    tomato: models.tomato.clone(),
    lettuce: models.lettuce.clone(),
    cheese: models.cheese.clone(),
    patty: models.patty.clone()
  });

  const { baseComposition, root, cubeA, cubeB, parts, state, UpdateContentParts } = burgerStack;

  // Create UI
  const burgerUI = CreateBurgerUI({
    scene,
    xrRoot,
    switchStates: state.switchStates,
    cubeA,
    cubeB
  });

  const {
    mainUI,
    partUIs,
    openUIRef,
    partUIRefs,
    topArrowPlane,
    bottomArrowPlane,
    updateBurgerText,
    updateSwitchTexture,
    updateMainUIPosition,
    showMainUIWithAnimation,
    animateArrowPlanes,
    setSwitchStatesRef
  } = burgerUI;

  // Keep switchStates reference in sync
  setSwitchStatesRef(state.switchStates);

  // Connect UI callbacks to burger stack state
  state.OnSwitchToggle = (index, isOn) => {
    updateSwitchTexture(index, isOn);
    updateBurgerText();
    if (state.joined) {
      fitShadowCameraToObject(mainLight, root, 0.15);
    }
  };

  // Initial UI text update
  updateBurgerText();

  // Initial shadow frustum fit
  fitShadowCameraToObject(mainLight, root, 0.15);

  // Create Hand Tracking
  const handTracking = CreateHandTracking({
    scene,
    camera,
    renderer,
    xrRoot,
    root,
    cubeA,
    cubeB,
    parts,
    mainLight,
    state,
    mainUI,
    partUIs,
    openUIRef,
    topArrowPlane,
    bottomArrowPlane,
    UpdateMainUIPosition: () => updateMainUIPosition(camera),
    ShowMainUIWithAnimation: showMainUIWithAnimation,
    OnSwitchToggle: (index, newState) => {
      state.SetSwitchState(index, newState);
    },
    OnRejoin: () => {
      updateBurgerText();
      fitShadowCameraToObject(mainLight, root, 0.15);
    }
  });

  const {
    UpdateHandTracking,
    UpdateOpening,
    UpdateFreeMove,
    UpdateRejoin,
    UpdateOpenState,
    OnXRSessionStart,
    OnXRSessionEnd
  } = handTracking;

  // XR Session handlers
  let pinchDetectionEnabled = false;

  onXRSessionStart(() => {
    pinchDetectionEnabled = false;
    OnXRSessionStart();

    // Position UI after composition is positioned
    setTimeout(() => {
      if (!isCompositionPositioned()) return;

      const rootWorldPos = new THREE.Vector3();
      root.getWorldPosition(rootWorldPos);
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);

      const distanceToBurger = rootWorldPos.distanceTo(cameraPos);
      const angleToCamera = Math.atan2(
        rootWorldPos.x - cameraPos.x,
        rootWorldPos.z - cameraPos.z
      );
      const angleOffset = 12;
      const newAngle = angleToCamera - THREE.MathUtils.degToRad(angleOffset);
      const newX = cameraPos.x + Math.sin(newAngle) * distanceToBurger;
      const newZ = cameraPos.z + Math.cos(newAngle) * distanceToBurger;

      openUIRef.position.set(newX, rootWorldPos.y, newZ);
      updateMainUIPosition(camera);
      mainUI.scale.set(0, 0, 0);
      showMainUIWithAnimation();
    }, 1500);

    // Enable pinch detection after 2 seconds
    setTimeout(() => {
      pinchDetectionEnabled = true;
    }, 2000);
  });

  onXRSessionEnd(() => {
    pinchDetectionEnabled = false;
    OnXRSessionEnd();
  });

  // Animation loop
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    gsap.ticker.tick(delta);

    // Position composition at head height
    positionCompositionAtHeadHeight(baseComposition);

    // Update hand tracking
    if (pinchDetectionEnabled) {
      UpdateHandTracking();
    }

    // Update burger interactions
    UpdateOpening();
    UpdateFreeMove();
    UpdateRejoin();
    UpdateOpenState();

    // Update content parts positioning (always, whether joined or not)
    UpdateContentParts();

    // Animate arrow planes
    animateArrowPlanes(clock);

    renderer.render(scene, camera);
  });
}
