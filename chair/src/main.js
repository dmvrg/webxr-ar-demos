import * as THREE from 'three';
import gsap from 'gsap';

import { setupXR, attachXRSessionCallbacks } from './XRSetup.js';
import { HandInput } from './HandInput.js';
import { ChairExperience } from './ChairExperience.js';

gsap.ticker.lagSmoothing(0);
gsap.ticker.fps(60);

const { scene, camera, renderer } = setupXR();
const handInput = new HandInput(renderer, scene);
const experience = new ChairExperience(scene, camera, renderer, handInput);

experience.initLights();
experience.initBaseComposition();
experience.setupEnvMap(); 

// async load models & UI
experience.loadModelsAndUI().then(() => {
  console.log('Chair & UI ready');
});

// XR session hooks
attachXRSessionCallbacks(renderer, {
  onSessionStart: () => experience.onSessionStart(),
  onSessionEnd: () => experience.onSessionEnd()
});

const clock = new THREE.Clock();

renderer.setAnimationLoop((t, xrFrame) => {
  const delta = clock.getDelta();
  gsap.ticker.tick(delta);

  experience.update(delta, t);

  renderer.render(scene, camera);
});
