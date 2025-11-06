import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

const SPHERE_RADIUS = 0.05;
const PICK_THRESHOLD = 0.05;

export class BoardView {
  constructor(
    scene,
    { orangeMaterial, lightBlueMaterial, xModelTemplate, oModelTemplate }
  ) {
    this.scene = scene;
    this.orangeMaterial = orangeMaterial;
    this.lightBlueMaterial = lightBlueMaterial;
    this.xModelTemplate = xModelTemplate;
    this.oModelTemplate = oModelTemplate;

    this.baseComposition = this._createBaseComposition();
    this.baseGrid = null;

    // Maps & sets for game pieces
    this.spherePositions = new Map(); // uuid -> { x, y, z }
    this.usedSpheres = new Map();     // uuid -> 'O' | 'X'
    this.activePieces = new Set();    // spawned X/O roots
    this.winLine = null;

    this.scene.add(this.baseComposition);
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  _createBaseComposition() {
    const tempGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const tempMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(tempGeo, tempMat);
    mesh.scale.set(1, 1, 1);
    return mesh;
  }

  async loadGridModel(url = '/static/tictactoe.glb') {
    const loader = new GLTFLoader();

    return new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          this.baseGrid = gltf.scene;
          this.baseGrid.scale.set(0.11, 0.11, 0.11);
          this.baseGrid.position.set(0, -0.21, 0);
          this.baseGrid.rotation.set(0, 0, 0);

          // Hide non-sphere meshes from the GLB
          this.baseGrid.traverse((child) => {
            if (child.isMesh && (!child.name || !child.name.startsWith('Sphere_'))) {
              child.visible = false;
            }
          });

          this.baseComposition.add(this.baseGrid);

          // Create interaction spheres at Dot_* positions
          this._createSpheresFromDots(this.baseGrid);

          resolve(this.baseGrid);
        },
        undefined,
        (error) => {
          console.error('Error loading tictactoe.glb:', error);

          // Fallback cube, mostly for debug
          const cubeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
          const cubeMaterial = new THREE.MeshLambertMaterial({
            color: 0x808080,
            transparent: false
          });
          this.baseGrid = new THREE.Mesh(cubeGeometry, cubeMaterial);
          this.baseGrid.scale.set(0.15, 0.15, 0.15);
          this.baseGrid.position.set(0, -0.22, 0);
          this.baseGrid.rotation.set(0, 0, 0);
          this.baseComposition.add(this.baseGrid);

          resolve(this.baseGrid);
        }
      );
    });
  }

  _createSpheresFromDots(root) {
    root.traverse((child) => {
      if (child.isMesh && child.name && child.name.startsWith('Dot_')) {
        const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8
        });

        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.name = child.name.replace('Dot_', 'Sphere_');
        sphere.position.copy(child.position);

        child.parent.add(sphere);

        const coords = child.name.split('_')[1];
        if (coords && coords.length === 3) {
          const x = parseInt(coords[0], 10);
          const y = parseInt(coords[1], 10);
          const z = parseInt(coords[2], 10);
          this.spherePositions.set(sphere.uuid, { x, y, z });
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Sphere lookup & coordinate mapping
  // ---------------------------------------------------------------------------

  findNearestSphere(worldPos) {
    if (!this.baseGrid) return null;

    let nearest = null;
    let minDist = Infinity;
    const tmp = new THREE.Vector3();

    this.baseGrid.traverse((child) => {
      if (
        child.isMesh &&
        child.name &&
        child.name.startsWith('Sphere_') &&
        child.visible
      ) {
        child.getWorldPosition(tmp);
        const d = worldPos.distanceTo(tmp);
        if (d < minDist) {
          minDist = d;
          nearest = child;
        }
      }
    });

    return minDist < PICK_THRESHOLD ? nearest : null;
  }

  getGridCoordsFromSphere(sphereUUID) {
    return this.spherePositions.get(sphereUUID) || null;
  }

  findSphereByGridPos(x, y, z) {
    if (!this.baseGrid) return null;

    let found = null;

    for (const [uuid, pos] of this.spherePositions.entries()) {
      if (pos.x === x && pos.y === y && pos.z === z) {
        this.baseGrid.traverse((child) => {
          if (child.isMesh && child.uuid === uuid) {
            found = child;
          }
        });
        if (found) break;
      }
    }

    return found;
  }

  worldToLocalOnGrid(worldPos) {
    if (!this.baseGrid) return null;
    const local = worldPos.clone();
    this.baseGrid.worldToLocal(local);
    return local;
  }

  // ---------------------------------------------------------------------------
  // Used spheres tracking
  // ---------------------------------------------------------------------------

  markSphereUsed(sphereUUID, player) {
    this.usedSpheres.set(sphereUUID, player);
  }

  isSphereFree(sphereUUID) {
    return !this.usedSpheres.has(sphereUUID);
  }

  // ---------------------------------------------------------------------------
  // Piece spawning (X / O)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Piece spawning (O / X) with fallback if templates are missing
  // ---------------------------------------------------------------------------

  spawnO(localPos) {
    // If GLTF template is missing, fall back to a simple orange sphere
    let root;

    if (this.oModelTemplate && this.baseGrid) {
      root = this.oModelTemplate.clone();
    } else {
      console.warn('BoardView.spawnO: oModelTemplate missing, using fallback sphere.');
      const geo = new THREE.SphereGeometry(0.045, 24, 24);
      root = new THREE.Mesh(geo, this.orangeMaterial);
    }

    root.position.copy(localPos);
    this.baseGrid.add(root);
    this.activePieces.add(root);

    // Spawn animation
    root.scale.set(0.01, 0.01, 0.01);
    gsap.to(root.scale, {
      x: 0.9,
      y: 0.9,
      z: 0.9,
      duration: 0.3,
      ease: 'back.out'
    });

    return root;
  }

  spawnX(localPos) {
    // If GLTF template is missing, fall back to a simple blue "X" made of boxes
    let root;

    if (this.xModelTemplate && this.baseGrid) {
      root = this.xModelTemplate.clone();
    } else {
      console.warn('BoardView.spawnX: xModelTemplate missing, using fallback cross.');
      root = new THREE.Group();

      const barGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
      const bar1 = new THREE.Mesh(barGeo, this.lightBlueMaterial);
      const bar2 = new THREE.Mesh(barGeo, this.lightBlueMaterial);

      bar1.rotation.z = Math.PI / 4;
      bar2.rotation.z = -Math.PI / 4;

      root.add(bar1, bar2);
    }

    root.position.copy(localPos);
    this.baseGrid.add(root);
    this.activePieces.add(root);

    // Spawn animation
    root.scale.set(0.01, 0.01, 0.01);
    gsap.to(root.scale, {
      x: 1.0,
      y: 1.0,
      z: 1.0,
      duration: 0.3,
      ease: 'back.out'
    });

    return root;
  }


  // ---------------------------------------------------------------------------
  // Winning line
  // ---------------------------------------------------------------------------

  showWinningLine(startGrid, endGrid, material) {
    if (!this.baseGrid) return;

    const startSphere = this.findSphereByGridPos(
      startGrid.x,
      startGrid.y,
      startGrid.z
    );
    const endSphere = this.findSphereByGridPos(
      endGrid.x,
      endGrid.y,
      endGrid.z
    );
    if (!startSphere || !endSphere) return;

    const startWorld = new THREE.Vector3();
    const endWorld = new THREE.Vector3();
    startSphere.getWorldPosition(startWorld);
    endSphere.getWorldPosition(endWorld);

    const startLocal = this.baseGrid.worldToLocal(startWorld.clone());
    const endLocal = this.baseGrid.worldToLocal(endWorld.clone());

    const midPoint = new THREE.Vector3()
      .addVectors(startLocal, endLocal)
      .multiplyScalar(0.5);
    const distance = startLocal.distanceTo(endLocal);

    const geometry = new THREE.CylinderGeometry(0.04, 0.04, distance, 16);
    const lineMaterial =
      material ||
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true
      });

    const cylinder = new THREE.Mesh(geometry, lineMaterial);
    cylinder.position.copy(midPoint);

    const dir = new THREE.Vector3().subVectors(endLocal, startLocal).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    cylinder.quaternion.copy(quat);

    this.baseGrid.add(cylinder);
    this.winLine = cylinder;

    gsap.from(cylinder.scale, {
      y: 0,
      duration: 0.3,
      ease: 'power2.out'
    });
  }

  // ---------------------------------------------------------------------------
  // Reset visuals
  // ---------------------------------------------------------------------------

  resetVisuals() {
    // Remove winning line
    if (this.winLine) {
      if (this.winLine.parent) this.winLine.parent.remove(this.winLine);
      if (this.winLine.geometry) {
        this.winLine.geometry.dispose();
      }
      if (this.winLine.material && this.winLine.material.isMaterial) {
        this.winLine.material.dispose();
      }
      this.winLine = null;
    }

    // Remove all active X/O pieces
    this.activePieces.forEach((piece) => {
      gsap.to(piece.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          if (piece.parent) piece.parent.remove(piece);
          piece.traverse?.((n) => {
            if (n.isMesh) {
              n.geometry?.dispose?.();
              // Keep shared materials (orange/lightBlue) alive
            }
          });
        }
      });
    });
    this.activePieces.clear();

    // Make all spheres visible again
    if (this.baseGrid) {
      this.baseGrid.traverse((child) => {
        if (child.isMesh && child.name && child.name.startsWith('Sphere_')) {
          child.visible = true;
        }
      });
    }

    this.usedSpheres.clear();
  }
}
