import * as THREE from 'three';

export function CreateBurgerMaterials() {
  const SHARED_STD = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.2,
    envMapIntensity: 1.0,
    side: THREE.FrontSide
  });

  function EnhanceModelMaterials(model) {
    model.traverse(c => {
      if (!c.isMesh) return;
      const m = c.material;
      if (m && m.side === THREE.DoubleSide) return;
      if (m && m.isMeshStandardMaterial) {
        m.roughness = 0.5;
        m.metalness = 0.2;
        m.envMapIntensity = 1.0;
        m.side = THREE.FrontSide;
      } else if (m && m.map) {
        const clone = SHARED_STD.clone();
        clone.map = m.map;
        c.material = clone;
      } else {
        c.material = SHARED_STD;
      }
      c.castShadow = c.receiveShadow = true;
    });
  }

  return { SHARED_STD, EnhanceModelMaterials };
}
