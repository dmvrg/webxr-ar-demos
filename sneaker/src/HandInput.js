import * as THREE from 'three';
import gsap from 'gsap';

export class HandInput {
    constructor(scene, renderer, camera) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        
        // Pinch state
        this.lPinchOn = false;
        this.rPinchOn = false;
        this.leftPinchPrimed = false;
        this.rightPinchPrimed = false;
        
        // Rotation tracking
        this.leftHandRotationActive = false;
        this.rightHandRotationActive = false;
        this.lastRightHandX = 0;
        this.lastLeftHandX = 0;
        this.lastRightHandY = 0;
        this.lastLeftHandY = 0;
        
        // Grab interaction
        this.leftHandGrabbing = false;
        this.rightHandGrabbing = false;
        this.grabbedObject = null;
        this.originalParent = null;
        this.originalPosition = null;
        this.originalRotation = null;
        this.grabDistance = 0.15;
        this.grabOffset = 0.05;
        this.isAnimatingBack = false;
        
        // XR interaction gating
        this.XR_START_GRACE_MS = 1000;
        this.xrInteractionBlockedUntil = 0;
        this.userMovedShoeThisSession = false;
        this.SNAP_BACK_ON_RELEASE = true;
        
        // Pinch hysteresis
        this.PINCH_START = 0.018;
        this.PINCH_END = 0.028;
        
        this.initJointReferences();
        this.initPinchReferences();
        this.initHands();
        
        // Listen to XR session events
        this.renderer.xr.addEventListener('sessionstart', () => this.onSessionStart());
        this.renderer.xr.addEventListener('sessionend', () => this.onSessionEnd());
    }
    
    initJointReferences() {
        const sphere = new THREE.SphereGeometry(0.002, 32, 32);
        const defaultMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            opacity: 0,
            transparent: true 
        });
        
        this.lThumbObj = new THREE.Mesh(sphere, defaultMat);
        this.lIndexObj = new THREE.Mesh(sphere, defaultMat);
        this.rThumbObj = new THREE.Mesh(sphere, defaultMat);
        this.rIndexObj = new THREE.Mesh(sphere, defaultMat);
        
        this.scene.add(this.lThumbObj);
        this.scene.add(this.lIndexObj);
        this.scene.add(this.rThumbObj);
        this.scene.add(this.rIndexObj);
    }
    
    initPinchReferences() {
        const sphere2 = new THREE.SphereGeometry(0.006, 32, 32);
        const defaultMat2 = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const greenMat2 = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        
        this.lPinchSphere = new THREE.Mesh(sphere2, defaultMat2);
        this.rPinchSphere = new THREE.Mesh(sphere2, greenMat2);
        
        this.scene.add(this.lPinchSphere);
        this.scene.add(this.rPinchSphere);
        
        this.lPinchSphere.material.transparent = true;
        this.lPinchSphere.material.opacity = 0.0;
        this.rPinchSphere.material.transparent = true;
        this.rPinchSphere.material.opacity = 0.0;
    }
    
    initHands() {
        this.hand1 = this.renderer.xr.getHand(0);
        this.scene.add(this.hand1);
        
        this.hand2 = this.renderer.xr.getHand(1);
        this.scene.add(this.hand2);
        
        this.handsGroup = new THREE.Group();
        this.handsGroup.add(this.hand1, this.hand2);
        this.scene.add(this.handsGroup);
        this.handsGroup.visible = false;
    }
    
    onSessionStart() {
        this.xrInteractionBlockedUntil = Date.now() + this.XR_START_GRACE_MS;
        this.leftPinchPrimed = false;
        this.rightPinchPrimed = false;
        this.userMovedShoeThisSession = false;
        this.resetGrabAndPinchState();
    }
    
    onSessionEnd() {
        this.xrInteractionBlockedUntil = 0;
        this.leftPinchPrimed = false;
        this.rightPinchPrimed = false;
    }
    
    isJointTracked(j) {
        return !!j && Number.isFinite(j.position?.x) && 
               Number.isFinite(j.position?.y) && 
               Number.isFinite(j.position?.z) && 
               j.visible !== false;
    }
    
    resetGrabAndPinchState(productModel, objectsParent, sizeScales, selectedSizeIndex) {
        this.lPinchOn = false;
        this.rPinchOn = false;
        this.leftHandRotationActive = false;
        this.rightHandRotationActive = false;
        
        if (productModel && objectsParent) {
            const currentParent = productModel.parent;
            if (currentParent === this.lPinchSphere || currentParent === this.rPinchSphere) {
                objectsParent.add(productModel);
                productModel.position.set(0, 0.03, 0);
                productModel.rotation.set(0, 0, 0);
                const currentScale = sizeScales[selectedSizeIndex] || 1.0;
                productModel.scale.set(currentScale, currentScale, currentScale);
            }
        }
        
        this.leftHandGrabbing = false;
        this.rightHandGrabbing = false;
        this.grabbedObject = null;
        this.originalParent = null;
        this.originalPosition = null;
        this.originalRotation = null;
        this.isAnimatingBack = false;
    }
    
    dropGrabbedObjectInPlace(obj, targetParent) {
        if (!obj || !targetParent) return;
        obj.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        obj.getWorldPosition(worldPos);
        obj.getWorldQuaternion(worldQuat);
        
        targetParent.add(obj);
        
        targetParent.worldToLocal(worldPos);
        const parentWorldQuat = targetParent.getWorldQuaternion(new THREE.Quaternion());
        const localQuat = worldQuat.clone().multiply(parentWorldQuat.invert());
        
        obj.position.copy(worldPos);
        obj.quaternion.copy(localQuat);
    }
    
    update(context) {
        // Block interactions briefly after XR session starts
        if (this.xrInteractionBlockedUntil && Date.now() < this.xrInteractionBlockedUntil) {
            return;
        }
        
        const leftHand = this.hand1;
        const rightHand = this.hand2;
        
        // Update joint positions
        this.updateJointPositions(leftHand, rightHand);
        
        // Handle left hand pinch
        this.handleLeftHandPinch(leftHand, context);
        
        // Handle right hand pinch
        this.handleRightHandPinch(rightHand, context);
    }
    
    updateJointPositions(leftHand, rightHand) {
        // Left hand joints
        if (leftHand && leftHand.joints && leftHand.joints['thumb-tip']) {
            const thumbTip = leftHand.joints['thumb-tip'];
            this.lThumbObj.position.copy(thumbTip.position);
            this.lThumbObj.rotation.copy(thumbTip.rotation);
        }
        
        if (leftHand && leftHand.joints && leftHand.joints['index-finger-tip']) {
            const indexTip = leftHand.joints['index-finger-tip'];
            this.lIndexObj.position.copy(indexTip.position);
            this.lIndexObj.rotation.copy(indexTip.rotation);
        }
        
        // Right hand joints
        if (rightHand && rightHand.joints && rightHand.joints['thumb-tip']) {
            const thumbTip = rightHand.joints['thumb-tip'];
            this.rThumbObj.position.copy(thumbTip.position);
            this.rThumbObj.rotation.copy(thumbTip.rotation);
        }
        
        if (rightHand && rightHand.joints && rightHand.joints['index-finger-tip']) {
            const indexTip = rightHand.joints['index-finger-tip'];
            this.rIndexObj.position.copy(indexTip.position);
            this.rIndexObj.rotation.copy(indexTip.rotation);
        }
    }
    
    handleLeftHandPinch(leftHand, context) {
        const { productModel, objectsParent, rotationSpeed, 
                currentObjectType, cloudModel, colorCircleDot } = context;
        
        const lTracked = this.isJointTracked(leftHand?.joints?.['thumb-tip']) && 
                        this.isJointTracked(leftHand?.joints?.['index-finger-tip']);
        const lIndexThumbDist = lTracked ? 
            this.lIndexObj.position.distanceTo(this.lThumbObj.position) : Infinity;
        
        // Pinch detection with hysteresis
        if (!this.lPinchOn && lIndexThumbDist < this.PINCH_START) this.lPinchOn = true;
        if (this.lPinchOn && lIndexThumbDist > this.PINCH_END) this.lPinchOn = false;
        if (lIndexThumbDist > this.PINCH_END) this.leftPinchPrimed = true;
        const leftActionablePinch = lTracked && this.leftPinchPrimed && this.lPinchOn;
        
        if (leftActionablePinch) {
            this.lPinchSphere.position.copy(this.lThumbObj.position);
            this.lPinchSphere.rotation.copy(this.lThumbObj.rotation);
            
            // Check for grabbing
            if (!this.leftHandGrabbing && !this.rightHandGrabbing && 
                !this.isAnimatingBack && !colorCircleDot.userData.isDragging) {
                if (productModel && productModel.visible) {
                    const cubeWorldPosition = new THREE.Vector3();
                    productModel.getWorldPosition(cubeWorldPosition);
                    const distanceToCube = this.lPinchSphere.position.distanceTo(cubeWorldPosition);
                    
                    if (distanceToCube < this.grabDistance) {
                        this.startGrabbing('left', productModel, context);
                    }
                }
            }
            
            // Handle rotation or grabbing
            if ((this.leftHandGrabbing && this.grabbedObject) || colorCircleDot.userData.isDragging) {
                this.leftHandRotationActive = false;
            } else if (!this.leftHandGrabbing) {
                this.handleRotation('left', context);
            }
        } else {
            // Release grabbed object
            if (this.leftHandGrabbing && this.grabbedObject) {
                this.releaseGrabbedObject(objectsParent);
            }
            
            if (this.leftHandRotationActive) {
                this.leftHandRotationActive = false;
            }
        }
    }
    
    handleRightHandPinch(rightHand, context) {
        const { productModel, objectsParent, rotationSpeed, 
                currentObjectType, cloudModel, colorCircleDot } = context;
        
        const rTracked = this.isJointTracked(rightHand?.joints?.['thumb-tip']) && 
                        this.isJointTracked(rightHand?.joints?.['index-finger-tip']);
        const rIndexThumbDist = rTracked ? 
            this.rIndexObj.position.distanceTo(this.rThumbObj.position) : Infinity;
        
        // Pinch detection with hysteresis
        if (!this.rPinchOn && rIndexThumbDist < this.PINCH_START) this.rPinchOn = true;
        if (this.rPinchOn && rIndexThumbDist > this.PINCH_END) this.rPinchOn = false;
        if (rIndexThumbDist > this.PINCH_END) this.rightPinchPrimed = true;
        const rightActionablePinch = rTracked && this.rightPinchPrimed && this.rPinchOn;
        
        if (rightActionablePinch) {
            this.rPinchSphere.position.copy(this.rThumbObj.position);
            this.rPinchSphere.rotation.copy(this.rThumbObj.rotation);
            
            // Check for grabbing
            if (!this.leftHandGrabbing && !this.rightHandGrabbing && 
                !this.isAnimatingBack && !colorCircleDot.userData.isDragging) {
                if (productModel && productModel.visible) {
                    const cubeWorldPosition = new THREE.Vector3();
                    productModel.getWorldPosition(cubeWorldPosition);
                    const distanceToCube = this.rPinchSphere.position.distanceTo(cubeWorldPosition);
                    
                    if (distanceToCube < this.grabDistance) {
                        this.startGrabbing('right', productModel, context);
                    }
                }
            }
            
            // Handle rotation or grabbing
            if ((this.rightHandGrabbing && this.grabbedObject) || colorCircleDot.userData.isDragging) {
                this.rightHandRotationActive = false;
            } else if (!this.rightHandGrabbing) {
                this.handleRotation('right', context);
            }
        } else {
            // Release grabbed object
            if (this.rightHandGrabbing && this.grabbedObject) {
                this.releaseGrabbedObject(objectsParent);
            }
            
            if (this.rightHandRotationActive) {
                this.rightHandRotationActive = false;
            }
        }
    }
    
    startGrabbing(hand, productModel, context) {
        const { colorCircleOpen, colorCircleOrigin, closeButtonPlane } = context;
        
        if (hand === 'left') {
            this.leftHandGrabbing = true;
        } else {
            this.rightHandGrabbing = true;
        }
        
        this.grabbedObject = productModel;
        this.originalParent = productModel.parent;
        this.originalPosition = productModel.position.clone();
        this.originalRotation = productModel.rotation.clone();
        
        // Close color circle if open
        if (colorCircleOpen && context.setColorCircleOpen) {
            context.setColorCircleOpen(false);
            gsap.to([colorCircleOrigin.scale, closeButtonPlane.scale], {
                x: 0, y: 0, z: 0,
                duration: 0.3,
                ease: "power2.inOut"
            });
        }
        
        const worldQuaternion = productModel.getWorldQuaternion(new THREE.Quaternion());
        const pinchSphere = hand === 'left' ? this.lPinchSphere : this.rPinchSphere;
        
        pinchSphere.add(productModel);
        productModel.position.set(0, 0, -this.grabOffset);
        
        const parentWorldQuaternion = pinchSphere.getWorldQuaternion(new THREE.Quaternion());
        const localQuaternion = worldQuaternion.clone().multiply(parentWorldQuaternion.invert());
        productModel.quaternion.copy(localQuaternion);
        this.userMovedShoeThisSession = true;
    }
    
    releaseGrabbedObject(objectsParent) {
        if (this.leftHandGrabbing) this.leftHandGrabbing = false;
        if (this.rightHandGrabbing) this.rightHandGrabbing = false;
        
        if (this.SNAP_BACK_ON_RELEASE) {
            if (!this.isAnimatingBack) {
                this.isAnimatingBack = true;
                const currentWorldPosition = new THREE.Vector3();
                this.grabbedObject.getWorldPosition(currentWorldPosition);
                this.originalParent.add(this.grabbedObject);
                
                const localPosition = new THREE.Vector3();
                localPosition.copy(currentWorldPosition);
                this.originalParent.worldToLocal(localPosition);
                this.grabbedObject.position.copy(localPosition);
                
                gsap.to(this.grabbedObject.position, {
                    x: this.originalPosition.x,
                    y: this.originalPosition.y,
                    z: this.originalPosition.z,
                    duration: 1.0,
                    ease: "elastic.out(0.7, 0.5)",
                    onComplete: () => {
                        this.isAnimatingBack = false;
                    }
                });
                gsap.to(this.grabbedObject.rotation, {
                    x: this.originalRotation.x,
                    y: this.originalRotation.y,
                    z: this.originalRotation.z,
                    duration: 1.0,
                    ease: "elastic.out(0.7, 0.5)"
                });
            }
        } else {
            this.dropGrabbedObjectInPlace(this.grabbedObject, objectsParent);
        }
        
        this.grabbedObject = null;
        this.originalParent = null;
        this.originalPosition = null;
        this.originalRotation = null;
    }
    
    handleRotation(hand, context) {
        const { productModel, cloudModel, currentObjectType, rotationSpeed, 
                shoeRotation, cloudRotation } = context;
        
        const isLeft = hand === 'left';
        const thumbObj = isLeft ? this.lThumbObj : this.rThumbObj;
        
        if (isLeft) {
            if (!this.leftHandRotationActive) {
                this.leftHandRotationActive = true;
                this.lastLeftHandX = thumbObj.position.x;
                this.lastLeftHandY = thumbObj.position.y;
            }
            
            if (this.leftHandRotationActive) {
                const currentX = thumbObj.position.x;
                const currentY = thumbObj.position.y;
                const deltaX = currentX - this.lastLeftHandX;
                const deltaY = currentY - this.lastLeftHandY;
                
                this.applyRotation(deltaX, deltaY, context);
                
                this.lastLeftHandX = currentX;
                this.lastLeftHandY = currentY;
            }
        } else {
            if (!this.rightHandRotationActive) {
                this.rightHandRotationActive = true;
                this.lastRightHandX = thumbObj.position.x;
                this.lastRightHandY = thumbObj.position.y;
            }
            
            if (this.rightHandRotationActive) {
                const currentX = thumbObj.position.x;
                const currentY = thumbObj.position.y;
                const deltaX = currentX - this.lastRightHandX;
                const deltaY = currentY - this.lastRightHandY;
                
                this.applyRotation(deltaX, deltaY, context);
                
                this.lastRightHandX = currentX;
                this.lastRightHandY = currentY;
            }
        }
    }
    
    applyRotation(deltaX, deltaY, context) {
        const { productModel, cloudModel, currentObjectType, rotationSpeed, 
                shoeRotation, cloudRotation } = context;
        
        if (Math.abs(deltaX) > 0.001) {
            if (currentObjectType === 'shoe' && productModel && productModel.visible) {
                shoeRotation.y += deltaX * rotationSpeed;
                productModel.rotation.y = shoeRotation.y;
            } else if (currentObjectType === 'cloud' && cloudModel && cloudModel.visible) {
                cloudRotation.y += deltaX * rotationSpeed;
                cloudModel.rotation.y = cloudRotation.y;
            }
        }
        
        if (Math.abs(deltaY) > 0.001 && currentObjectType === 'cloud' && 
            cloudModel && cloudModel.visible) {
            const newRotationX = cloudRotation.x - deltaY * rotationSpeed;
            const minRotation = -Math.PI / 3;
            const maxRotation = Math.PI / 3;
            cloudRotation.x = Math.max(minRotation, Math.min(maxRotation, newRotationX));
            cloudModel.rotation.x = cloudRotation.x;
        }
    }
}

