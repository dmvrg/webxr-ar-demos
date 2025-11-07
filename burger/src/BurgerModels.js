import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const gltfLoader = new GLTFLoader();

function LoadModel(path) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(path, gltf => resolve(gltf.scene), undefined, reject);
  });
}

export async function LoadBurgerModels(EnhanceModelMaterials) {
  const [bunTop, bunBottom, onion, meat, tomato, lettuce, cheese] = await Promise.all([
    LoadModel('/static/bun1.glb'),
    LoadModel('/static/bun2.glb'),
    LoadModel('/static/onion.glb'),
    LoadModel('/static/meat.glb'),
    LoadModel('/static/tomato.glb'),
    LoadModel('/static/lettuce.glb'),
    LoadModel('/static/cheese.glb')
  ]);

  const apply = (m, sx, sy, sz) => {
    EnhanceModelMaterials(m);
    m.scale.set(sx, sy, sz);
  };

  apply(bunTop, 0.18 * 0.9 * 72, 0.18 * 0.36 * 400, 0.18 * 0.9 * 72);
  apply(bunBottom, 0.18 * 0.9 * 72, 0.18 * 0.36 * 400, 0.18 * 0.9 * 72);
  apply(onion, 0.18 * 0.9 * 14 * 0.8, 0.18 * 0.36 * 22 * 0.8, 0.18 * 0.9 * 14 * 0.8);
  apply(meat, 0.18 * 0.9 * 11.2 * 0.8, 0.18 * 0.36 * 25 * 0.8, 0.18 * 0.9 * 11.2 * 0.8);
  apply(tomato, 0.18 * 0.9 * 12 * 0.8, 0.18 * 0.36 * 24 * 0.8, 0.18 * 0.9 * 12 * 0.8);
  apply(lettuce, 0.18 * 0.9 * 12 * 0.8, 0.18 * 0.36 * 32 * 0.8, 0.18 * 0.9 * 12 * 0.8);
  apply(cheese, 0.18 * 0.9 * 12.6 * 0.8, 0.18 * 0.36 * 28 * 0.8, 0.18 * 0.9 * 12.6 * 0.8);

  return { bunTop, bunBottom, onion, tomato, lettuce, cheese, patty: meat };
}
