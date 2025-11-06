import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import CANNON from 'cannon';

import vertexShader from './assets/shaders/vertex.glsl';
import fragmentShader from './assets/shaders/fragment.glsl';

// -----------------------------------------------------------------------------
// Global state
// -----------------------------------------------------------------------------

let renderer, scene, camera, clock;
let handLeft, handRight;

let rThumbObj, rIndexObj, lThumbObj, lIndexObj;
let rPinchSphere, lPinchSphere;
let lPinchOn = false;
let rPinchOn = false;
let scalingOn = false;

let tempCube, box, boxMaterial;
let world, cubeShape, cubeBody;

let previousTime = 0;

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

init();
renderer.setAnimationLoop(animate);

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 1.6, 3);
  scene.add(camera);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // XR button (hand tracking + depth sensing)
  document.body.appendChild(
    XRButton.createButton(renderer, {
      optionalFeatures: ['depth-sensing', 'hand-tracking']
    })
  );

  // Lights
  setupLights();

  // Hand joint reference meshes
  setupJointReferences();

  // Pinch visual references
  setupPinchReferences();

  //Virtual hands
  setupHands();

  // Physics world + cube
  setupPhysics();

  // Visual cube linked to physics body
  setupBoxMesh();

  // Temp cube used while scaling between pinch points
  setupTempCube();

  // Clock
  clock = new THREE.Clock();

  // Resize handling
  window.addEventListener('resize', onWindowResize, false);
}

// -----------------------------------------------------------------------------
// Setup helpers
// -----------------------------------------------------------------------------

function setupLights() {
  // Use a single ambient light to illuminate the scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);  // Color and intensity
  scene.add(ambientLight);
}

function setupJointReferences() {
  const sphereGeom = new THREE.SphereGeometry(0.002, 32, 32);
  const invisibleRed = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    opacity: 0,
    transparent: true
  });

  rThumbObj = new THREE.Mesh(sphereGeom, invisibleRed);
  rIndexObj = new THREE.Mesh(sphereGeom, invisibleRed);
  lThumbObj = new THREE.Mesh(sphereGeom, invisibleRed);
  lIndexObj = new THREE.Mesh(sphereGeom, invisibleRed);

  scene.add(rThumbObj, rIndexObj, lThumbObj, lIndexObj);
}

function setupPinchReferences() {
  const pinchGeom = new THREE.SphereGeometry(0.006, 32, 32);
  const pinchMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  rPinchSphere = new THREE.Mesh(pinchGeom, pinchMat);
  lPinchSphere = new THREE.Mesh(pinchGeom, pinchMat);

  rPinchSphere.visible = false;
  lPinchSphere.visible = false;

  scene.add(rPinchSphere, lPinchSphere);
}

function setupHands() {
  const handModelFactory = new XRHandModelFactory();

  handRight = renderer.xr.getHand(0);
  // handRight.add(handModelFactory.createHandModel(handRight));
  // scene.add(handRight);

  handLeft = renderer.xr.getHand(1);
  // handLeft.add(handModelFactory.createHandModel(handLeft));
  // scene.add(handLeft);

}

function setupPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);

  const defaultMaterial = new CANNON.Material('default');
  const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.1,
    restitution: 0.7
  });

  world.addContactMaterial(defaultContactMaterial);
  world.defaultContactMaterial = defaultContactMaterial;

  // Cube body
  cubeShape = new CANNON.Box(new CANNON.Vec3(0.2 * 0.5, 0.2 * 0.5, 0.2 * 0.5));
  cubeBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 1.5, -0.5),
    shape: cubeShape
  });
  world.addBody(cubeBody);

  // Floor
  const floorShape = new CANNON.Plane();
  const floorBody = new CANNON.Body({ mass: 0 });
  floorBody.addShape(floorShape);
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
  floorBody.position.y = 0.01;
  world.addBody(floorBody);
}

function setupBoxMesh() {
  const boxGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  boxMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      resolution: { value: new THREE.Vector2(1800.0, 1800.0) }
    }
  });

  box = new THREE.Mesh(boxGeom, boxMaterial);
  box.castShadow = true;
  box.position.set(0, 1.5, -0.5);
  scene.add(box);
}

function setupTempCube() {
  const cubeGeom = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  tempCube = new THREE.Mesh(cubeGeom, boxMaterial);
  tempCube.visible = false;
  scene.add(tempCube);
}

// -----------------------------------------------------------------------------
// Animation loop
// -----------------------------------------------------------------------------

function animate() {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  // Update physics
  world.step(1 / 60, deltaTime, 3);

  // Sync visual box with physics body
  box.position.copy(cubeBody.position);
  box.quaternion.copy(cubeBody.quaternion);

  // Update shader time uniform
  boxMaterial.uniforms.uTime.value = elapsedTime;

  // Hand joints + pinch logic
  updateJointReferences();
  updatePinchState();
  handleScalingLogic();

  // Render
  renderer.render(scene, camera);
}

// -----------------------------------------------------------------------------
// Hand + pinch helpers
// -----------------------------------------------------------------------------

function updateJointReferences() {
  // Right hand (index 0)
  if (handRight?.joints) {
    const thumb = handRight.joints['thumb-tip'];
    const index = handRight.joints['index-finger-tip'];

    if (thumb) rThumbObj.position.copy(thumb.position);
    if (index) rIndexObj.position.copy(index.position);
  }

  // Left hand (index 1)
  if (handLeft?.joints) {
    const thumb = handLeft.joints['thumb-tip'];
    const index = handLeft.joints['index-finger-tip'];

    if (thumb) lThumbObj.position.copy(thumb.position);
    if (index) lIndexObj.position.copy(index.position);
  }
}

function updatePinchState() {
  const rDist = rIndexObj.position.distanceTo(rThumbObj.position);
  const lDist = lIndexObj.position.distanceTo(lThumbObj.position);

  // Right pinch
  if (rDist < 0.02) {
    rPinchSphere.position.copy(rThumbObj.position);
    rPinchOn = true;
    // rPinchSphere.visible = true;
  } else {
    rPinchOn = false;
    rPinchSphere.visible = false;
  }

  // Left pinch
  if (lDist < 0.02) {
    lPinchSphere.position.copy(lThumbObj.position);
    lPinchOn = true;
    // lPinchSphere.visible = true;
  } else {
    lPinchOn = false;
    lPinchSphere.visible = false;
  }
}

function handleScalingLogic() {
  if (lPinchOn && rPinchOn) {
    if (!scalingOn) {
      tempCube.visible = true;
      scalingOn = true;
    }
    cubeScaling();
  } else {
    if (scalingOn) {
      spawnCube();
      tempCube.visible = false;
      scalingOn = false;
    }
  }
}

function spawnCube() {
  cubeScaling(); // ensure latest scale/position

  // Copy transform from tempCube to physics body
  cubeBody.position.set(tempCube.position.x, tempCube.position.y, tempCube.position.z);
  cubeBody.quaternion.set(
    tempCube.quaternion.x,
    tempCube.quaternion.y,
    tempCube.quaternion.z,
    tempCube.quaternion.w ?? cubeBody.quaternion.w
  );

  // Scale visual box
  box.scale.set(tempCube.scale.x * 0.25, tempCube.scale.y * 0.25, tempCube.scale.z * 0.25);

  // Update CANNON shape half-extents based on new scale
  const newHalfExtents = new CANNON.Vec3(
    box.scale.x * 0.125,
    box.scale.y * 0.125,
    box.scale.z * 0.125
  );

  cubeShape.halfExtents = newHalfExtents;
  cubeShape.updateConvexPolyhedronRepresentation();
}

function cubeScaling() {
  // Midpoint between pinch spheres
  const midPoint = new THREE.Vector3()
    .addVectors(rPinchSphere.position, lPinchSphere.position)
    .divideScalar(2);

  // Direction from left to right pinch
  const targetDir = new THREE.Vector3()
    .subVectors(rPinchSphere.position, lPinchSphere.position)
    .normalize();

  tempCube.position.copy(midPoint);
  tempCube.lookAt(new THREE.Vector3().addVectors(tempCube.position, targetDir));

  // Distance between pinch points → scale
  const pointDist = rPinchSphere.position.distanceTo(lPinchSphere.position);
  const scaleValue = THREE.MathUtils.mapLinear(pointDist, 0, 0.1, 0, 1);

  tempCube.scale.set(scaleValue, scaleValue, scaleValue);
}

// -----------------------------------------------------------------------------
// Resize handling
// -----------------------------------------------------------------------------

function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
