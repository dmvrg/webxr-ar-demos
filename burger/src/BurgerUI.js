import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import gsap from 'gsap';
import { GetBurgerData } from './BurgerNames.js';

/**
 * Creates and manages all UI elements:
 * - Main UI plane with burger name/description/price text
 * - Part UI planes (switch buttons for each ingredient)
 * - Arrow planes (top/bottom indicators)
 * - UI reference spheres for positioning
 */
export function CreateBurgerUI({ scene, xrRoot, switchStates, cubeA, cubeB }) {
  // Store reference to switchStates array for updates
  const getSwitchStates = () => switchStates;
  const textureLoader = new THREE.TextureLoader();
  const fontLoader = new FontLoader();

  // Load main UI texture
  const mainUITexture = textureLoader.load('/static/ui_main.png');
  mainUITexture.encoding = THREE.sRGBEncoding;

  // Load switch textures
  const switchTextures = [
    { OFF: textureLoader.load('/static/ui_switch0_OFF.png'), ON: textureLoader.load('/static/ui_switch0_ON.png') },
    { OFF: textureLoader.load('/static/ui_switch1_OFF.png'), ON: textureLoader.load('/static/ui_switch1_ON.png') },
    { OFF: textureLoader.load('/static/ui_switch2_OFF.png'), ON: textureLoader.load('/static/ui_switch2_ON.png') },
    { OFF: textureLoader.load('/static/ui_switch3_OFF.png'), ON: textureLoader.load('/static/ui_switch3_ON.png') },
    { OFF: textureLoader.load('/static/ui_switch4_OFF.png'), ON: textureLoader.load('/static/ui_switch4_ON.png') }
  ];
  switchTextures.forEach(pair => {
    pair.OFF.encoding = THREE.sRGBEncoding;
    pair.ON.encoding = THREE.sRGBEncoding;
  });

  // Initialize switch textures based on initial states
  const initialSwitchTextures = [
    switchTextures[0].OFF, // onion OFF
    switchTextures[1].ON,   // tomato ON
    switchTextures[2].ON,   // lettuce ON
    switchTextures[3].OFF, // cheese OFF
    switchTextures[4].ON   // patty ON
  ];

  // Create main UI plane
  const mainUIGeometry = new THREE.PlaneGeometry(0.22, 0.22);
  const mainUIMaterial = new THREE.MeshBasicMaterial({
    map: mainUITexture,
    transparent: true,
    opacity: 1.0,
    side: THREE.FrontSide
  });
  const mainUI = new THREE.Mesh(mainUIGeometry, mainUIMaterial);
  mainUI.position.set(0, 1.6, -1);
  mainUI.visible = false;
  mainUI.scale.set(0, 0, 0);
  xrRoot.add(mainUI);

  // Create part UI planes
  const partUIGeometry = new THREE.PlaneGeometry(0.140, 0.0547);
  const partUIs = [];
  for (let i = 0; i < 5; i++) {
    const material = new THREE.MeshBasicMaterial({
      map: initialSwitchTextures[i],
      transparent: true,
      opacity: 1.0,
      side: THREE.FrontSide
    });
    const partUI = new THREE.Mesh(partUIGeometry, material);
    partUI.position.copy(mainUI.position);
    partUI.visible = false;
    xrRoot.add(partUI);
    partUIs.push(partUI);
  }

  // Create UI reference spheres
  const uiRefGeometry = new THREE.SphereGeometry(0.01, 16, 16);
  const uiRefMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  
  const openUIRef = new THREE.Mesh(uiRefGeometry, uiRefMaterial);
  openUIRef.visible = false;
  openUIRef.position.set(0, 1.6, -0.5);
  xrRoot.add(openUIRef);

  const partUIRefs = [];
  for (let i = 0; i < 5; i++) {
    const ref = new THREE.Mesh(uiRefGeometry, uiRefMaterial.clone());
    ref.visible = false;
    ref.position.copy(openUIRef.position);
    xrRoot.add(ref);
    partUIRefs.push(ref);
  }

  // Create arrow planes
  const arrowTexture = textureLoader.load('/static/ui_arrow.png');
  arrowTexture.encoding = THREE.sRGBEncoding;
  const arrowGeometry = new THREE.PlaneGeometry(0.2016, 0.2016);
  const arrowMaterial = new THREE.MeshBasicMaterial({
    map: arrowTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    depthTest: false
  });

  const topArrowPlane = new THREE.Mesh(arrowGeometry, arrowMaterial.clone());
  topArrowPlane.name = 'topArrowPlane';
  topArrowPlane.position.set(0, 0.8, 0);
  topArrowPlane.scale.set(1, 2.5, 1); // Counter-scale for parent's non-uniform scale
  topArrowPlane.renderOrder = 999;
  cubeA.add(topArrowPlane);

  const bottomArrowPlane = new THREE.Mesh(arrowGeometry, arrowMaterial.clone());
  bottomArrowPlane.name = 'bottomArrowPlane';
  bottomArrowPlane.position.set(0, -0.8, 0);
  bottomArrowPlane.scale.set(1, 2.5, 1);
  bottomArrowPlane.renderOrder = 999;
  bottomArrowPlane.rotation.x = Math.PI; // Flip upside down
  cubeB.add(bottomArrowPlane);

  // Text rendering setup
  let fontBlack, fontBold, fontMedium;
  let mainUIText = null;
  let textMaterial, textMaterial3;

  const fontPromises = [
    new Promise((r) => fontLoader.load('/static/fonts/roboto_black.typeface.json', r)),
    new Promise((r) => fontLoader.load('/static/fonts/helvetiker_bold.typeface.json', r)),
    new Promise((r) => fontLoader.load('/static/fonts/helvetiker_bold.typeface.json', r))
  ];

  Promise.all(fontPromises).then(([black, bold, medium]) => {
    fontBlack = black;
    fontBold = bold;
    fontMedium = medium;
    initMainUIText();
  });

  function safeRemove(node) {
    node?.traverse?.((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) {
          o.material.forEach((m) => m && m.dispose && m.dispose());
        } else if (o.material.dispose) {
          o.material.dispose();
        }
      }
    });
    node?.parent?.remove(node);
  }

  function initMainUIText() {
    textMaterial = new THREE.MeshBasicMaterial({ color: 0xFFCF00 });
    textMaterial3 = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    mainUIText = new THREE.Group();
    const fixedLeftPosition = -0.102;

    const currentSwitchStates = getSwitchStates();
    const initialBurgerData = GetBurgerData(currentSwitchStates);
    const [descLine1, descLine2] = initialBurgerData.description.split('\n');

    // Description meshes
    const textGeometry3a = new TextGeometry(descLine1, {
      font: fontMedium,
      size: 0.011,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const textGeometry3b = new TextGeometry(descLine2, {
      font: fontMedium,
      size: 0.011,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    textGeometry3a.computeBoundingBox();
    textGeometry3b.computeBoundingBox();
    const height3a = textGeometry3a.boundingBox.max.y - textGeometry3a.boundingBox.min.y;
    textGeometry3a.translate(0, -height3a * 2, 0.001);
    textGeometry3b.translate(0, -height3a * 3, 0.001);
    const textMesh3a = new THREE.Mesh(textGeometry3a, textMaterial3);
    const textMesh3b = new THREE.Mesh(textGeometry3b, textMaterial3);
    textMesh3a.position.set(0.001, -0.02 + 0.045, 0);
    textMesh3b.position.set(0.001, -0.025 + 0.045, 0);

    // Title meshes
    const textGeometry1 = new TextGeometry(initialBurgerData.name, {
      font: fontBlack,
      size: 0.025,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const textGeometry2 = new TextGeometry('BURGER', {
      font: fontBlack,
      size: 0.025,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    textGeometry1.computeBoundingBox();
    textGeometry2.computeBoundingBox();
    const height1 = textGeometry1.boundingBox.max.y - textGeometry1.boundingBox.min.y;
    const height2 = textGeometry2.boundingBox.max.y - textGeometry2.boundingBox.min.y;
    textGeometry1.translate(0, height1 / 2, 0.001);
    textGeometry2.translate(0, -height2 / 2, 0.001);
    const textMesh1 = new THREE.Mesh(textGeometry1, textMaterial);
    const textMesh2 = new THREE.Mesh(textGeometry2, textMaterial);
    textMesh1.position.y = 0.004 + 0.04;
    textMesh2.position.y = -0.004 + 0.04;

    // Price mesh
    const textGeometry4 = new TextGeometry(initialBurgerData.price, {
      font: fontBold,
      size: 0.028,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const textMaterial4 = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const textMesh4 = new THREE.Mesh(textGeometry4, textMaterial4);
    textMesh4.position.set(0.12, -0.06 - 0.018, 0);

    mainUIText.add(textMesh1);
    mainUIText.add(textMesh2);
    mainUIText.add(textMesh3a);
    mainUIText.add(textMesh3b);
    mainUIText.add(textMesh4);
    mainUIText.position.x = fixedLeftPosition;

    mainUI.add(mainUIText);
  }

  function updateBurgerText() {
    if (!mainUIText || !fontBlack || !fontMedium || !fontBold) return;

    const currentSwitchStates = getSwitchStates();
    const burgerData = GetBurgerData(currentSwitchStates);
    const [d1, d2] = burgerData.description.split('\n');

    // Dispose old meshes
    for (let i = mainUIText.children.length - 1; i >= 0; i--) {
      const child = mainUIText.children[i];
      safeRemove(child);
    }

    // Rebuild meshes
    const tg1 = new TextGeometry(burgerData.name, {
      font: fontBlack,
      size: 0.025,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const tg2 = new TextGeometry('BURGER', {
      font: fontBlack,
      size: 0.025,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const tg3a = new TextGeometry(d1, {
      font: fontMedium,
      size: 0.011,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const tg3b = new TextGeometry(d2, {
      font: fontMedium,
      size: 0.011,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    tg1.computeBoundingBox();
    tg2.computeBoundingBox();
    tg3a.computeBoundingBox();
    tg3b.computeBoundingBox();
    const h1 = tg1.boundingBox.max.y - tg1.boundingBox.min.y;
    const h2 = tg2.boundingBox.max.y - tg2.boundingBox.min.y;
    const h3a = tg3a.boundingBox.max.y - tg3a.boundingBox.min.y;
    tg1.translate(0, h1 / 2, 0.001);
    tg2.translate(0, -h2 / 2, 0.001);
    tg3a.translate(0, -h3a * 2, 0.001);
    tg3b.translate(0, -h3a * 3, 0.001);

    const tm1 = new THREE.Mesh(tg1, textMaterial);
    const tm2 = new THREE.Mesh(tg2, textMaterial);
    const tm3a = new THREE.Mesh(tg3a, textMaterial3);
    const tm3b = new THREE.Mesh(tg3b, textMaterial3);
    tm1.position.y = 0.004 + 0.04;
    tm2.position.y = -0.004 + 0.04;
    tm3a.position.set(0.001, -0.02 + 0.045, 0);
    tm3b.position.set(0.001, -0.025 + 0.045, 0);

    const tg4 = new TextGeometry(burgerData.price, {
      font: fontBold,
      size: 0.028,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    const tm4 = new THREE.Mesh(tg4, new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
    tm4.position.set(0.12, -0.06 - 0.018, 0);

    mainUIText.add(tm1);
    mainUIText.add(tm2);
    mainUIText.add(tm3a);
    mainUIText.add(tm3b);
    mainUIText.add(tm4);
    mainUIText.position.x = -0.102;
  }

  function updateSwitchTexture(index, isOn) {
    if (index < 0 || index >= partUIs.length) return;
    partUIs[index].material.map = switchTextures[index][isOn ? 'ON' : 'OFF'];
    partUIs[index].material.needsUpdate = true;
  }

  function updateMainUIPosition(camera) {
    mainUI.position.copy(openUIRef.position);
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    const deltaX = cameraPos.x - mainUI.position.x;
    const deltaZ = cameraPos.z - mainUI.position.z;
    const angleY = Math.atan2(deltaX, deltaZ);
    mainUI.rotation.set(0, angleY, 0);
  }

  function showMainUIWithAnimation() {
    mainUI.visible = true;
    gsap.to(mainUI.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.25,
      ease: "power2.out"
    });
  }

  function animateArrowPlanes(clock) {
    if (topArrowPlane) {
      const time = clock.getElapsedTime();
      const baseY = 1;
      const amplitude = 0.05;
      const frequency = 8;
      topArrowPlane.position.y = baseY + Math.sin(time * frequency) * amplitude;
    }
    if (bottomArrowPlane) {
      const time = clock.getElapsedTime();
      const baseY = -0.8;
      const amplitude = 0.05;
      const frequency = 8;
      bottomArrowPlane.position.y = baseY - Math.sin(time * frequency) * amplitude;
    }
  }

  // Expose function to update switchStates reference if needed
  function setSwitchStatesRef(newSwitchStates) {
    switchStates = newSwitchStates;
  }

  return {
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
  };
}

