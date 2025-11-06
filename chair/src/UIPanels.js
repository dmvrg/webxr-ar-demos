import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export function createUIPanels(baseComposition) {
  const textureLoader = new THREE.TextureLoader();

  // UI Frame
  const frameGeometry = new THREE.PlaneGeometry(0.4, 0.6);
  const uiFrameTexture = textureLoader.load('/static/ui_frame.png');
  const frameMaterial = new THREE.MeshBasicMaterial({
    map: uiFrameTexture,
    transparent: true,
    opacity: 0.4,
    side: THREE.FrontSide
  });
  const uiFrame = new THREE.Mesh(frameGeometry, frameMaterial);
  uiFrame.position.set(0, 0, 0);
  baseComposition.add(uiFrame);

  // Header toggle
  const headerToggleGeometry = new THREE.PlaneGeometry(0.38666, 0.0661);
  const uiHeaderTexture = textureLoader.load('/static/ui_header-toggle.png');
  const headerToggleMaterial = new THREE.MeshBasicMaterial({
    map: uiHeaderTexture,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const headerToggle = new THREE.Mesh(headerToggleGeometry, headerToggleMaterial);
  headerToggle.position.set(0, 0.26, 0);
  headerToggle.scale.set(0, 0, 0); // start hidden
  baseComposition.add(headerToggle);

  // Switch plane child
  const switchWidth = 0.38666 * 0.432;
  const switchHeight = (switchWidth * 44) / 145;
  const headerToggleSwitchGeometry = new THREE.PlaneGeometry(switchWidth, switchHeight);
  const uiHeaderSwitchTexture = textureLoader.load('/static/ui_header-toggle-switch.png');
  const headerToggleSwitchMaterial = new THREE.MeshBasicMaterial({
    map: uiHeaderSwitchTexture,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const headerToggleSwitchMesh = new THREE.Mesh(
    headerToggleSwitchGeometry,
    headerToggleSwitchMaterial
  );

  const togglePosA = new THREE.Vector3(-0.1, 0, 0.001); // left (Material)
  const togglePosB = new THREE.Vector3(0.05, 0, 0.001); // right (Sizes)
  headerToggleSwitchMesh.position.copy(togglePosA);
  headerToggle.add(headerToggleSwitchMesh);

  // Text labels ("Material" / "Sizes")
  let materialTextMesh = null;
  let sizesTextMesh = null;

  const fontLoader = new FontLoader();
  fontLoader.load('/static/fonts/helvetiker_regular.typeface.json', font => {
    const textDefaultMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });

    const textActiveMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700, // yellow highlight
      transparent: true,
      opacity: 0.9
    });

    // Material text
    const materialTextGeometry = new TextGeometry('Material', {
      font,
      size: 0.02,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    materialTextMesh = new THREE.Mesh(materialTextGeometry, textActiveMaterial); // start ACTIVE
    materialTextGeometry.computeBoundingBox();
    materialTextMesh.position.set(togglePosA.x, togglePosA.y - 0.01, togglePosA.z + 0.002);
    materialTextMesh.position.x -= materialTextGeometry.boundingBox.max.x * 0.5;
    headerToggle.add(materialTextMesh);

    // Sizes text
    const sizesTextGeometry = new TextGeometry('Sizes', {
      font,
      size: 0.02,
      depth: 0,
      curveSegments: 12,
      bevelEnabled: false
    });
    sizesTextMesh = new THREE.Mesh(sizesTextGeometry, textDefaultMaterial); // start DEFAULT
    sizesTextGeometry.computeBoundingBox();
    sizesTextMesh.position.set(togglePosB.x, togglePosB.y - 0.01, togglePosB.z + 0.002);
    sizesTextMesh.position.x -= sizesTextGeometry.boundingBox.max.x * 0.5;
    headerToggle.add(sizesTextMesh);

    // Store materials so ChairExperience.updateToggleTextColors can swap them
    materialTextMesh.userData = materialTextMesh.userData || {};
    sizesTextMesh.userData = sizesTextMesh.userData || {};

    materialTextMesh.userData.defaultMaterial = textDefaultMaterial;
    materialTextMesh.userData.activeMaterial = textActiveMaterial;

    sizesTextMesh.userData.defaultMaterial = textDefaultMaterial;
    sizesTextMesh.userData.activeMaterial = textActiveMaterial;
  });

  // Color panel (invisible plane – parent for buttons)
  const colorPanelGeometry = new THREE.PlaneGeometry(0.091, 0.278);
  const colorPanelMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const colorPanel = new THREE.Mesh(colorPanelGeometry, colorPanelMaterial);
  colorPanel.position.set(-0.26, 0, 0.06);
  baseComposition.add(colorPanel);

  // Color buttons
  const button1Texture = textureLoader.load('/static/ui_button1.png');
  const button2Texture = textureLoader.load('/static/ui_button2.png');
  const button3Texture = textureLoader.load('/static/ui_button3.png');
  const buttonStrokeTexture = textureLoader.load('/static/ui_buttonstroke.png');

  function makeButton(texture, y) {
    const geo = new THREE.PlaneGeometry(0.06, 0.06);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, 0);
    colorPanel.add(mesh);
    return mesh;
  }

  const button1Mesh = makeButton(button1Texture, 0.09);
  const button2Mesh = makeButton(button2Texture, 0.0);
  const button3Mesh = makeButton(button3Texture, -0.09);

  function makeStroke(y) {
    const geo = new THREE.PlaneGeometry(0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      map: buttonStrokeTexture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, -0.001);
    colorPanel.add(mesh);
    return mesh;
  }

  const buttonStroke1Mesh = makeStroke(0.09);
  buttonStroke1Mesh.scale.set(1, 1, 1); // default selected
  const buttonStroke2Mesh = makeStroke(0.0);
  buttonStroke2Mesh.scale.set(0, 0, 0);
  const buttonStroke3Mesh = makeStroke(-0.09);
  buttonStroke3Mesh.scale.set(0, 0, 0);

  // Info panel
  const infoPanelGeometry = new THREE.PlaneGeometry(0.25, 0.25);
  const uiInfoTexture = textureLoader.load('/static/ui_info.png');
  const infoPanelMaterial = new THREE.MeshBasicMaterial({
    map: uiInfoTexture,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const infoPanel = new THREE.Mesh(infoPanelGeometry, infoPanelMaterial);
  infoPanel.position.set(0.2, -0.17, 0.16);
  baseComposition.add(infoPanel);

  // Switch button + dot + pullPlane + string root
  const switchButtonGeo = new THREE.SphereGeometry(0.018, 32, 32);
  const switchButtonMat = new THREE.MeshBasicMaterial({
    color: 0xffd700
  });
  const switchButton = new THREE.Mesh(switchButtonGeo, switchButtonMat);
  switchButton.position.set(0.16, 0.26, 0.0);
  baseComposition.add(switchButton);

  const pullPlaneGeo = new THREE.PlaneGeometry(0.066, 0.0462);
  const uiPullTexture = textureLoader.load('/static/ui_pull.png');
  const pullPlaneMat = new THREE.MeshBasicMaterial({
    map: uiPullTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const pullPlane = new THREE.Mesh(pullPlaneGeo, pullPlaneMat);
  pullPlane.position.set(0.16, 0.31, 0.01);
  baseComposition.add(pullPlane);

  const switchRoot = new THREE.Object3D();
  switchRoot.position.copy(switchButton.position);
  baseComposition.add(switchRoot);

  const switchDotGeo = new THREE.SphereGeometry(0.006, 32, 32);
  const switchDotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    depthTest: false,
    depthWrite: false
  });
  const switchDot = new THREE.Mesh(switchDotGeo, switchDotMat);
  switchDot.position.set(0.16, 0.26, 0.0);
  baseComposition.add(switchDot);

  return {
    uiFrame,
    headerToggle,
    headerToggleSwitchMesh,
    togglePosA,
    togglePosB,
    materialTextMesh,
    sizesTextMesh,
    colorPanel,
    button1Mesh,
    button2Mesh,
    button3Mesh,
    buttonStroke1Mesh,
    buttonStroke2Mesh,
    buttonStroke3Mesh,
    infoPanel,
    switchButton,
    switchDot,
    pullPlane,
    switchRoot
  };
}
