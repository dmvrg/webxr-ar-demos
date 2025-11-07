import * as THREE from 'three';

export function CreateLights(xrRoot) {
  const ambient = new THREE.AmbientLight(0xffffff, 1.0);
  xrRoot.add(ambient);

  const main = new THREE.DirectionalLight(0xffffff, 1.8);
  main.position.set(4, 10, 5);
  main.castShadow = true;
  main.shadow.mapSize.width = 1536;
  main.shadow.mapSize.height = 1536;
  main.shadow.camera.near = 0.1;
  main.shadow.camera.far = 100;
  main.shadow.camera.left = -5;
  main.shadow.camera.right = 5;
  main.shadow.camera.top = 5;
  main.shadow.camera.bottom = -5;
  main.shadow.bias = -0.0005;
  main.shadow.normalBias = 0.04;
  main.shadow.radius = 3;
  xrRoot.add(main);

  const fill = new THREE.DirectionalLight(0x8899ff, 0.9);
  fill.position.set(-4, 7, -4);
  fill.castShadow = false;
  xrRoot.add(fill);

  // Shadow frustum fitting
  const _tmpBox = new THREE.Box3();
  const _tmpVec = new THREE.Vector3();
  const _bboxCorners = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
  ];

  function fitShadowCameraToObject(light, object, margin = 0.15) {
    if (!light || !light.shadow || !light.shadow.camera || !object) return;
    const cam = light.shadow.camera;
    object.updateWorldMatrix(true, true);
    light.updateMatrixWorld(true);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();

    _tmpBox.setFromObject(object);
    if (!_tmpBox || !isFinite(_tmpBox.min.x) || !isFinite(_tmpBox.max.x)) return;

    _tmpBox.min.addScalar(-margin);
    _tmpBox.max.addScalar(margin);

    const min = _tmpBox.min;
    const max = _tmpBox.max;
    _bboxCorners[0].set(min.x, min.y, min.z);
    _bboxCorners[1].set(max.x, min.y, min.z);
    _bboxCorners[2].set(min.x, max.y, min.z);
    _bboxCorners[3].set(max.x, max.y, min.z);
    _bboxCorners[4].set(min.x, min.y, max.z);
    _bboxCorners[5].set(max.x, min.y, max.z);
    _bboxCorners[6].set(min.x, max.y, max.z);
    _bboxCorners[7].set(max.x, max.y, max.z);

    const invCamMatrix = cam.matrixWorldInverse.clone();
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < 8; i++) {
      _tmpVec.copy(_bboxCorners[i]).applyMatrix4(invCamMatrix);
      if (_tmpVec.x < minX) minX = _tmpVec.x;
      if (_tmpVec.x > maxX) maxX = _tmpVec.x;
      if (_tmpVec.y < minY) minY = _tmpVec.y;
      if (_tmpVec.y > maxY) maxY = _tmpVec.y;
      if (_tmpVec.z < minZ) minZ = _tmpVec.z;
      if (_tmpVec.z > maxZ) maxZ = _tmpVec.z;
    }

    cam.left = minX;
    cam.right = maxX;
    cam.bottom = minY;
    cam.top = maxY;
    cam.near = Math.max(0.1, -maxZ);
    cam.far = Math.max(cam.near + 0.1, -minZ);
    cam.updateProjectionMatrix();
    light.shadow.needsUpdate = true;
  }

  return {
    mainLight: main,
    fitShadowCameraToObject
  };
}
