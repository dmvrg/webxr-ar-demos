// HandTracking.js
import * as THREE from 'three';

/**
 * Hand tracking + interactions:
 * - Reads WebXR hands (renderer.xr.getHand)
 * - Tracks thumb/index tips
 * - Pinch detection (lPinchOn / rPinchOn)
 * - Grab + move root when joined
 * - Two-hand pinch → open burger (joined = false)
 * - Free move of cubeA / cubeB when open
 * - Auto rejoin when halves get close again
 * - Orient halves to face each other in open state
 * - Tap part UI planes with index finger to toggle ingredients
 */
export function CreateHandTracking({
  scene,
  camera,
  renderer,
  xrRoot,
  root,
  cubeA,
  cubeB,
  parts,                // [part0..part4]
  mainLight,            // optional, if you refit shadows elsewhere
  state,                // from BurgerStack (joined, switchStates, SetSwitchState, CalculateGap)
  mainUI,
  partUIs,              // [part0UI..part4UI]
  openUIRef,
  topArrowPlane,
  bottomArrowPlane,
  UpdateMainUIPosition,
  ShowMainUIWithAnimation,
  OnSwitchToggle,        // optional callback(index, newState) for UI (textures etc.)
  OnRejoin               // optional callback() called when burger rejoins
}) {
  // --- Small fingertip helpers (invisible) ---
  const fingertipGeo = new THREE.SphereGeometry(0.002, 16, 16);
  const fingertipMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    opacity: 0,
    transparent: true
  });

  const lThumbObj = new THREE.Mesh(fingertipGeo, fingertipMat.clone());
  const lIndexObj = new THREE.Mesh(fingertipGeo, fingertipMat.clone());
  const rThumbObj = new THREE.Mesh(fingertipGeo, fingertipMat.clone());
  const rIndexObj = new THREE.Mesh(fingertipGeo, fingertipMat.clone());

  xrRoot.add(lThumbObj, lIndexObj, rThumbObj, rIndexObj);

  // --- Pinch reference spheres (slightly bigger) ---
  const pinchGeo = new THREE.SphereGeometry(0.006, 16, 16);
  const pinchMatL = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0
  });
  const pinchMatR = new THREE.MeshLambertMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0
  });

  const lPinchSphere = new THREE.Mesh(pinchGeo, pinchMatL);
  const rPinchSphere = new THREE.Mesh(pinchGeo, pinchMatR);
  xrRoot.add(lPinchSphere, rPinchSphere);

  // Visible toggle if you want debug:
  lPinchSphere.visible = true;
  rPinchSphere.visible = true;

  // --- WebXR hands ---
  const hand1 = renderer.xr.getHand(0);
  const hand2 = renderer.xr.getHand(1);

  const handsGroup = new THREE.Group();
  handsGroup.add(hand1, hand2);
  xrRoot.add(handsGroup);
  handsGroup.visible = true;

  // Interaction state
  let lPinchOn = false;
  let rPinchOn = false;

  let leftHandGrabbing = false;
  let rightHandGrabbing = false;
  let grabbedObject = null;
  let originalParent = null;
  let originalPosition = null;
  let originalRotation = null;

  const grabDistance = 0.15;
  const grabOffset = 0.05;

  let pinchDetectionEnabled = true; // if you want to gate after some time, expose setters

  // Cooldown for switch taps
  const switchCooldowns = [0, 0, 0, 0, 0];
  const SWITCH_COOLDOWN_MS = 500;

  // Shared temp vectors/quats
  const _rootWorldPos = new THREE.Vector3();
  const _cameraPos = new THREE.Vector3();
  const _tmpVec = new THREE.Vector3();
  const _aWorld = new THREE.Vector3();
  const _bWorld = new THREE.Vector3();
  const _aQuat = new THREE.Quaternion();

  // ===== Helper: plane hit test =====
  function CheckPointPlaneIntersection(point, plane) {
    if (!plane || !plane.visible) return false;
    const planePos = new THREE.Vector3();
    const planeQuat = new THREE.Quaternion();
    plane.getWorldPosition(planePos);
    plane.getWorldQuaternion(planeQuat);

    const inv = new THREE.Matrix4().makeRotationFromQuaternion(planeQuat).invert();
    const localPoint = point.clone().sub(planePos).applyMatrix4(inv);

    const width = plane.geometry.parameters.width / 2;
    const height = plane.geometry.parameters.height / 2;

    return (
      Math.abs(localPoint.x) < width &&
      Math.abs(localPoint.y) < height &&
      Math.abs(localPoint.z) < 0.02
    );
  }

  // ===== Helper: switch toggle wrapper =====
  function ToggleSwitch(index) {
    const now = Date.now();
    if (now - switchCooldowns[index] < SWITCH_COOLDOWN_MS) return;
    switchCooldowns[index] = now;

    const current = state.switchStates[index];
    const next = !current;
    state.SetSwitchState(index, next);

    if (typeof OnSwitchToggle === 'function') {
      OnSwitchToggle(index, next);
    }
  }

  // ===== HAND + PINCH + GRAB TRACKING =====
  function UpdateHandTracking() {
    const leftHand = hand1;
    const rightHand = hand2;

    // --- Left thumb / index tips ---
    if (leftHand && leftHand.joints) {
      const lThumb = leftHand.joints['thumb-tip'];
      const lIndex = leftHand.joints['index-finger-tip'];

      if (lThumb) {
        lThumbObj.position.copy(lThumb.position);
        lThumbObj.rotation.setFromQuaternion(lThumb.quaternion || lThumbObj.quaternion);
      }
      if (lIndex) {
        lIndexObj.position.copy(lIndex.position);
        lIndexObj.rotation.setFromQuaternion(lIndex.quaternion || lIndexObj.quaternion);

        // Tap UI with left index
        if (Array.isArray(partUIs)) {
          partUIs.forEach((plane, i) => {
            if (CheckPointPlaneIntersection(lIndexObj.position, plane)) {
              ToggleSwitch(i);
            }
          });
        }
      }
    }

    // --- Right thumb / index tips ---
    if (rightHand && rightHand.joints) {
      const rThumb = rightHand.joints['thumb-tip'];
      const rIndex = rightHand.joints['index-finger-tip'];

      if (rThumb) {
        rThumbObj.position.copy(rThumb.position);
        rThumbObj.rotation.setFromQuaternion(rThumb.quaternion || rThumbObj.quaternion);
      }
      if (rIndex) {
        rIndexObj.position.copy(rIndex.position);
        rIndexObj.rotation.setFromQuaternion(rIndex.quaternion || rIndexObj.quaternion);

        // Tap UI with right index
        if (Array.isArray(partUIs)) {
          partUIs.forEach((plane, i) => {
            if (CheckPointPlaneIntersection(rIndexObj.position, plane)) {
              ToggleSwitch(i);
            }
          });
        }
      }
    }

    // --- Left pinch detection + grab root when joined ---
    const lDist = lIndexObj.position.distanceTo(lThumbObj.position);

    if (pinchDetectionEnabled && lDist < 0.02) {
      lPinchSphere.position.copy(lThumbObj.position);
      lPinchSphere.rotation.copy(lThumbObj.rotation);
      lPinchOn = true;

      if (!leftHandGrabbing && !rightHandGrabbing && state.joined) {
        root.getWorldPosition(_rootWorldPos);
        const distanceToRoot = lPinchSphere.position.distanceTo(_rootWorldPos);

        if (distanceToRoot < grabDistance) {
          leftHandGrabbing = true;
          grabbedObject = root;
          originalParent = root.parent;
          originalPosition = root.position.clone();
          originalRotation = root.rotation.clone();

          const worldQuat = root.getWorldQuaternion(new THREE.Quaternion());
          lPinchSphere.add(root);
          root.position.set(0, 0, -grabOffset);

          const parentWorldQuat = lPinchSphere.getWorldQuaternion(new THREE.Quaternion());
          const localQuat = worldQuat.clone().multiply(parentWorldQuat.invert());
          root.quaternion.copy(localQuat);
        }
      }
    } else {
      lPinchOn = false;

      if (leftHandGrabbing && grabbedObject) {
        leftHandGrabbing = false;

        const currentWorldPosition = new THREE.Vector3();
        const currentWorldQuaternion = new THREE.Quaternion();
        grabbedObject.getWorldPosition(currentWorldPosition);
        grabbedObject.getWorldQuaternion(currentWorldQuaternion);

        originalParent.add(grabbedObject);

        const localPosition = currentWorldPosition.clone();
        originalParent.worldToLocal(localPosition);
        grabbedObject.position.copy(localPosition);

        const parentWorldQuat = originalParent.getWorldQuaternion(new THREE.Quaternion());
        const localQuat = currentWorldQuaternion.clone().multiply(parentWorldQuat.invert());
        grabbedObject.quaternion.copy(localQuat);

        grabbedObject = null;
        originalParent = null;
        originalPosition = null;
        originalRotation = null;

        // When still closed, position openUIRef and show mainUI
        if (state.joined && openUIRef && mainUI) {
          root.getWorldPosition(_rootWorldPos);
          camera.getWorldPosition(_cameraPos);

          const distanceToBurger = _rootWorldPos.distanceTo(_cameraPos);
          const angleToCamera = Math.atan2(
            _rootWorldPos.x - _cameraPos.x,
            _rootWorldPos.z - _cameraPos.z
          );
          const angleOffset = distanceToBurger <= 0.6 ? 30 : 20;
          const newAngle = angleToCamera - THREE.MathUtils.degToRad(angleOffset);

          const newX = _cameraPos.x + Math.sin(newAngle) * distanceToBurger;
          const newZ = _cameraPos.z + Math.cos(newAngle) * distanceToBurger;

          openUIRef.position.set(newX, _rootWorldPos.y, newZ);
          if (UpdateMainUIPosition) UpdateMainUIPosition();
          if (ShowMainUIWithAnimation) {
            mainUI.scale.set(0, 0, 0);
            ShowMainUIWithAnimation();
          } else {
            mainUI.visible = true;
            mainUI.scale.set(1, 1, 1);
          }
        }
      }
    }

    // --- Right pinch detection + grab root when joined ---
    const rDist = rIndexObj.position.distanceTo(rThumbObj.position);

    if (pinchDetectionEnabled && rDist < 0.02) {
      rPinchSphere.position.copy(rThumbObj.position);
      rPinchSphere.rotation.copy(rThumbObj.rotation);
      rPinchOn = true;

      if (!leftHandGrabbing && !rightHandGrabbing && state.joined) {
        root.getWorldPosition(_rootWorldPos);
        const distanceToRoot = rPinchSphere.position.distanceTo(_rootWorldPos);

        if (distanceToRoot < grabDistance) {
          rightHandGrabbing = true;
          grabbedObject = root;
          originalParent = root.parent;
          originalPosition = root.position.clone();
          originalRotation = root.rotation.clone();

          const worldQuat = root.getWorldQuaternion(new THREE.Quaternion());
          rPinchSphere.add(root);
          root.position.set(0, 0, -grabOffset);

          const parentWorldQuat = rPinchSphere.getWorldQuaternion(new THREE.Quaternion());
          const localQuat = worldQuat.clone().multiply(parentWorldQuat.invert());
          root.quaternion.copy(localQuat);
        }
      }
    } else {
      rPinchOn = false;

      if (rightHandGrabbing && grabbedObject) {
        rightHandGrabbing = false;

        const currentWorldPosition = new THREE.Vector3();
        const currentWorldQuaternion = new THREE.Quaternion();
        grabbedObject.getWorldPosition(currentWorldPosition);
        grabbedObject.getWorldQuaternion(currentWorldQuaternion);

        originalParent.add(grabbedObject);
        const localPosition = currentWorldPosition.clone();
        originalParent.worldToLocal(localPosition);
        grabbedObject.position.copy(localPosition);

        const parentWorldQuat = originalParent.getWorldQuaternion(new THREE.Quaternion());
        const localQuat = currentWorldQuaternion.clone().multiply(parentWorldQuat.invert());
        grabbedObject.quaternion.copy(localQuat);

        grabbedObject = null;
        originalParent = null;
        originalPosition = null;
        originalRotation = null;

        if (state.joined && openUIRef && mainUI) {
          root.getWorldPosition(_rootWorldPos);
          camera.getWorldPosition(_cameraPos);

          const distanceToBurger = _rootWorldPos.distanceTo(_cameraPos);
          const angleToCamera = Math.atan2(
            _rootWorldPos.x - _cameraPos.x,
            _rootWorldPos.z - _cameraPos.z
          );
          const angleOffset = distanceToBurger <= 0.6 ? 30 : 20;
          const newAngle = angleToCamera - THREE.MathUtils.degToRad(angleOffset);
          const newX = _cameraPos.x + Math.sin(newAngle) * distanceToBurger;
          const newZ = _cameraPos.z + Math.cos(newAngle) * distanceToBurger;

          openUIRef.position.set(newX, _rootWorldPos.y, newZ);
          if (UpdateMainUIPosition) UpdateMainUIPosition();
          if (ShowMainUIWithAnimation) {
            mainUI.scale.set(0, 0, 0);
            ShowMainUIWithAnimation();
          } else {
            mainUI.visible = true;
            mainUI.scale.set(1, 1, 1);
          }
        }
      }
    }
  }

  // ===== OPENING (two-hand pinch on different halves) =====
  function UpdateOpening() {
    if (!state.joined) return;
    if (!(lPinchOn && rPinchOn)) return;

    const lPinchWorld = new THREE.Vector3();
    const rPinchWorld = new THREE.Vector3();
    lPinchSphere.getWorldPosition(lPinchWorld);
    rPinchSphere.getWorldPosition(rPinchWorld);

    const cubeAWorld = new THREE.Vector3();
    const cubeBWorld = new THREE.Vector3();
    cubeA.getWorldPosition(cubeAWorld);
    cubeB.getWorldPosition(cubeBWorld);

    const grabThreshold = 0.15;
    const leftNearA = lPinchWorld.distanceTo(cubeAWorld) < grabThreshold;
    const leftNearB = lPinchWorld.distanceTo(cubeBWorld) < grabThreshold;
    const rightNearA = rPinchWorld.distanceTo(cubeAWorld) < grabThreshold;
    const rightNearB = rPinchWorld.distanceTo(cubeBWorld) < grabThreshold;

    const oppositeHalves =
      (leftNearA && rightNearB) ||
      (leftNearB && rightNearA);

    if (!oppositeHalves) return;

    state.joined = false;

    // Hide main panel while open
    if (mainUI) mainUI.visible = false;

    // Hide arrow planes when burger is opened
    if (topArrowPlane) topArrowPlane.visible = false;
    if (bottomArrowPlane) bottomArrowPlane.visible = false;

    // Show burger parts based on switchStates
    parts.forEach((part, i) => {
      part.visible = state.switchStates[i];
    });
  }

  // ===== FREE MOVE halves when open =====
  function UpdateFreeMove() {
    if (state.joined) return;

    const lPinchWorld = new THREE.Vector3();
    const rPinchWorld = new THREE.Vector3();
    lPinchSphere.getWorldPosition(lPinchWorld);
    rPinchSphere.getWorldPosition(rPinchWorld);

    const cubeAWorld = new THREE.Vector3();
    const cubeBWorld = new THREE.Vector3();
    cubeA.getWorldPosition(cubeAWorld);
    cubeB.getWorldPosition(cubeBWorld);

    const threshold = 0.15;

    // Track if we're moving any halves
    let movingHalves = false;

    // Move closest half with left pinch
    if (lPinchOn) {
      const dA = lPinchWorld.distanceTo(cubeAWorld);
      const dB = lPinchWorld.distanceTo(cubeBWorld);

      if (dA < threshold && dA < dB) {
        const local = lPinchWorld.clone();
        root.worldToLocal(local);
        cubeA.position.copy(local);
        movingHalves = true;
      } else if (dB < threshold && dB < dA) {
        const local = lPinchWorld.clone();
        root.worldToLocal(local);
        cubeB.position.copy(local);
        movingHalves = true;
      }
    }

    // Move closest half with right pinch
    if (rPinchOn) {
      const dA = rPinchWorld.distanceTo(cubeAWorld);
      const dB = rPinchWorld.distanceTo(cubeBWorld);

      if (dA < threshold && dA < dB) {
        const local = rPinchWorld.clone();
        root.worldToLocal(local);
        cubeA.position.copy(local);
        movingHalves = true;
      } else if (dB < threshold && dB < dA) {
        const local = rPinchWorld.clone();
        root.worldToLocal(local);
        cubeB.position.copy(local);
        movingHalves = true;
      }
    }

    // Only update part UI positions when actively moving the halves
    if (movingHalves) {
      UpdatePartUIs();
    }
  }

  function UpdatePartUIs() {
    if (!Array.isArray(partUIs) || partUIs.length !== parts.length) return;

    camera.getWorldPosition(_cameraPos);

    parts.forEach((part, index) => {
      const uiPlane = partUIs[index];
      if (!uiPlane) return;

      const partWorldPos = new THREE.Vector3();
      part.getWorldPosition(partWorldPos);

      const toPart = new THREE.Vector3().subVectors(partWorldPos, _cameraPos);
      const toPartXZ = new THREE.Vector3(toPart.x, 0, toPart.z);
      const xzDist = toPartXZ.length();
      const yOffset = toPart.y;
      const angleToCamera = Math.atan2(toPartXZ.x, toPartXZ.z);

      const newAngle = angleToCamera - THREE.MathUtils.degToRad(20.5);
      const newX = _cameraPos.x + Math.sin(newAngle) * xzDist;
      const newZ = _cameraPos.z + Math.cos(newAngle) * xzDist;

      uiPlane.position.set(newX, _cameraPos.y + yOffset, newZ);
      uiPlane.visible = true;

      const deltaX = _cameraPos.x - uiPlane.position.x;
      const deltaZ = _cameraPos.z - uiPlane.position.z;
      const angleY = Math.atan2(deltaX, deltaZ);
      uiPlane.rotation.set(0, angleY, 0);
    });
  }

  // ===== REJOIN when halves close and no pinches =====
  function UpdateRejoin() {
    if (state.joined) return;
    if (lPinchOn || rPinchOn) return;

    cubeA.getWorldPosition(_aWorld);
    cubeB.getWorldPosition(_bWorld);

    const distance = _aWorld.distanceTo(_bWorld);
    const rejoinThreshold = 0.2;

    if (distance >= rejoinThreshold) return;

    // Midpoint in world space
    const midpoint = new THREE.Vector3()
      .addVectors(_aWorld, _bWorld)
      .multiplyScalar(0.5);

    const localMid = midpoint.clone();
    root.parent.worldToLocal(localMid);
    root.position.copy(localMid);

    // Apply gap based on active ingredients
    const gap = state.CalculateGap
      ? state.CalculateGap()
      : 0.031;

    cubeA.position.set(0, gap, 0);
    cubeB.position.set(0, -gap, 0);

    cubeA.rotation.set(0, 0, 0);
    cubeB.rotation.set(0, 0, 0);

    state.joined = true;

    // Hide part UIs, show main UI again
    if (Array.isArray(partUIs)) {
      partUIs.forEach(ui => ui && (ui.visible = false));
    }
    if (mainUI) {
      if (ShowMainUIWithAnimation) {
        mainUI.scale.set(0, 0, 0);
        mainUI.visible = true;
        ShowMainUIWithAnimation();
      } else {
        mainUI.visible = true;
        mainUI.scale.set(1, 1, 1);
      }
    }

    // Arrow planes stay invisible after first opening (no need to show them again)

    // Position openUIRef 30° to one side of burger and update panel
    if (openUIRef && UpdateMainUIPosition) {
      root.getWorldPosition(_rootWorldPos);
      camera.getWorldPosition(_cameraPos);

      const distanceToBurger = _rootWorldPos.distanceTo(_cameraPos);
      const angleToCamera = Math.atan2(
        _rootWorldPos.x - _cameraPos.x,
        _rootWorldPos.z - _cameraPos.z
      );
      const newAngle = angleToCamera - THREE.MathUtils.degToRad(30);
      const newX = _cameraPos.x + Math.sin(newAngle) * distanceToBurger;
      const newZ = _cameraPos.z + Math.cos(newAngle) * distanceToBurger;

      openUIRef.position.set(newX, _rootWorldPos.y, newZ);
      UpdateMainUIPosition();
    }

    // Call rejoin callback to update UI text
    if (typeof OnRejoin === 'function') {
      OnRejoin();
    }
  }

  // ===== ORIENT HALVES TO FACE EACH OTHER when open =====
  function UpdateOpenState() {
    if (state.joined) return;

    cubeA.getWorldPosition(_aWorld);
    cubeB.getWorldPosition(_bWorld);

    const distanceAB = _aWorld.distanceTo(_bWorld);
    const orientationThreshold = 0.12;
    if (distanceAB <= orientationThreshold) return;

    cubeA.lookAt(_bWorld);
    cubeB.lookAt(_aWorld);

    const MODEL_FRONT = new THREE.Vector3(0, 1, 0);
    const corr = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      MODEL_FRONT.clone().normalize()
    );

    cubeA.quaternion.multiply(corr);
    cubeB.quaternion.multiply(corr);

    const flip = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      Math.PI
    );
    cubeA.quaternion.multiply(flip);
  }

  // Optional hooks if you want to gate pinchDetectionEnabled by XR session
  function OnXRSessionStart() {
    pinchDetectionEnabled = true;
  }

  function OnXRSessionEnd() {
    pinchDetectionEnabled = false;
    lPinchOn = false;
    rPinchOn = false;
    leftHandGrabbing = false;
    rightHandGrabbing = false;
    grabbedObject = null;
  }

  return {
    UpdateHandTracking,
    UpdateOpening,
    UpdateFreeMove,
    UpdateRejoin,
    UpdateOpenState,
    OnXRSessionStart,
    OnXRSessionEnd
  };
}
