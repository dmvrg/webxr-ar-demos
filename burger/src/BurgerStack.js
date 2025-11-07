// BurgerStack.js
import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Creates the burger stack:
 * - baseComposition (invisible root container)
 * - root group
 * - cubeA / cubeB (collision / reference cubes for buns)
 * - ingredient holders part0..part4
 * - state: switchStates, joined, CalculateGap, SetSwitchState
 *
 * @param {Object} params
 * @param {THREE.Scene} params.scene
 * @param {THREE.Group} params.xrRoot
 * @param {THREE.DirectionalLight} params.mainLight (optional, if you want to refit shadows later)
 * @param {THREE.Object3D} params.bunTop
 * @param {THREE.Object3D} params.bunBottom
 * @param {THREE.Object3D} params.onion
 * @param {THREE.Object3D} params.tomato
 * @param {THREE.Object3D} params.lettuce
 * @param {THREE.Object3D} params.cheese
 * @param {THREE.Object3D} params.patty
 */
export function CreateBurgerStack({
  scene,
  xrRoot,
  mainLight,
  bunTop,
  bunBottom,
  onion,
  tomato,
  lettuce,
  cheese,
  patty
}) {
  /**
   * Base Composition (container for burger)
   * (matches your original invisible cube)
   */
  const tempGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const tempMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthTest: false,
    depthWrite: false
  });

  const baseComposition = new THREE.Mesh(tempGeo, tempMat);
  baseComposition.scale.set(1, 1, 1);
  baseComposition.position.set(0, 1.6, 2); // initial; XRScene will reposition
  xrRoot.add(baseComposition);

  /**
   * Root group for the whole burger stack
   */
  const root = new THREE.Group();
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  baseComposition.add(root);

  /**
   * Top & Bottom cubes (A/B) – invisible, carry the buns
   */
  const cubeAGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeAMaterial = new THREE.MeshLambertMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0,     // collider only
    depthTest: true,
    depthWrite: true
  });
  const cubeA = new THREE.Mesh(cubeAGeometry, cubeAMaterial);

  const cubeBGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeBMaterial = new THREE.MeshLambertMaterial({
    color: 0x4ecdc4,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: true
  });
  const cubeB = new THREE.Mesh(cubeBGeometry, cubeBMaterial);

  // base uniform scale for the cubes (matches your 0.18 * 0.9 * 0.8 pattern)
  const baseScaleX = 0.18 * 0.9 * 0.8;
  const baseScaleY = 0.18 * 0.36 * 0.8;
  const baseScaleZ = 0.18 * 0.9 * 0.8;

  cubeA.scale.set(baseScaleX, baseScaleY, baseScaleZ);
  cubeB.scale.set(baseScaleX, baseScaleY, baseScaleZ);

  root.add(cubeA);
  root.add(cubeB);

  /**
   * Attach bun models as children of cubeA/cubeB
   * (models are already scaled in BurgerModels.js)
   */
  if (bunTop) {
    bunTop.position.set(0, 0, 0);
    cubeA.add(bunTop);
  }

  if (bunBottom) {
    bunBottom.position.set(0, 0, 0);
    cubeB.add(bunBottom);
  }

  /**
   * Ingredient holders (part0..part4)
   * Each is an invisible ref cube that holds one ingredient model.
   * part0: onion, part1: tomato, part2: lettuce, part3: cheese, part4: patty
   */
  const partGeometry = new THREE.BoxGeometry(0.15, 0.01, 0.15);
  const partMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0
  });

  function CreatePart(name) {
    const mesh = new THREE.Mesh(partGeometry, partMaterial.clone());
    mesh.name = name;
    xrRoot.add(mesh);
    return mesh;
  }

  const part0 = CreatePart('part0'); // onion
  const part1 = CreatePart('part1'); // tomato
  const part2 = CreatePart('part2'); // lettuce
  const part3 = CreatePart('part3'); // cheese
  const part4 = CreatePart('part4'); // patty

  // Attach ingredient models at local origin of each part
  if (onion) {
    onion.position.set(0, 0, 0);
    part0.add(onion);
  }
  if (tomato) {
    tomato.position.set(0, 0, 0);
    part1.add(tomato);
  }
  if (lettuce) {
    lettuce.position.set(0, 0, 0);
    part2.add(lettuce);
  }
  if (cheese) {
    cheese.position.set(0, 0, 0);
    part3.add(cheese);
  }
  if (patty) {
    patty.position.set(0, 0, 0);
    part4.add(patty);
  }

  const parts = [part0, part1, part2, part3, part4];

  /**
   * Initial ingredient states:
   * [onion, tomato, lettuce, cheese, patty]
   * = [false, true, true, false, true]
   */
  const switchStates = [false, true, true, false, true].map(Boolean);

  // Initialize visibility & scale based on these states
  parts.forEach((part, index) => {
    const on = switchStates[index];
    part.visible = on;
    part.scale.set(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
  });

  /**
   * Joined state/logic + gap calculation
   */
  const state = {
    joined: true,
    switchStates,
    // assigned after function defs:
    CalculateGap: null,
    SetSwitchState: null,
    // Callbacks for UI updates:
    OnSwitchToggle: null
  };

  function CalculateGap() {
    const active = state.switchStates.filter(Boolean).length;
    const baseGap = 0.031;            // max gap when all ingredients
    const gapPerIngredient = baseGap / 5;
    return gapPerIngredient * (active + 1); // +1 keeps a minimum gap
  }

  state.CalculateGap = CalculateGap;

  // Keep original references of cube positions (not strictly needed but handy)
  let origPosA = new THREE.Vector3();
  let origPosB = new THREE.Vector3();

  function ApplyCurrentGap() {
    const gap = CalculateGap();
    cubeA.position.set(0, gap, 0);
    cubeB.position.set(0, -gap, 0);

    origPosA.copy(cubeA.position);
    origPosB.copy(cubeB.position);
  }

  // Apply initial gap based on initial states
  ApplyCurrentGap();

  /**
   * Switch handling (ingredient ON/OFF)
   * This ONLY handles the 3D burger parts (scale/visibility + gap).
   * UI textures / text are handled in BurgerUI.js.
   */
  function SetSwitchState(index, on) {
    if (index < 0 || index >= state.switchStates.length) return;
    const value = Boolean(on);
    const part = parts[index];

    // no-op if same state
    if (state.switchStates[index] === value) return;
    state.switchStates[index] = value;

    if (value) {
      // Turn ON: scale from 0 → 1
      part.visible = true;
      part.scale.set(0, 0, 0);
      gsap.to(part.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.3,
        ease: 'back.out(1.7)'
      });
    } else {
      // Turn OFF: scale 1 → 0 then hide
      gsap.to(part.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          part.visible = false;
        }
      });
    }

    // When burger is closed, recompute gap for the current set
    if (state.joined) {
      ApplyCurrentGap();
    }

    // Call UI callbacks if provided
    if (typeof state.OnSwitchToggle === 'function') {
      state.OnSwitchToggle(index, value);
    }
  }

  state.SetSwitchState = SetSwitchState;

  /**
   * Distribute ingredient parts between cubeA and cubeB
   * (this mirrors your contentPartsTracking() logic)
   */
  const _aWorld = new THREE.Vector3();
  const _bWorld = new THREE.Vector3();
  const _dirAB = new THREE.Vector3();
  const _aQuat = new THREE.Quaternion();

  function UpdateContentParts() {
    cubeA.getWorldPosition(_aWorld);
    cubeB.getWorldPosition(_bWorld);
    _dirAB.subVectors(_bWorld, _aWorld);
    cubeA.getWorldQuaternion(_aQuat);

    const n = parts.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1); // evenly between A/B
      const part = parts[i];
      const pos = new THREE.Vector3().copy(_aWorld).addScaledVector(_dirAB, t);
      part.position.copy(pos);
      part.quaternion.copy(_aQuat);
    }
  }

  // Initial layout
  UpdateContentParts();

  return {
    baseComposition,
    root,
    cubeA,
    cubeB,
    parts,
    state,
    UpdateContentParts
  };
}
