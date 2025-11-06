import * as THREE from 'three';

export class HandInput {
  constructor(
    renderer,
    scene,
    { chairRotationSpeed = 4.0, maxUpDownRotation = Math.PI / 3 } = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.chairRotationSpeed = chairRotationSpeed;
    this.maxUpDownRotation = maxUpDownRotation;

    // Callbacks
    this.onPlaceO = null;
    this.onRotate = null;
    this.onButtonHit = null;

    this.buttonPlane = null;

    // Hands
    this.leftHand = this.renderer.xr.getHand(0);
    this.rightHand = this.renderer.xr.getHand(1);
    this.scene.add(this.leftHand);
    this.scene.add(this.rightHand);

    // Internal pinch/rotation state
    this.leftRotationActive = false;
    this.rightRotationActive = false;
    this.lastLeftX = 0;
    this.lastLeftY = 0;
    this.lastRightX = 0;
    this.lastRightY = 0;

    this._initJointRefs();
  }

  // -----------------------------------
  // Setup tiny joint proxies
  // -----------------------------------
  _initJointRefs() {
    const sphereGeo = new THREE.SphereGeometry(0.002, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0,
      transparent: true
    });

    this.lThumbObj = new THREE.Mesh(sphereGeo, mat);
    this.lIndexObj = new THREE.Mesh(sphereGeo, mat.clone());
    this.rThumbObj = new THREE.Mesh(sphereGeo, mat.clone());
    this.rIndexObj = new THREE.Mesh(sphereGeo, mat.clone());

    this.scene.add(
      this.lThumbObj,
      this.lIndexObj,
      this.rThumbObj,
      this.rIndexObj
    );
  }

  // -----------------------------------
  // Wiring API
  // -----------------------------------
  setButtonPlane(plane) {
    this.buttonPlane = plane;
  }

  setPlaceOCallback(cb) {
    this.onPlaceO = cb;
  }

  setRotateCallback(cb) {
    this.onRotate = cb;
  }

  setButtonHitCallback(cb) {
    this.onButtonHit = cb;
  }

  // -----------------------------------
  // Per-frame update
  // -----------------------------------
  update() {
    this._updateHands();
    this._processPinches();
    this._processButtonHit();
  }

  // -----------------------------------
  // Hand joint tracking
  // -----------------------------------
  _updateHands() {
    const lh = this.leftHand;
    const rh = this.rightHand;

    if (lh?.joints?.['thumb-tip']) {
      this.lThumbObj.position.copy(lh.joints['thumb-tip'].position);
    }
    if (lh?.joints?.['index-finger-tip']) {
      this.lIndexObj.position.copy(lh.joints['index-finger-tip'].position);
    }
    if (rh?.joints?.['thumb-tip']) {
      this.rThumbObj.position.copy(rh.joints['thumb-tip'].position);
    }
    if (rh?.joints?.['index-finger-tip']) {
      this.rIndexObj.position.copy(rh.joints['index-finger-tip'].position);
    }
  }

  // -----------------------------------
  // Pinch → place O + rotate board
  // -----------------------------------
  _processPinches() {
    this._handleHandPinch('left', this.lThumbObj, this.lIndexObj);
    this._handleHandPinch('right', this.rThumbObj, this.rIndexObj);
  }

  _handleHandPinch(handName, thumbObj, indexObj) {
    const dist = thumbObj.position.distanceTo(indexObj.position);
    const isPinching = dist < 0.02;

    if (isPinching) {
      if (handName === 'left') {
        if (!this.leftRotationActive) {
          // Pinch just started (left hand)
          this.leftRotationActive = true;
          this.lastLeftX = thumbObj.position.x;
          this.lastLeftY = thumbObj.position.y;

          // Fire place-O ONCE at pinch start
          this.onPlaceO?.({
            hand: handName,
            thumbWorldPos: thumbObj.position.clone()
          });
        } else {
          // Ongoing pinch → rotation deltas
          const dx = thumbObj.position.x - this.lastLeftX;
          const dy = thumbObj.position.y - this.lastLeftY;
          this._emitRotate(dx, dy);
          this.lastLeftX = thumbObj.position.x;
          this.lastLeftY = thumbObj.position.y;
        }
      } else {
        if (!this.rightRotationActive) {
          // Pinch just started (right hand)
          this.rightRotationActive = true;
          this.lastRightX = thumbObj.position.x;
          this.lastRightY = thumbObj.position.y;

          // Fire place-O ONCE at pinch start
          this.onPlaceO?.({
            hand: handName,
            thumbWorldPos: thumbObj.position.clone()
          });
        } else {
          // Ongoing pinch → rotation deltas
          const dx = thumbObj.position.x - this.lastRightX;
          const dy = thumbObj.position.y - this.lastRightY;
          this._emitRotate(dx, dy);
          this.lastRightX = thumbObj.position.x;
          this.lastRightY = thumbObj.position.y;
        }
      }
    } else {
      // Pinch ended
      if (handName === 'left') {
        this.leftRotationActive = false;
      } else {
        this.rightRotationActive = false;
      }
    }
  }

  _emitRotate(deltaX, deltaY) {
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return;
    this.onRotate?.({
      deltaX,
      deltaY,
      speed: this.chairRotationSpeed,
      maxUpDownRotation: this.maxUpDownRotation
    });
  }

  // -----------------------------------
  // Button hit detection
  // -----------------------------------
  _processButtonHit() {
    if (!this.buttonPlane || !this.onButtonHit) return;

    const lh = this.leftHand;
    const rh = this.rightHand;

    const check = (hand) => {
      if (!hand?.joints?.['index-finger-tip']) return;
      const p = new THREE.Vector3().copy(
        hand.joints['index-finger-tip'].position
      );
      if (this._checkPlaneIntersection(p, this.buttonPlane)) {
        this.onButtonHit();
      }
    };

    check(lh);
    check(rh);
  }

  _checkPlaneIntersection(point, plane) {
    if (!plane.visible || plane.scale.x === 0) return false;

    const w = plane.geometry.parameters.width;
    const h = plane.geometry.parameters.height;
    const halfWidth = w * 0.5;
    const halfHeight = h * 0.5;

    const localPoint = point.clone();
    plane.worldToLocal(localPoint);

    return (
      localPoint.x >= -halfWidth &&
      localPoint.x <= halfWidth &&
      localPoint.y >= -halfHeight &&
      localPoint.y <= halfHeight &&
      Math.abs(localPoint.z) < 0.02
    );
  }
}
