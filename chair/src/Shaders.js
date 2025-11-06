import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Internal shader state
// -----------------------------------------------------------------------------

// Fresnel
let fresnelVertexShader = '';
let fresnelFragmentShader = '';
let fresnelMaterial = null;
let fresnelLoadFailed = false;

// Sizes
let sizesVertexShader = '';
let sizesFragmentShader = '';
let sizesMaterial = null;
let sizesLoadFailed = false;

// -----------------------------------------------------------------------------
// Loading helpers
// -----------------------------------------------------------------------------

/**
 * Preload Fresnel vertex/fragment shaders from disk.
 * Safe to call multiple times; it only loads once.
 */
export function preloadFresnelShaders() {
  if (fresnelVertexShader && fresnelFragmentShader) return Promise.resolve();
  if (fresnelLoadFailed) return Promise.reject(new Error('Fresnel shader load previously failed.'));

  const vPromise = fetch('/static/shaders/fresnel_vertex.glsl')
    .then(r => r.text())
    .then(src => {
      fresnelVertexShader = src;
    });

  const fPromise = fetch('/static/shaders/fresnel_fragment.glsl')
    .then(r => r.text())
    .then(src => {
      fresnelFragmentShader = src;
    });

  return Promise.all([vPromise, fPromise])
    .then(() => undefined)
    .catch(err => {
      fresnelLoadFailed = true;
      console.error('Failed to load Fresnel shaders:', err);
      throw err;
    });
}

/**
 * Preload Sizes vertex/fragment shaders from disk.
 * Safe to call multiple times; it only loads once.
 */
export function preloadSizesShaders() {
  if (sizesVertexShader && sizesFragmentShader) return Promise.resolve();
  if (sizesLoadFailed) return Promise.reject(new Error('Sizes shader load previously failed.'));

  const vPromise = fetch('/static/shaders/sizes_vertex.glsl')
    .then(r => r.text())
    .then(src => {
      sizesVertexShader = src;
    });

  const fPromise = fetch('/static/shaders/sizes_fragment.glsl')
    .then(r => r.text())
    .then(src => {
      sizesFragmentShader = src;
    });

  return Promise.all([vPromise, fPromise])
    .then(() => undefined)
    .catch(err => {
      sizesLoadFailed = true;
      console.error('Failed to load Sizes shaders:', err);
      throw err;
    });
}

// -----------------------------------------------------------------------------
// Material factories
// -----------------------------------------------------------------------------

/**
 * Returns a shared Fresnel ShaderMaterial.
 * Assumes shaders have been loaded (via preloadFresnelShaders or applyFresnelToChair).
 */
export function getOrCreateFresnelMaterial() {
  if (!fresnelMaterial) {
    fresnelMaterial = new THREE.ShaderMaterial({
      vertexShader: fresnelVertexShader,
      fragmentShader: fresnelFragmentShader,
      uniforms: {
        outlineThickness: { value: 2.0 },
        outlineColor: { value: new THREE.Color(0xffff00) }
      },
      side: THREE.FrontSide,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });
  }
  return fresnelMaterial;
}

/**
 * Returns a shared Sizes ShaderMaterial.
 * Assumes shaders have been loaded (via preloadSizesShaders).
 */
export function getOrCreateSizesMaterial() {
  if (!sizesMaterial) {
    sizesMaterial = new THREE.ShaderMaterial({
      vertexShader: sizesVertexShader,
      fragmentShader: sizesFragmentShader,
      uniforms: {
        baseColor: { value: new THREE.Color(0xffffff) },
        opacity: { value: 0.8 }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
  }
  return sizesMaterial;
}

// -----------------------------------------------------------------------------
// Chair material helpers (operate on a passed-in chairModel)
// -----------------------------------------------------------------------------

function storeOriginalMaterialsIfMissing(mesh) {
  if (!mesh || !mesh.isMesh) return;
  if (!mesh.userData) mesh.userData = {};
  if (mesh.userData.originalMaterialStored) return;

  mesh.userData.originalMaterial = Array.isArray(mesh.material)
    ? mesh.material.slice()
    : mesh.material;

  mesh.userData.originalMaterialStored = true;
}

/**
 * Replaces all original chair meshes (child.userData.isOriginalChair)
 * with the shared Fresnel material, storing their original materials
 * in mesh.userData.originalMaterial.
 */
export function applyFresnelToChair(chairModel) {
  if (!chairModel) return;
  if (fresnelLoadFailed) {
    // Give up if we know loading failed
    return;
  }

  // Lazy-load shaders if needed
  if (!fresnelVertexShader || !fresnelFragmentShader) {
    preloadFresnelShaders()
      .then(() => applyFresnelToChair(chairModel))
      .catch(() => {
        // already logged in preloadFresnelShaders
      });
    return;
  }

  const sharedFresnel = getOrCreateFresnelMaterial();

  chairModel.traverse(child => {
    if (child.isMesh && child.material && child.userData?.isOriginalChair) {
      storeOriginalMaterialsIfMissing(child);

      if (Array.isArray(child.material)) {
        for (let i = 0; i < child.material.length; i++) {
          child.material[i] = sharedFresnel;
        }
      } else {
        child.material = sharedFresnel;
      }

      child.material.needsUpdate = true;
    }
  });
}

/**
 * Restores original materials for all original chair meshes.
 */
export function restoreOriginalMaterials(chairModel) {
  if (!chairModel) return;

  chairModel.traverse(child => {
    if (
      child.isMesh &&
      child.userData &&
      child.userData.originalMaterialStored &&
      child.userData.isOriginalChair
    ) {
      child.material = child.userData.originalMaterial;

      if (Array.isArray(child.material)) {
        child.material.forEach(m => {
          if (m) m.needsUpdate = true;
        });
      } else if (child.material) {
        child.material.needsUpdate = true;
      }
    }
  });
}

// -----------------------------------------------------------------------------
// Sizes shader uniforms updates
// -----------------------------------------------------------------------------

/**
 * Update global Sizes material uniforms.
 * Call after getOrCreateSizesMaterial() has been used at least once.
 *
 * @param {object} properties
 * @param {number} [properties.baseColor] - hex color (e.g. 0xff0000)
 * @param {number} [properties.opacity]   - 0..1
 */
export function updateSizesMaterialProperties(properties) {
  if (!sizesMaterial) return;

  if (properties.baseColor !== undefined) {
    sizesMaterial.uniforms.baseColor.value.setHex(properties.baseColor);
  }
  if (properties.opacity !== undefined) {
    sizesMaterial.uniforms.opacity.value = properties.opacity;
  }

  sizesMaterial.needsUpdate = true;
}
