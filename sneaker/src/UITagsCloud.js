import * as THREE from 'three';
import gsap from 'gsap';

export class UITagsCloud {
    constructor(baseComposition, textureLoader, configureTexture, camera) {
        this.baseComposition = baseComposition;
        this.textureLoader = textureLoader;
        this.configureTexture = configureTexture;
        this.camera = camera;
        
        // Tag state tracking
        this.tagStates = new Array(12).fill(false);
        this.tagStates[0] = true;   // Tag1
        this.tagStates[2] = true;   // Tag3
        this.tagStates[4] = true;   // Tag5
        this.tagStates[6] = true;   // Tag7
        this.tagStates[8] = true;   // Tag9
        this.tagStates[10] = true;  // Tag11
        this.tagStates[11] = true;  // Tag12
        
        // Cached references
        this.cachedDotPlanes = [];
        this.cachedConnectionBoxes = [];
        
        // Dynamic scaling parameters
        this.planeScalingEnabled = true;
        this.planeBaseScale = 1.0;
        this.planeMinScale = 0.7;
        this.planeMaxScale = 1.7;
        this.planeScaleRange = 0.1;
        
        this.headerTags = null;
        this.initHeaderTags();
    }
    
    initHeaderTags() {
        const headerTagsWidth = 0.270 * 0.9;
        const headerTagsHeight = headerTagsWidth * (92 / 270);
        const headerTagsGeometry = new THREE.PlaneGeometry(headerTagsWidth, headerTagsHeight);
        
        const headerTagsTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_header-tags.png',
                (texture) => { headerTagsMaterial.needsUpdate = true; },
                (xhr) => {},
                (error) => {}
            )
        );
        
        const headerTagsMaterial = new THREE.MeshBasicMaterial({ 
            map: headerTagsTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        
        this.headerTags = new THREE.Mesh(headerTagsGeometry, headerTagsMaterial);
        this.headerTags.position.set(0, 0.34, 0);
        this.headerTags.scale.set(0, 0, 0);
        
        this.baseComposition.add(this.headerTags);
    }
    
    createDotPlanes(cloudModel) {
        if (cloudModel.userData.dotPlanesCreated) return;
        
        this.cachedDotPlanes.length = 0;
        this.cachedConnectionBoxes.length = 0;
        
        const connectionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
        });
        
        const planeGeometry = new THREE.PlaneGeometry(0.8025, 0.235);
        
        let planesCreated = 0;
        for (let i = 0; i < 12; i++) {
            const dotName = `dot${i}`;
            const dotPart = cloudModel.getObjectByName(dotName);
            
            if (dotPart) {
                const texturePathOFF = `/static/ui_tag${i}-OFF.png`;
                const texturePathON = `/static/ui_tag${i}-ON.png`;
                const textureOFF = this.configureTexture(this.textureLoader.load(texturePathOFF));
                const textureON = this.configureTexture(this.textureLoader.load(texturePathON));
                
                const initialTexture = this.tagStates[i] ? textureON : textureOFF;
                const planeMaterial = new THREE.MeshBasicMaterial({ 
                    map: initialTexture,
                    transparent: true,
                    opacity: 1.0,
                    side: THREE.DoubleSide,
                    alphaTest: 0.1,
                    depthTest: false,
                    depthWrite: false,
                    toneMapped: false
                });
                
                planeMaterial.userData = {
                    textureOFF: textureOFF,
                    textureON: textureON
                };
                
                const plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.position.set(0, 0, 0.01);
                plane.visible = true;
                plane.frustumCulled = false;
                
                plane.userData.isDotPlane = true;
                plane.userData.dotIndex = i;
                plane.userData.textureOFF = textureOFF;
                plane.userData.textureON = textureON;
                plane.userData.material = planeMaterial;
                
                dotPart.add(plane);
                
                // Create connection box
                const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
                const connectionBox = new THREE.Mesh(boxGeometry, connectionMaterial);
                connectionBox.scale.set(0.015, 0.015, 1);
                
                connectionBox.userData.planeRef = plane;
                connectionBox.userData.lineIndex = i;
                cloudModel.add(connectionBox);
                
                plane.userData.connectionBox = connectionBox;
                
                this.cachedDotPlanes[i] = plane;
                this.cachedConnectionBoxes[i] = connectionBox;
                
                planesCreated++;
            }
        }
        
        if (planesCreated === 0) {
            const textureOFF = this.configureTexture(
                this.textureLoader.load('/static/ui_tag0-OFF.png')
            );
            const textureON = this.configureTexture(
                this.textureLoader.load('/static/ui_tag0-ON.png')
            );
            const testMaterial = new THREE.MeshBasicMaterial({ 
                map: textureOFF,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                alphaTest: 0.1,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            });
            
            const testPlane = new THREE.Mesh(planeGeometry, testMaterial);
            testPlane.position.set(0, 0, 0.1);
            testPlane.visible = true;
            testPlane.frustumCulled = false;
            testPlane.userData.isDotPlane = true;
            testPlane.userData.textureOFF = textureOFF;
            testPlane.userData.textureON = textureON;
            testPlane.userData.material = testMaterial;
            cloudModel.add(testPlane);
        }
        
        cloudModel.userData.dotPlanesCreated = true;
    }
    
    updateDotPlanesToFaceCamera(cloudModel) {
        if (!cloudModel || !cloudModel.visible) return;
        
        for (let i = 0; i < this.cachedDotPlanes.length; i++) {
            const child = this.cachedDotPlanes[i];
            if (!child || !child.userData.isDotPlane) continue;
            
            const planeWorldPosition = new THREE.Vector3();
            child.getWorldPosition(planeWorldPosition);
            
            child.lookAt(this.camera.position);
            
            if (this.planeScalingEnabled) {
                const cloudWorldPosition = new THREE.Vector3();
                cloudModel.getWorldPosition(cloudWorldPosition);
                
                const relativePosition = new THREE.Vector3();
                relativePosition.subVectors(planeWorldPosition, cloudWorldPosition);
                
                const zDepth = relativePosition.z;
                const zRange = 0.3;
                const normalizedZ = Math.max(0, Math.min(1, (zDepth + zRange/2) / zRange));
                const scaleFactor = this.planeMinScale + 
                    (normalizedZ * (this.planeMaxScale - this.planeMinScale));
                
                child.scale.set(scaleFactor, scaleFactor, scaleFactor);
                
                if (child.userData.connectionBox) {
                    const box = child.userData.connectionBox;
                    const dotPart = child.parent;
                    if (!dotPart) return;
                    
                    const startPos = new THREE.Vector3(0, 0, 0);
                    const endPos = dotPart.position.clone();
                    
                    const direction = endPos.clone().sub(startPos);
                    const distance = direction.length();
                    
                    if (distance > 0) {
                        box.position.copy(startPos).add(direction.multiplyScalar(0.5));
                        box.scale.set(0.015, distance, 0.015);
                        
                        const quaternion = new THREE.Quaternion();
                        const up = new THREE.Vector3(0, 1, 0);
                        quaternion.setFromUnitVectors(up, direction.normalize());
                        box.quaternion.copy(quaternion);
                    }
                }
            }
        }
    }
    
    handleTagInteraction(lIndexObj, rIndexObj, cloudModel, currentTime, 
                        lastButtonTouchTime, buttonTouchCooldown, buttonTouchActive) {
        if (!cloudModel || !cloudModel.visible) return { shouldUpdateCooldown: false };
        
        for (let i = 0; i < this.cachedDotPlanes.length; i++) {
            const child = this.cachedDotPlanes[i];
            if (!child || !child.userData.isDotPlane) continue;
            
            const tagIndex = child.userData.dotIndex;
            if (tagIndex === undefined) continue;
            
            const tagWorldPosition = new THREE.Vector3();
            child.getWorldPosition(tagWorldPosition);
            
            const leftIndexDistance = lIndexObj ? 
                lIndexObj.position.distanceTo(tagWorldPosition) : Infinity;
            const rightIndexDistance = rIndexObj ? 
                rIndexObj.position.distanceTo(tagWorldPosition) : Infinity;
            
            const touchThreshold = 0.05;
            const isTouching = leftIndexDistance < touchThreshold || 
                              rightIndexDistance < touchThreshold;
            
            if (isTouching && !child.userData.isPressed && !buttonTouchActive && 
                (currentTime - lastButtonTouchTime) > buttonTouchCooldown) {
                
                child.userData.isPressed = true;
                
                this.tagStates[tagIndex] = !this.tagStates[tagIndex];
                
                const material = child.material;
                if (this.tagStates[tagIndex]) {
                    material.map = material.userData.textureON;
                } else {
                    material.map = material.userData.textureOFF;
                }
                material.needsUpdate = true;
                
                gsap.killTweensOf(child.scale);
                
                const wasScalingEnabled = this.planeScalingEnabled;
                this.planeScalingEnabled = false;
                
                const originalScale = child.scale.x;
                
                gsap.to(child.scale, {
                    x: originalScale * 0.7,
                    y: originalScale * 0.7,
                    z: originalScale * 0.7,
                    duration: 0.12,
                    ease: "power2.out",
                    onComplete: () => {
                        gsap.to(child.scale, {
                            x: originalScale,
                            y: originalScale,
                            z: originalScale,
                            duration: 0.3,
                            ease: "power2.out",
                            onComplete: () => {
                                this.planeScalingEnabled = wasScalingEnabled;
                            }
                        });
                    }
                });
                
                return { shouldUpdateCooldown: true };
            } else if (!isTouching && child.userData.isPressed) {
                child.userData.isPressed = false;
            }
        }
        
        return { shouldUpdateCooldown: false };
    }
    
    showHeaderTags() {
        gsap.to(this.headerTags.scale, {
            x: 1.0, y: 1.0, z: 1.0,
            duration: 0.3,
            ease: "power2.out"
        });
    }
    
    hideHeaderTags() {
        gsap.to(this.headerTags.scale, {
            x: 0.0, y: 0.0, z: 0.0,
            duration: 0.3,
            ease: "power2.inOut"
        });
    }
    
    getHeaderTags() {
        return this.headerTags;
    }
}

