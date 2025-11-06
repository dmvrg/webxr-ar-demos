import * as THREE from 'three';

const JOINT_RADIUS = 0.002;
const PINCH_RADIUS = 0.006;
const PINCH_THRESHOLD = 0.02;

export class HandInput {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    // Joint visual markers (invisible by default, but handy for debugging)
    const jointGeo = new THREE.SphereGeometry(JOINT_RADIUS, 16, 16);
    const jointMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0,
      transparent: true
    });

    this.lThumbObj = new THREE.Mesh(jointGeo, jointMat.clone());
    this.lIndexObj = new THREE.Mesh(jointGeo, jointMat.clone());
    this.rThumbObj = new THREE.Mesh(jointGeo, jointMat.clone());
    this.rIndexObj = new THREE.Mesh(jointGeo, jointMat.clone());

    scene.add(this.lThumbObj, this.lIndexObj, this.rThumbObj, this.rIndexObj);

    // Pinch spheres (kept for internal position, but always hidden)
    const pinchGeo = new THREE.SphereGeometry(PINCH_RADIUS, 16, 16);
    const lMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const rMat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

    this.lPinchSphere = new THREE.Mesh(pinchGeo, lMat);
    this.rPinchSphere = new THREE.Mesh(pinchGeo, rMat);
    scene.add(this.lPinchSphere, this.rPinchSphere);

    // always hidden
    this.lPinchSphere.visible = false;
    this.rPinchSphere.visible = false;

    // WebXR hand objects (no built-in meshes, just joint data)
    this.hand1 = renderer.xr.getHand(0); // usually left
    this.hand2 = renderer.xr.getHand(1); // usually right
    scene.add(this.hand1);
    scene.add(this.hand2);

    // Pinch state
    this.lPinchOn = false;
    this.rPinchOn = false;

    // Rotation state
    this.leftHandRotationActive = false;
    this.rightHandRotationActive = false;
    this.lastLeftHandX = 0;
    this.lastRightHandX = 0;
    this.chairRotationSpeed = 5.0;

    // External callback for rotation
    this.onRotateChair = null;

    // temp vectors
    this._tmp = new THREE.Vector3();
  }

  _getAvailableHands() {
    const hands = [];
    if (this.hand1 && this.hand1.joints) hands.push(this.hand1);
    if (this.hand2 && this.hand2.joints) hands.push(this.hand2);
    return hands;
  }

  /**
   * update should be called every frame
   * @param {number} delta
   * @param {object} opts
   *        opts.chairModel?: THREE.Object3D – used only for rotation callback
   */
  update(delta, opts = {}) {
    const { chairModel } = opts;
    const availableHands = this._getAvailableHands();
    const leftHand = availableHands[0] || null;
    const rightHand = availableHands[1] || availableHands[0] || null;

    // ensure pinch spheres stay hidden every frame
    this.lPinchSphere.visible = false;
    this.rPinchSphere.visible = false;

    // --- Joint tracking: thumb/index markers ---

    if (leftHand && leftHand.joints) {
      const thumb = leftHand.joints['thumb-tip'];
      const index = leftHand.joints['index-finger-tip'];
      if (thumb) this.lThumbObj.position.copy(thumb.position);
      if (index) this.lIndexObj.position.copy(index.position);
    }

    if (rightHand && rightHand.joints) {
      const thumb = rightHand.joints['thumb-tip'];
      const index = rightHand.joints['index-finger-tip'];
      if (thumb) this.rThumbObj.position.copy(thumb.position);
      if (index) this.rIndexObj.position.copy(index.position);
    }

    // --- Pinch detection ---

    this.lPinchOn = false;
    this.rPinchOn = false;

    // Left hand pinch
    if (
      leftHand &&
      leftHand.joints &&
      leftHand.joints['thumb-tip'] &&
      leftHand.joints['index-finger-tip']
    ) {
      const thumb = leftHand.joints['thumb-tip'];
      const index = leftHand.joints['index-finger-tip'];
      const dist = index.position.distanceTo(thumb.position);

      if (dist < PINCH_THRESHOLD) {
        this.lPinchOn = true;
        // still track position for interaction logic, just don't show it
        this.lPinchSphere.position.copy(thumb.position);
      }
    }

    // Right hand pinch
    if (
      rightHand &&
      rightHand.joints &&
      rightHand.joints['thumb-tip'] &&
      rightHand.joints['index-finger-tip']
    ) {
      const thumb = rightHand.joints['thumb-tip'];
      const index = rightHand.joints['index-finger-tip'];
      const dist = index.position.distanceTo(thumb.position);

      if (dist < PINCH_THRESHOLD) {
        this.rPinchOn = true;
        // still track position for interaction logic, just don't show it
        this.rPinchSphere.position.copy(thumb.position);
      }
    }

    // --- Chair rotation from horizontal pinch movement ---

    if (chairModel && this.onRotateChair) {
      // Left hand rotation
      if (this.lPinchOn && leftHand && leftHand.joints['thumb-tip']) {
        const x = leftHand.joints['thumb-tip'].position.x;
        if (!this.leftHandRotationActive) {
          this.leftHandRotationActive = true;
          this.lastLeftHandX = x;
        } else {
          const dx = x - this.lastLeftHandX;
          if (Math.abs(dx) > 0.001) {
            this.onRotateChair(dx * this.chairRotationSpeed);
          }
          this.lastLeftHandX = x;
        }
      } else {
        this.leftHandRotationActive = false;
      }

      // Right hand rotation (only if we actually have a second hand)
      if (
        availableHands.length > 1 &&
        this.rPinchOn &&
        rightHand &&
        rightHand.joints['thumb-tip']
      ) {
        const x = rightHand.joints['thumb-tip'].position.x;
        if (!this.rightHandRotationActive) {
          this.rightHandRotationActive = true;
          this.lastRightHandX = x;
        } else {
          const dx = x - this.lastRightHandX;
          if (Math.abs(dx) > 0.001) {
            this.onRotateChair(dx * this.chairRotationSpeed);
          }
          this.lastRightHandX = x;
        }
      } else {
        this.rightHandRotationActive = false;
      }
    }
  }
}
