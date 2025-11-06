import * as THREE from 'three';
import gsap from 'gsap';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export class EndGameUI {
  constructor(
    parent,
    { xModelTemplate, orangeMaterial, lightBlueMaterial }
  ) {
    this.parent = parent;
    this.xModelTemplate = xModelTemplate;
    this.orangeMaterial = orangeMaterial;
    this.lightBlueMaterial = lightBlueMaterial;

    this.endGameOPlane = null;
    this.endGameXPlane = null;
    this.endGameButtonPlane = null;

    this.buttonAnimating = false;
    this.buttonCallback = null;

    // 3D text
    this.font = null;
    this.currentText = null;

    this._createPlanes();
    this._attachUIModels();
  }

  // ---------------------------------------------------------------------------
  // Setup planes & textures
  // ---------------------------------------------------------------------------
  _createPlanes() {
    const textureLoader = new THREE.TextureLoader();
    const winsTexture = textureLoader.load('/static/ui_wins.png');
    const buttonTexture = textureLoader.load('/static/ui_button.png');
    winsTexture.encoding = THREE.sRGBEncoding;
    buttonTexture.encoding = THREE.sRGBEncoding;

    // O win plane
    this.endGameOPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2592, 0.076464),
      new THREE.MeshBasicMaterial({
        map: winsTexture,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      })
    );
    this.endGameOPlane.position.set(0, 0.12, 0);
    this.endGameOPlane.scale.set(0, 0, 0);
    this.parent.add(this.endGameOPlane);

    // X win plane (same texture, different accent via model)
    this.endGameXPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2592, 0.076464),
      new THREE.MeshBasicMaterial({
        map: winsTexture.clone(),
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      })
    );
    this.endGameXPlane.position.set(0, 0.12, 0);
    this.endGameXPlane.scale.set(0, 0, 0);
    this.parent.add(this.endGameXPlane);

    // Button plane
    this.endGameButtonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.139968, 0.0401436),
      new THREE.MeshBasicMaterial({
        map: buttonTexture,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
      })
    );
    this.endGameButtonPlane.position.set(0, 0.04, 0);
    this.endGameButtonPlane.scale.set(0, 0, 0);
    this.parent.add(this.endGameButtonPlane);
  }

  // ---------------------------------------------------------------------------
  // Attach small O sphere and X model to the win planes
  // ---------------------------------------------------------------------------
  _attachUIModels() {
    // Orange O sphere on O plane
    const uiSphereGeometry = new THREE.SphereGeometry(0.025, 32, 32);
    const uiOSphere = new THREE.Mesh(uiSphereGeometry, this.orangeMaterial);
    uiOSphere.position.set(-0.085, 0, 0.0);
    uiOSphere.name = 'uiOrangeSphere';
    this.endGameOPlane.add(uiOSphere);

    // X model on X plane (if the template exists)
    if (this.xModelTemplate) {
      const uiX = this.xModelTemplate.clone();
      uiX.name = 'uiXModel';
      uiX.position.set(-0.085, 0, 0.0);
      uiX.scale.set(0.08, 0.08, 0.08);
      uiX.rotation.y = Math.PI / 4;
      this.endGameXPlane.add(uiX);
    }
  }

  // ---------------------------------------------------------------------------
  // API used by main.js
  // ---------------------------------------------------------------------------

  getButtonPlane() {
    return this.endGameButtonPlane;
  }

  onButtonPress(cb) {
    this.buttonCallback = cb;
  }

  triggerButtonPress() {
    if (this.buttonAnimating) return;
    if (!this.endGameButtonPlane) return;

    this.buttonAnimating = true;

    // Small squash & pop animation
    gsap.to(this.endGameButtonPlane.scale, {
      x: 0.7,
      y: 0.7,
      z: 0.7,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.endGameButtonPlane.scale, {
          x: 1.0,
          y: 1.0,
          z: 1.0,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            this.buttonAnimating = false;
            if (this.buttonCallback) {
              this.buttonCallback();
            }
          }
        });
      }
    });
  }

  /**
   * Show winner UI.
   * winner: 'O' | 'X' | 'draw'
   */
  showWinner(winner) {
    let targetPlane = null;

    if (winner === 'O') {
      targetPlane = this.endGameOPlane;
    } else if (winner === 'X') {
      targetPlane = this.endGameXPlane;
    } else {
      return;
    }

    if (!targetPlane) return;

    // Make sure we start from zero scale
    targetPlane.scale.set(0, 0, 0);
    this.endGameButtonPlane.scale.set(0, 0, 0);

    // Animate winner plane
    gsap.to(targetPlane.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: 0.5,
      ease: 'power3.out'
    });

    // Animate button plane
    gsap.to(this.endGameButtonPlane.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: 0.5,
      delay: 0.2,
      ease: 'power3.out'
    });
  }

  hideAll() {
    const targets = [
      this.endGameOPlane?.scale,
      this.endGameXPlane?.scale,
      this.endGameButtonPlane?.scale
    ].filter(Boolean);

    if (targets.length === 0) return;

    gsap.to(targets, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.2,
      ease: 'power3.in'
    });

    // Also clear any 3D text if you use it
    if (this.currentText) {
      this.currentText.parent?.remove(this.currentText);
      this.currentText.geometry?.dispose();
      if (Array.isArray(this.currentText.material)) {
        this.currentText.material.forEach((m) => m.dispose?.());
      } else {
        this.currentText.material?.dispose?.();
      }
      this.currentText = null;
    }
  }
  
}
