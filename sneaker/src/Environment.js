import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

export class Environment {
    constructor(scene, pmrem) {
        this.scene = scene;
        this.pmrem = pmrem;
        
        this.setupHDRI();
        this.setupLights();
    }
    
    setupHDRI() {
        const hdrLoader = new HDRLoader();
        hdrLoader.load('/static/2k.hdr', (hdrTexture) => {
            const envRT = this.pmrem.fromEquirectangular(hdrTexture);
            this.scene.environment = envRT.texture;
            
            hdrTexture.dispose();
            this.pmrem.dispose();
        });
    }
    
    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        
        // Key light (main directional light)
        const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.0);
        keyLight.position.set(5, 10, 5);
        keyLight.castShadow = false;
        this.scene.add(keyLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0xe6f3ff, 1.2);
        fillLight.position.set(-5, 8, -5);
        this.scene.add(fillLight);
        
        // Rim light
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rimLight.position.set(0, 5, -10);
        this.scene.add(rimLight);
        
        // Point light
        const pointLight = new THREE.PointLight(0xffffff, 1.5, 20);
        pointLight.position.set(0, 6, 3);
        pointLight.castShadow = false;
        this.scene.add(pointLight);
    }
}

