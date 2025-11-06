import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import gsap from 'gsap';

import { createUIPanels } from './UIPanels.js';
import {
  preloadSizesShaders,
  getOrCreateSizesMaterial,
  applyFresnelToChair,
  restoreOriginalMaterials
} from './Shaders.js';

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export class ChairExperience {
  constructor(scene, camera, renderer, handInput) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.handInput = handInput;

    // state vars
    this.baseComposition = null;
    this.chairModel = null;
    this.sizesModel = null;
    this.buttonState = false;          // false = closed, true = open
    this.headerToggleIsRight = false;  // false = Material, true = Sizes

    this.delta = 0;
    this.clock = new THREE.Clock();

    this.stringMesh = null;
    this.switchButton = null;
    this.switchRoot = null;
    this.pullPlane = null;

    // header toggle touch cooldown
    this.headerToggleLastTouchMs = 0;
    this.HEADER_TOGGLE_TOUCH_COOLDOWN_MS = 400;

    // pull switch
    this.switchButtonAttached = false;
    this.switchPullCount = 0;

    // button cooldowns
    this.buttonCooldowns = {
      button1: 0,
      button2: 0,
      button3: 0
    };
    this.BUTTON_COOLDOWN_TIME = 500;

    this.buttonResetTimers = {
      button1: 0,
      button2: 0,
      button3: 0
    };
    this.BUTTON_RESET_DELAY = 300;

    this.plasticMaterials = [];

    // dynamic resolution state
    this.MAX_PR = 1.5;
    this.targetMs = 1000 / 72;
    this.adaptivePR = Math.min(window.devicePixelRatio, this.MAX_PR);
    this.accum = 0;

    // composition positioning
    this.compositionPositioned = false;
    this.xrSessionStartTime = null;

    // temp math objects (to avoid per-frame allocations)
    this._vA = new THREE.Vector3();
    this._vB = new THREE.Vector3();
    this._vC = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._tmp1 = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._tmp3 = new THREE.Vector3();
  }

  /* ----------------------------------------------------------------
   * Setup
   * -------------------------------------------------------------- */

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 8, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(512, 512);
    mainLight.shadow.bias = -0.0005;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.autoUpdate = false;
    this.scene.add(mainLight);
    this.mainLight = mainLight;

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-3, 6, -2);
    this.scene.add(fillLight);
  }

  initBaseComposition() {
    const tempGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const tempMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
      depthWrite: false
    });
    this.baseComposition = new THREE.Mesh(tempGeo, tempMat);
    this.baseComposition.scale.set(1, 1, 1);
    this.baseComposition.visible = false; // hidden until XR starts
    this.scene.add(this.baseComposition);
  }

  setupEnvMap() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const hdrLoader = new HDRLoader();
    hdrLoader.load('/static/2k.hdr', hdrTexture => {
      const envRT = pmremGenerator.fromEquirectangular(hdrTexture);
      hdrTexture.dispose();
      pmremGenerator.dispose();
      this.scene.environment = envRT.texture;
    });
  }

  async loadModelsAndUI() {
    const loader = new GLTFLoader();

    // --- Load chair.glb ---
    const chairGltf = await loader.loadAsync('/static/chair.glb');
    this.chairModel = chairGltf.scene;
    this.chairModel.scale.set(0.5, 0.5, 0.5);
    this.chairModel.position.set(0, -0.25, 0);
    this.chairModel.rotation.set(0, -0.7, 0);

    this.chairModel.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.isOriginalChair = true;
      }
    });

    this.baseComposition.add(this.chairModel);

    this.improveMaterials(this.chairModel);

    // Dev helper
    window.refreshChairMaterials = () => this.improveMaterials(this.chairModel);

    // --- Load sizes.glb ---
    const sizesGltf = await loader.loadAsync('/static/sizes.glb');
    this.sizesModel = sizesGltf.scene;

    await preloadSizesShaders();
    const sizesMat = getOrCreateSizesMaterial();

    this.sizesModel.traverse(child => {
      if (child.isMesh) {
        child.material = sizesMat;
        child.castShadow = true;
        child.receiveShadow = true;
        child.renderOrder = 1000;
      }
    });

    this.chairModel.add(this.sizesModel);
    this.sizesModel.visible = false;

    // size labels
    this.createSizeLabels();

    // --- UI panels ---
    const ui = createUIPanels(this.baseComposition);
    // uiFrame, headerToggle, headerToggleSwitchMesh, togglePosA, togglePosB,
    // materialTextMesh, sizesTextMesh, colorPanel, button1Mesh, button2Mesh,
    // button3Mesh, buttonStroke1Mesh, buttonStroke2Mesh, buttonStroke3Mesh,
    // infoPanel, switchButton, switchDot, pullPlane, switchRoot
    Object.assign(this, ui);

    // String between switchRoot & switchButton
    const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.1, 8);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.stringMesh = new THREE.Mesh(stringGeo, stringMat);
    this.baseComposition.add(this.stringMesh);
  }

  /* ----------------------------------------------------------------
   * Size labels on sizesModel
   * -------------------------------------------------------------- */

  createSizeLabels() {
    if (!this.sizesModel) return;

    const fontLoader = new FontLoader();
    fontLoader.load('/static/fonts/helvetiker_regular.typeface.json', font => {
      // ---- Label 0: 16.0" ----
      const geo0 = new TextGeometry('16.0"', {
        font,
        size: 0.04,
        depth: 0,
        curveSegments: 12,
        bevelEnabled: false
      });
      const mat0 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
      });
      const sizeTextMesh0 = new THREE.Mesh(geo0, mat0);

      geo0.computeBoundingBox();
      sizeTextMesh0.position.x -= geo0.boundingBox.max.x * 0.5; // center
      sizeTextMesh0.position.y = 0.2;
      sizeTextMesh0.position.z = 0.03;
      this.sizesModel.add(sizeTextMesh0);

      // ---- Label 1: 31.5" ----
      const geo1 = new TextGeometry('31.5"', {
        font,
        size: 0.04,
        depth: 0,
        curveSegments: 12,
        bevelEnabled: false
      });
      const mat1 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
      });
      const sizeTextMesh1 = new THREE.Mesh(geo1, mat1);

      geo1.computeBoundingBox();
      sizeTextMesh1.position.x = -geo1.boundingBox.max.x * 0.5 + 0.06;
      sizeTextMesh1.position.y = 0.43;
      sizeTextMesh1.position.z = -0.34;
      sizeTextMesh1.rotation.y = Math.PI / 2;
      this.sizesModel.add(sizeTextMesh1);

      // ---- Label 2: 24.5" ----
      const geo2 = new TextGeometry('24.5"', {
        font,
        size: 0.04,
        depth: 0,
        curveSegments: 12,
        bevelEnabled: false
      });
      const mat2 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
      });
      const sizeTextMesh2 = new THREE.Mesh(geo2, mat2);

      geo2.computeBoundingBox();
      sizeTextMesh2.position.x = -geo2.boundingBox.max.x * 0.5;
      sizeTextMesh2.position.y = 0.0;
      sizeTextMesh2.position.z = 0.27;
      sizeTextMesh2.rotation.x = -Math.PI / 2;
      this.sizesModel.add(sizeTextMesh2);

      // ---- Label 3: 23.5" ----
      const geo3 = new TextGeometry('23.5"', {
        font,
        size: 0.04,
        depth: 0,
        curveSegments: 12,
        bevelEnabled: false
      });
      const mat3 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
      });
      const sizeTextMesh3 = new THREE.Mesh(geo3, mat3);

      geo3.computeBoundingBox();
      sizeTextMesh3.position.x = -geo3.boundingBox.max.x * 0.5 + 0.35;
      sizeTextMesh3.position.y = 0.0;
      sizeTextMesh3.position.z = 0.06;
      sizeTextMesh3.rotation.x = sizeTextMesh2.rotation.x; // -PI/2
      sizeTextMesh3.rotation.y = 0;
      sizeTextMesh3.rotation.z = Math.PI / 2;
      this.sizesModel.add(sizeTextMesh3);
    });
  }

  /* ----------------------------------------------------------------
   * Materials
   * -------------------------------------------------------------- */

  improveMaterials(model) {
    if (!model) return;
    model.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => this.createImprovedMaterial(mat));
        } else {
          child.material = this.createImprovedMaterial(child.material);
        }
      }
    });
  }

  createImprovedMaterial(originalMat) {
    const props = this.getMaterialProperties(originalMat.name);
    const cfg = {
      color: props.color,
      roughness: props.roughness,
      metalness: props.metalness,
      envMapIntensity: props.envMapIntensity
    };

    if (originalMat.map) cfg.map = originalMat.map;
    if (originalMat.normalMap) {
      cfg.normalMap = originalMat.normalMap;
      cfg.normalScale = new THREE.Vector2(1, 1);
    }
    if (originalMat.roughnessMap) cfg.roughnessMap = originalMat.roughnessMap;
    if (originalMat.metalnessMap) cfg.metalnessMap = originalMat.metalnessMap;
    if (originalMat.aoMap) cfg.aoMap = originalMat.aoMap;

    const mat = new THREE.MeshStandardMaterial(cfg);
    mat.name = originalMat.name || 'ImprovedMaterial';

    if (mat.name.includes('Plastic')) this.plasticMaterials.push(mat);

    return mat;
  }

  getMaterialProperties(name = '') {
    if (name === 'Metal') {
      return {
        color: 0x888888,
        roughness: 0.15,
        metalness: 0.9,
        envMapIntensity: 1.2
      };
    }
    if (name === 'BlackMetal') {
      return {
        color: 0x444444,
        roughness: 0.2,
        metalness: 0.9,
        envMapIntensity: 1.0
      };
    }
    if (name.includes('Plastic')) {
      return {
        color: 0x4682b4,
        roughness: 0.25,
        metalness: 0.0,
        envMapIntensity: 2.0
      };
    }
    if (name.includes('Wood')) {
      return {
        color: 0xbd884a,
        roughness: 0.8,
        metalness: 0.0,
        envMapIntensity: 0.4
      };
    }
    return {
      color: 0x4682b4,
      roughness: 0.7,
      metalness: 0.1,
      envMapIntensity: 1.0
    };
  }

  changePlasticMaterialColor(newColor) {
    if (!this.plasticMaterials.length) return;
    const c = new THREE.Color(newColor);
    this.plasticMaterials.forEach(mat => mat.color.copy(c));
  }

  /* ----------------------------------------------------------------
   * XR session hooks
   * -------------------------------------------------------------- */

  onSessionStart() {
    this.xrSessionStartTime = Date.now();
    this.compositionPositioned = false;
    if (this.baseComposition) this.baseComposition.visible = true;
    document.body.classList.add('xr-presenting');
  }

  onSessionEnd() {
    this.xrSessionStartTime = null;
    this.compositionPositioned = false;
    if (this.baseComposition) this.baseComposition.visible = false;
    document.body.classList.remove('xr-presenting');
  }

  positionCompositionAtHeadHeight() {
    if (this.compositionPositioned || !this.xrSessionStartTime || !this.baseComposition) return;
    const elapsedTime = Date.now() - this.xrSessionStartTime;
    if (elapsedTime < 1000) return;

    const headHeight = this.camera.position.y;
    const headDistance = this.camera.position.z;
    this.baseComposition.position.set(0, headHeight - 0.2, headDistance - 1.0);
    this.compositionPositioned = true;
  }

  /* ----------------------------------------------------------------
   * String between switchRoot & switchButton
   * -------------------------------------------------------------- */

  stringUpdate() {
    if (!this.stringMesh || !this.switchButton || !this.switchRoot) return;

    const A = this._vA.copy(this.switchRoot.position);
    const B = this._vB.copy(this.switchButton.position);
    const dir = this._vC.subVectors(B, A);
    const dist = dir.length();

    this.stringMesh.position.copy(A).addScaledVector(dir, 0.5);
    this.stringMesh.scale.setY(dist / 0.1);

    if (dist > 0.001) {
      dir.normalize();
      this._q.setFromUnitVectors(UP_VECTOR, dir);
      this.stringMesh.quaternion.copy(this._q);
    }
  }

  /* ----------------------------------------------------------------
   * Header toggle (Material / Sizes)
   * -------------------------------------------------------------- */

  updateToggleTextColors() {
    if (!this.materialTextMesh || !this.sizesTextMesh) return;

    if (this.headerToggleIsRight) {
      // Sizes active
      if (this.materialTextMesh.userData?.defaultMaterial) {
        this.materialTextMesh.material = this.materialTextMesh.userData.defaultMaterial;
      }
      if (this.sizesTextMesh.userData?.activeMaterial) {
        this.sizesTextMesh.material = this.sizesTextMesh.userData.activeMaterial;
      }
    } else {
      // Material active
      if (this.materialTextMesh.userData?.activeMaterial) {
        this.materialTextMesh.material = this.materialTextMesh.userData.activeMaterial;
      }
      if (this.sizesTextMesh.userData?.defaultMaterial) {
        this.sizesTextMesh.material = this.sizesTextMesh.userData.defaultMaterial;
      }
    }
  }

  setHeaderToggleState(stateBool, animate = true) {
    this.headerToggleIsRight = !!stateBool;

    if (this.headerToggleSwitchMesh && this.togglePosA && this.togglePosB) {
      const target = this.headerToggleIsRight ? this.togglePosB : this.togglePosA;

      gsap.killTweensOf(this.headerToggleSwitchMesh.position);

      if (animate) {
        gsap.to(this.headerToggleSwitchMesh.position, {
          duration: 0.25,
          x: target.x,
          y: target.y,
          z: target.z,
          ease: 'power2.inOut'
        });
      } else {
        this.headerToggleSwitchMesh.position.copy(target);
      }
    }

    this.updateToggleTextColors();

    // If chair is open, apply appropriate materials
    if (this.buttonState && this.chairModel) {
      if (this.headerToggleIsRight) {
        applyFresnelToChair(this.chairModel);
      } else {
        restoreOriginalMaterials(this.chairModel);
      }
    }

    if (this.sizesModel) {
      this.sizesModel.visible = this.buttonState && this.headerToggleIsRight;
    }
  }

  handleHeaderToggleTouch(availableHands) {
    if (!this.headerToggle || !this.headerToggleSwitchMesh || !this.togglePosA || !this.togglePosB) {
      return;
    }

    this.headerToggle.localToWorld(this._vA.copy(this.togglePosA));
    this.headerToggle.localToWorld(this._vB.copy(this.togglePosB));

    const touchThreshold = 0.04;
    let nearLeft = false;
    let nearRight = false;

    for (let i = 0; i < availableHands.length; i++) {
      const hand = availableHands[i];
      if (!hand || !hand.joints) continue;

      const indexJoint = hand.joints['index-finger-tip'];
      if (!indexJoint) continue;

      const indexPos = indexJoint.position;
      nearLeft = nearLeft || indexPos.distanceTo(this._vA) < touchThreshold;
      nearRight = nearRight || indexPos.distanceTo(this._vB) < touchThreshold;
    }

    const nowMs = performance.now();
    const cooldownPassed =
      nowMs - this.headerToggleLastTouchMs > this.HEADER_TOGGLE_TOUCH_COOLDOWN_MS;

    if ((nearLeft || nearRight) && cooldownPassed) {
      this.setHeaderToggleState(!this.headerToggleIsRight);
      this.headerToggleLastTouchMs = nowMs;
    }
  }

  /* ----------------------------------------------------------------
   * Pull switch interaction
   * -------------------------------------------------------------- */

  handleSwitchButton() {
    if (!this.switchButton || !this.baseComposition || !this.switchRoot || !this.handInput) return;

    const lPinchOn = this.handInput.lPinchOn;
    const rPinchOn = this.handInput.rPinchOn;
    const lPinchSphere = this.handInput.lPinchSphere;
    const rPinchSphere = this.handInput.rPinchSphere;

    let activePinchSphere = null;
    let activePinchOn = false;

    if (lPinchOn && rPinchOn) {
      const lDist = lPinchSphere.position.distanceTo(this.switchButton.position);
      const rDist = rPinchSphere.position.distanceTo(this.switchButton.position);
      activePinchSphere = lDist < rDist ? lPinchSphere : rPinchSphere;
      activePinchOn = true;
    } else if (lPinchOn) {
      activePinchSphere = lPinchSphere;
      activePinchOn = true;
    } else if (rPinchOn) {
      activePinchSphere = rPinchSphere;
      activePinchOn = true;
    }

    if (activePinchSphere && activePinchOn) {
      activePinchSphere.getWorldPosition(this._tmp1);
      this.switchButton.getWorldPosition(this._tmp2);
      const distanceToButton = this._tmp1.distanceTo(this._tmp2);

      if (distanceToButton < 0.08 && !this.switchButtonAttached) {
        this.switchButtonAttached = true;
      }

      if (this.switchButtonAttached) {
        activePinchSphere.getWorldPosition(this._tmp1);
        const localPos = this.baseComposition.worldToLocal(this._tmp1.clone());
        this.switchButton.position.copy(localPos);
      }
    }

    // Release → snap back + toggle state
    if (!lPinchOn && !rPinchOn && this.switchButtonAttached) {
      const switchRootWorld = this._tmp1;
      this.switchRoot.getWorldPosition(switchRootWorld);
      const localTarget = this.baseComposition.worldToLocal(switchRootWorld.clone());

      this.buttonState = !this.buttonState;
      this.updateChairState();

      gsap.to(this.switchButton.position, {
        duration: 0.6,
        x: localTarget.x,
        y: localTarget.y,
        z: localTarget.z,
        ease: 'elastic.out(0.5, 0.2)'
      });

      this.switchButtonAttached = false;

      this.switchPullCount++;
      if (this.switchPullCount >= 2 && this.pullPlane) {
        this.pullPlane.visible = false;
      }
    }
  }

  /* ----------------------------------------------------------------
   * Color buttons (Material palette)
   * -------------------------------------------------------------- */

  isButtonOnCooldown(buttonName) {
    const now = performance.now();
    return now - this.buttonCooldowns[buttonName] < this.BUTTON_COOLDOWN_TIME;
  }

  setButtonCooldown(buttonName) {
    this.buttonCooldowns[buttonName] = performance.now();
  }

  updateButtonStrokes(activeButton) {
    if (!this.buttonStroke1Mesh || !this.buttonStroke2Mesh || !this.buttonStroke3Mesh) return;

    // scale all to 0
    gsap.to(this.buttonStroke1Mesh.scale, { duration: 0.2, x: 0, y: 0, z: 0, ease: 'power2.out' });
    gsap.to(this.buttonStroke2Mesh.scale, { duration: 0.2, x: 0, y: 0, z: 0, ease: 'power2.out' });
    gsap.to(this.buttonStroke3Mesh.scale, { duration: 0.2, x: 0, y: 0, z: 0, ease: 'power2.out' });

    const STROKE_DELAY = 0.3;
    let targetMesh = null;
    if (activeButton === 'button1') targetMesh = this.buttonStroke1Mesh;
    if (activeButton === 'button2') targetMesh = this.buttonStroke2Mesh;
    if (activeButton === 'button3') targetMesh = this.buttonStroke3Mesh;
    if (!targetMesh) return;

    gsap.to(targetMesh.scale, {
      duration: 0.2,
      delay: STROKE_DELAY,
      x: 1,
      y: 1,
      z: 1,
      ease: 'power2.out'
    });
  }

  handleColorButtons(availableHands, nowMs) {
    if (!this.button1Mesh || !this.button2Mesh || !this.button3Mesh) return;

    // Only when switch is OFF (closed state)
    if (this.buttonState) return;

    let buttonPressed = false;

    for (let i = 0; i < availableHands.length && !buttonPressed; i++) {
      const hand = availableHands[i];
      if (!hand || !hand.joints) continue;

      const indexJoint = hand.joints['index-finger-tip'];
      if (!indexJoint) continue;

      const indexPos = indexJoint.position;

      this.button1Mesh.getWorldPosition(this._vA);
      this.button2Mesh.getWorldPosition(this._vB);
      this.button3Mesh.getWorldPosition(this._vC);

      const d1 = indexPos.distanceTo(this._vA);
      const d2 = indexPos.distanceTo(this._vB);
      const d3 = indexPos.distanceTo(this._vC);

      if (d1 < 0.03 && !this.isButtonOnCooldown('button1')) {
        this.changePlasticMaterialColor(0x4682b4); // Blue
        gsap.killTweensOf(this.button1Mesh.scale);
        gsap.to(this.button1Mesh.scale, {
          duration: 0.2,
          x: 0.8,
          y: 0.8,
          z: 0.8,
          ease: 'power2.out'
        });
        this.updateButtonStrokes('button1');
        this.setButtonCooldown('button1');
        this.buttonResetTimers.button1 = nowMs + this.BUTTON_RESET_DELAY;
        buttonPressed = true;
      } else if (d2 < 0.03 && !this.isButtonOnCooldown('button2')) {
        this.changePlasticMaterialColor(0xb20000); // Red
        gsap.killTweensOf(this.button2Mesh.scale);
        gsap.to(this.button2Mesh.scale, {
          duration: 0.2,
          x: 0.8,
          y: 0.8,
          z: 0.8,
          ease: 'power2.out'
        });
        this.updateButtonStrokes('button2');
        this.setButtonCooldown('button2');
        this.buttonResetTimers.button2 = nowMs + this.BUTTON_RESET_DELAY;
        buttonPressed = true;
      } else if (d3 < 0.03 && !this.isButtonOnCooldown('button3')) {
        this.changePlasticMaterialColor(0xf08805); // Orange
        gsap.killTweensOf(this.button3Mesh.scale);
        gsap.to(this.button3Mesh.scale, {
          duration: 0.2,
          x: 0.8,
          y: 0.8,
          z: 0.8,
          ease: 'power2.out'
        });
        this.updateButtonStrokes('button3');
        this.setButtonCooldown('button3');
        this.buttonResetTimers.button3 = nowMs + this.BUTTON_RESET_DELAY;
        buttonPressed = true;
      }
    }

    // Reset button scales back to normal after delay
    if (nowMs > this.buttonResetTimers.button1) {
      gsap.killTweensOf(this.button1Mesh.scale);
      gsap.to(this.button1Mesh.scale, {
        duration: 0.2,
        x: 1,
        y: 1,
        z: 1,
        ease: 'power2.out'
      });
    }

    if (nowMs > this.buttonResetTimers.button2) {
      gsap.killTweensOf(this.button2Mesh.scale);
      gsap.to(this.button2Mesh.scale, {
        duration: 0.2,
        x: 1,
        y: 1,
        z: 1,
        ease: 'power2.out'
      });
    }

    if (nowMs > this.buttonResetTimers.button3) {
      gsap.killTweensOf(this.button3Mesh.scale);
      gsap.to(this.button3Mesh.scale, {
        duration: 0.2,
        x: 1,
        y: 1,
        z: 1,
        ease: 'power2.out'
      });
    }
  }

  /* ----------------------------------------------------------------
   * Chair state (open / closed)
   * -------------------------------------------------------------- */

  updateChairState() {
    if (!this.chairModel) return;

    // Force shadow refresh when chair state changes
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.mainLight && this.mainLight.shadow) {
      this.mainLight.shadow.needsUpdate = true;
    }

    if (this.buttonState) {
      // Button is ON - transform chair to OPEN state
      gsap.to(this.chairModel.scale, {
        duration: 0.5,
        x: 1.1,
        y: 1.1,
        z: 1.1,
        ease: 'power2.out'
      });

      gsap.to(this.chairModel.position, {
        duration: 0.5,
        x: 0,
        y: -1.35,
        z: 0,
        ease: 'power2.out'
      });

      if (this.uiFrame) {
        gsap.to(this.uiFrame.scale, {
          duration: 0.3,
          x: 0,
          y: 0,
          z: 0,
          ease: 'power2.out'
        });
      }

      if (this.infoPanel) {
        gsap.to(this.infoPanel.scale, {
          duration: 0.3,
          x: 0,
          y: 0,
          z: 0,
          ease: 'power2.out'
        });
      }

      if (this.colorPanel) {
        gsap.to(this.colorPanel.scale, {
          duration: 0.3,
          x: 0,
          y: 0,
          z: 0,
          ease: 'power2.out'
        });
      }

      if (this.headerToggle) {
        gsap.to(this.headerToggle.scale, {
          duration: 0.3,
          x: 1,
          y: 1,
          z: 1,
          ease: 'power2.out'
        });
      }

      this.updateToggleTextColors();

      // Apply materials based on current toggle mode
      if (this.headerToggleIsRight) {
        applyFresnelToChair(this.chairModel);
      } else {
        restoreOriginalMaterials(this.chairModel);
      }

      if (this.sizesModel) {
        this.sizesModel.visible = this.headerToggleIsRight;
      }
    } else {
      // Button is OFF - transform chair back to closed state
      gsap.to(this.chairModel.scale, {
        duration: 0.4,
        x: 0.5,
        y: 0.5,
        z: 0.5,
        ease: 'power2.out'
      });

      gsap.to(this.chairModel.position, {
        duration: 0.4,
        x: 0,
        y: -0.25,
        z: 0,
        ease: 'power2.out'
      });

      if (this.uiFrame) {
        gsap.to(this.uiFrame.scale, {
          duration: 0.3,
          x: 1,
          y: 1,
          z: 1,
          ease: 'power2.out'
        });
      }

      if (this.infoPanel) {
        gsap.to(this.infoPanel.scale, {
          duration: 0.3,
          x: 1,
          y: 1,
          z: 1,
          ease: 'power2.out'
        });
      }

      if (this.colorPanel) {
        gsap.to(this.colorPanel.scale, {
          duration: 0.3,
          x: 1,
          y: 1,
          z: 1,
          ease: 'power2.out'
        });
      }

      if (this.headerToggle) {
        gsap.to(this.headerToggle.scale, {
          duration: 0.3,
          x: 0,
          y: 0,
          z: 0,
          ease: 'power2.out'
        });
        // Reset header toggle to Material (left) so next opening starts there (no animation)
        this.setHeaderToggleState(false, false);
      }

      this.updateToggleTextColors();
      restoreOriginalMaterials(this.chairModel);

      if (this.sizesModel) {
        this.sizesModel.visible = false;
      }
    }
  }

  /* ----------------------------------------------------------------
   * Per-frame update
   * -------------------------------------------------------------- */

  update(delta, t) {
    // dynamic res scaling
    this.delta = delta;
    const ms = delta * 1000;
    this.accum = 0.9 * this.accum + 0.1 * ms;
    if (this.accum > this.targetMs * 1.15 && this.adaptivePR > 1.0) {
      this.adaptivePR = Math.max(1.0, this.adaptivePR - 0.05);
      this.renderer.setPixelRatio(this.adaptivePR);
    } else if (this.accum < this.targetMs * 0.9 && this.adaptivePR < this.MAX_PR) {
      this.adaptivePR = Math.min(this.MAX_PR, this.adaptivePR + 0.05);
      this.renderer.setPixelRatio(this.adaptivePR);
    }

    // Hand input: rotation + pinch state update
    if (this.handInput && this.chairModel) {
      this.handInput.onRotateChair = deltaRot => {
        this.chairModel.rotation.y += deltaRot;
      };
      this.handInput.update(delta, {
        chairModel: this.chairModel
      });
    }

    // Build availableHands from HandInput for index-based interactions
    const availableHands = [];
    if (this.handInput?.hand1 && this.handInput.hand1.joints) {
      availableHands.push(this.handInput.hand1);
    }
    if (this.handInput?.hand2 && this.handInput.hand2.joints) {
      availableHands.push(this.handInput.hand2);
    }

    const nowMs = performance.now();

    if (availableHands.length) {
      this.handleHeaderToggleTouch(availableHands);
      this.handleColorButtons(availableHands, nowMs);
    }

    this.handleSwitchButton();

    this.stringUpdate();
    this.positionCompositionAtHeadHeight();

    // pullPlane breathing
    if (this.pullPlane && this.pullPlane.visible) {
      const amplitude = 0.005;
      const frequency = 1.0;
      const timeInSeconds = t / 1000;
      const offset = Math.sin(timeInSeconds * frequency * Math.PI * 2) * amplitude;
      this.pullPlane.position.y = 0.31 + offset;
    }
  }
}
