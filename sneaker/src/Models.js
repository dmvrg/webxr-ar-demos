import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

export class Models {
    constructor(objectsParent, sizeScales, selectedSizeIndex) {
        this.objectsParent = objectsParent;
        this.sizeScales = sizeScales;
        this.selectedSizeIndex = selectedSizeIndex;
        this.loader = new GLTFLoader();
        
        this.productModel = null;
        this.cloudModel = null;
        this.shoeColorLayer = null;
        this.currentObjectType = 'shoe';
        
        // Individual object rotation tracking
        this.shoeRotation = { x: 0, y: 0 };
        this.cloudRotation = { x: 0, y: 0 };
        this.rotationSpeed = 6.0;
    }
    
    loadShoe(onLoad) {
        this.loader.load('/static/product.glb', (gltf) => {
            this.productModel = gltf.scene;
            
            const initialScale = this.sizeScales[this.selectedSizeIndex] || 1.0;
            this.productModel.scale.set(initialScale, initialScale, initialScale);
            this.productModel.position.set(0, 0.03, 0);
            this.productModel.rotation.set(0, 0, 0);
            
            // Find and store reference to the "color" layer
            this.productModel.traverse((child) => {
                if (child.name === 'color' && child.isMesh) {
                    this.shoeColorLayer = child;
                    
                    // Create realistic PBR material
                    const shoeMaterial = new THREE.MeshPhysicalMaterial({
                        color: 0xFF0000,
                        metalness: 0.02,
                        roughness: 0.55,
                        clearcoat: 0.08,
                        clearcoatRoughness: 0.6,
                        sheen: 0.15,
                        sheenRoughness: 0.8,
                        envMapIntensity: 0.9,
                        transparent: false,
                        opacity: 1.0
                    });
                    child.material = shoeMaterial;
                }
            });
            
            this.objectsParent.add(this.productModel);
            this.productModel.visible = true;
            if (this.cloudModel) this.cloudModel.visible = false;
            
            // Kill any existing animations
            gsap.killTweensOf(this.productModel.position);
            gsap.killTweensOf(this.productModel.rotation);
            gsap.killTweensOf(this.productModel.scale);
            
            this.productModel.position.set(0, 0.03, 0);
            this.productModel.rotation.set(0, 0, 0);
            const currentScale = this.sizeScales[this.selectedSizeIndex] || 1.0;
            this.productModel.scale.set(currentScale, currentScale, currentScale);
            
            if (onLoad) onLoad();
        }, 
        (xhr) => {},
        (error) => {
            // Fallback to cube
            const cubeGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const cubeMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x0066FF,
                metalness: 0.4,
                roughness: 0.35,
                envMapIntensity: 1.5,
                transparent: false,
                opacity: 1.0
            });
            this.productModel = new THREE.Mesh(cubeGeometry, cubeMaterial);
            const initialScale = this.sizeScales[this.selectedSizeIndex] || 1.0;
            this.productModel.scale.set(initialScale, initialScale, initialScale);
            this.productModel.position.set(0, 0.03, 0);
            this.productModel.rotation.set(0, 0, 0);
            this.objectsParent.add(this.productModel);
            this.productModel.visible = true;
            if (this.cloudModel) this.cloudModel.visible = false;
            
            this.currentObjectType = 'shoe';
            if (onLoad) onLoad();
        });
    }
    
    loadCloud(onLoad, createDotPlanesCallback) {
        this.loader.load('/static/cloud.glb', (gltf) => {
            this.cloudModel = gltf.scene;
            
            this.cloudModel.scale.set(0.205, 0.205, 0.205);
            this.cloudModel.position.set(0, 0.03, 0);
            this.cloudModel.rotation.set(0, 0, 0);
            
            this.objectsParent.add(this.cloudModel);
            
            // Create center sphere
            const centerSphereGeometry = new THREE.SphereGeometry(0.02, 16, 16);
            const centerSphereMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.5
            });
            const centerSphere = new THREE.Mesh(centerSphereGeometry, centerSphereMaterial);
            centerSphere.scale.set(1, 1, 1);
            centerSphere.position.set(0, 0, 0);
            this.cloudModel.add(centerSphere);
            
            this.cloudModel.visible = false;
            
            // Create dot planes
            if (createDotPlanesCallback) {
                createDotPlanesCallback(this.cloudModel);
            }
            
            // Kill any existing animations
            gsap.killTweensOf(this.cloudModel.position);
            gsap.killTweensOf(this.cloudModel.rotation);
            gsap.killTweensOf(this.cloudModel.scale);
            
            this.cloudModel.position.set(0, 0.03, 0);
            this.cloudModel.rotation.set(0, 0, 0);
            this.cloudModel.scale.set(0.205, 0.205, 0.205);
            
            if (onLoad) onLoad();
        }, 
        (xhr) => {},
        (error) => {
            // Fallback to sphere
            const sphereGeometry = new THREE.SphereGeometry(0.3, 8, 6);
            const sphereMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xFF6600,
                metalness: 0.0,
                roughness: 0.8,
                envMapIntensity: 1.0,
                transparent: false,
                opacity: 1.0,
                flatShading: true
            });
            this.cloudModel = new THREE.Mesh(sphereGeometry, sphereMaterial);
            this.cloudModel.scale.set(0.432, 0.432, 0.432);
            this.cloudModel.position.set(0, 0.05, 0);
            this.objectsParent.add(this.cloudModel);
            this.cloudModel.visible = false;
            
            if (onLoad) onLoad();
        });
    }
    
    toggleShoeCloudVisibility(context) {
        const { header, headerTags, groundPlane, colorPicker, cachedDotPlanes } = context;
        
        if (this.productModel && this.cloudModel) {
            if (this.productModel.visible) {
                // Switching from shoe to cloud
                this.currentObjectType = 'cloud';
                
                // Close color picker
                if (colorPicker) {
                    colorPicker.closeColorCircle();
                }
                
                // Apply stored cloud rotation
                this.cloudModel.rotation.x = this.cloudRotation.x;
                this.cloudModel.rotation.y = this.cloudRotation.y;
                
                // Scale down header
                gsap.to(header.scale, {
                    x: 0.0, y: 0.0, z: 0.0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        // Scale up header-tags
                        gsap.to(headerTags.scale, {
                            x: 1.0, y: 1.0, z: 1.0,
                            duration: 0.3,
                            ease: "power2.out"
                        });
                    }
                });
                
                // Scale down ground plane
                gsap.to(groundPlane.scale, {
                    x: 0.0, y: 0.0, z: 0.0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    delay: 0.1
                });
                
                // Scale down shoe
                gsap.to(this.productModel.scale, {
                    x: 0, y: 0, z: 0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        this.productModel.visible = false;
                    }
                });
                
                // Scale up cloud
                this.cloudModel.scale.set(0, 0, 0);
                this.cloudModel.visible = true;
                
                // Ensure planes are visible
                if (cachedDotPlanes) {
                    for (let i = 0; i < cachedDotPlanes.length; i++) {
                        const child = cachedDotPlanes[i];
                        if (child && child.isMesh && child.material && 
                            child.material.color && child.material.color.getHex() === 0x00ff00) {
                            child.visible = true;
                            child.scale.set(1, 1, 1);
                            child.frustumCulled = false;
                        }
                    }
                }
                
                gsap.to(this.cloudModel.scale, {
                    x: 0.205, y: 0.205, z: 0.205,
                    duration: 0.3,
                    ease: "power2.out",
                    delay: 0.3
                });
            } else {
                // Switching from cloud to shoe
                this.currentObjectType = 'shoe';
                
                // Apply stored shoe rotation
                this.productModel.rotation.y = this.shoeRotation.y;
                
                // Scale down header-tags
                gsap.to(headerTags.scale, {
                    x: 0.0, y: 0.0, z: 0.0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        // Scale header back up
                        gsap.to(header.scale, {
                            x: 1.0, y: 1.0, z: 1.0,
                            duration: 0.3,
                            ease: "power2.out"
                        });
                    }
                });
                
                // Scale ground plane back up
                gsap.to(groundPlane.scale, {
                    x: 1.0, y: 1.0, z: 1.0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    delay: 0.3
                });
                
                // Scale down cloud
                gsap.to(this.cloudModel.scale, {
                    x: 0, y: 0, z: 0,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onComplete: () => {
                        this.cloudModel.visible = false;
                    }
                });
                
                // Scale up shoe
                this.productModel.scale.set(0, 0, 0);
                this.productModel.visible = true;
                
                // Update shoe color
                if (colorPicker && colorPicker.getColorButton().material.color) {
                    colorPicker.updateShoeColor(colorPicker.getColorButton().material.color);
                }
                
                const targetScale = this.sizeScales[this.selectedSizeIndex] || 1.0;
                gsap.to(this.productModel.scale, {
                    x: targetScale,
                    y: targetScale,
                    z: targetScale,
                    duration: 0.3,
                    ease: "power2.out",
                    delay: 0.3
                });
            }
        }
    }
    
    getProductModel() {
        return this.productModel;
    }
    
    getCloudModel() {
        return this.cloudModel;
    }
    
    getShoeColorLayer() {
        return this.shoeColorLayer;
    }
    
    getCurrentObjectType() {
        return this.currentObjectType;
    }
    
    getShoeRotation() {
        return this.shoeRotation;
    }
    
    getCloudRotation() {
        return this.cloudRotation;
    }
    
    getRotationSpeed() {
        return this.rotationSpeed;
    }
}

