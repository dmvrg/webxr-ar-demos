import * as THREE from 'three';
import gsap from 'gsap';

export class UIColorPicker {
    constructor(header, textureLoader, configureTexture) {
        this.header = header;
        this.textureLoader = textureLoader;
        this.configureTexture = configureTexture;
        
        this.colorButton = null;
        this.colorCircleOrigin = null;
        this.colorCirclePlane = null;
        this.colorCircleCenter = null;
        this.colorCircleDot = null;
        this.closeButtonPlane = null;
        this.colorCircleOpen = false;
        this.shoeColorLayer = null;
        
        this.initColorPicker();
    }
    
    initColorPicker() {
        // Create color button sphere
        const sphereGeometry = new THREE.SphereGeometry(0.025, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        this.colorButton = new THREE.Mesh(sphereGeometry, sphereMaterial);
        
        // Create close button plane
        const closeButtonGeometry = new THREE.PlaneGeometry(0.04, 0.04);
        const closeButtonTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_close.png')
        );
        const closeButtonMaterial = new THREE.MeshBasicMaterial({
            map: closeButtonTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        this.closeButtonPlane = new THREE.Mesh(closeButtonGeometry, closeButtonMaterial);
        this.closeButtonPlane.position.set(0, 0, 0);
        this.closeButtonPlane.scale.set(0, 0, 0);
        this.colorButton.add(this.closeButtonPlane);
        
        // Create color circle origin
        this.colorCircleOrigin = new THREE.Object3D();
        
        // Position both at the same location
        const colorPickerPosition = new THREE.Vector3(-0.15, -0.06, 0);
        this.colorButton.position.copy(colorPickerPosition);
        this.colorCircleOrigin.position.copy(colorPickerPosition);
        
        // Set initial state to OFF
        this.colorCircleOrigin.scale.set(0, 0, 0);
        this.colorButton.userData.isPressed = false;
        
        // Create color circle plane
        const childPlaneSize = 0.2;
        const childPlaneGeometry = new THREE.PlaneGeometry(childPlaneSize, childPlaneSize);
        const colorCircleTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_colorcircle.png')
        );
        const childPlaneMaterial = new THREE.MeshBasicMaterial({ 
            map: colorCircleTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        this.colorCirclePlane = new THREE.Mesh(childPlaneGeometry, childPlaneMaterial);
        this.colorCirclePlane.position.set(0, 0, 0.05);
        
        // Create center reference
        this.colorCircleCenter = new THREE.Object3D();
        this.colorCircleCenter.position.set(0, 0, 0);
        this.colorCirclePlane.add(this.colorCircleCenter);
        
        this.colorCircleOrigin.add(this.colorCirclePlane);
        
        // Create color circle dot
        this.createColorCircleDot();
        
        // Add to header
        this.header.add(this.colorButton);
        this.header.add(this.colorCircleOrigin);
    }
    
    createColorCircleDot() {
        this.colorCircleDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.017, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xFF0000 })
        );
        
        // Create dot plane
        const dotPlaneGeometry = new THREE.CircleGeometry(0.0225, 32);
        const dotCircleTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_dotcircle.png')
        );
        const dotPlaneMaterial = new THREE.MeshBasicMaterial({ 
            map: dotCircleTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const dotPlane = new THREE.Mesh(dotPlaneGeometry, dotPlaneMaterial);
        dotPlane.position.set(0, 0, 0.002);
        this.colorCircleDot.add(dotPlane);
        
        this.colorCircleDot.renderOrder = 1;
        dotPlane.renderOrder = 1;
        
        this.colorCircleDot.position.set(0.081, 0, 0);
        this.colorCircleDot.userData.radius = 0.081;
        this.colorCircleDot.userData.isDragging = false;
        this.colorCircleDot.userData.activeHand = null;
        
        this.colorCirclePlane.add(this.colorCircleDot);
    }
    
    setShoeColorLayer(layer) {
        this.shoeColorLayer = layer;
    }
    
    updateShoeColor(color) {
        if (this.shoeColorLayer && this.shoeColorLayer.material) {
            this.shoeColorLayer.material.color.copy(color);
            this.shoeColorLayer.material.needsUpdate = true;
        }
    }
    
    toggleColorCircle() {
        this.colorCircleOpen = !this.colorCircleOpen;
        
        gsap.to(this.colorButton.scale, {
            x: 0.7, y: 0.7, z: 0.7,
            duration: 0.1,
            ease: "power2.out",
            onComplete: () => {
                gsap.to(this.colorButton.scale, {
                    x: 1, y: 1, z: 1,
                    duration: 0.2,
                    ease: "power2.out"
                });
            }
        });
        
        gsap.to(this.colorCircleOrigin.scale, {
            x: this.colorCircleOpen ? 1 : 0,
            y: this.colorCircleOpen ? 1 : 0,
            z: this.colorCircleOpen ? 1 : 0,
            duration: 0.3,
            ease: "power2.inOut"
        });
        
        gsap.to(this.closeButtonPlane.scale, {
            x: this.colorCircleOpen ? 1 : 0,
            y: this.colorCircleOpen ? 1 : 0,
            z: this.colorCircleOpen ? 1 : 0,
            duration: 0.3,
            ease: "power2.inOut"
        });
    }
    
    handleColorButtonInteraction(lIndexObj, rIndexObj, currentTime, 
                                  lastButtonTouchTime, buttonTouchCooldown) {
        const colorButtonWorldPosition = new THREE.Vector3();
        this.colorButton.getWorldPosition(colorButtonWorldPosition);
        
        const leftIndexToColorButton = lIndexObj ? 
            lIndexObj.position.distanceTo(colorButtonWorldPosition) : Infinity;
        const rightIndexToColorButton = rIndexObj ? 
            rIndexObj.position.distanceTo(colorButtonWorldPosition) : Infinity;
        
        if ((leftIndexToColorButton < 0.06 || rightIndexToColorButton < 0.06) && 
            (currentTime - lastButtonTouchTime) > buttonTouchCooldown) {
            this.toggleColorCircle();
            return true;
        }
        return false;
    }
    
    handleColorCircleDotInteraction(lPinchOn, rPinchOn, lPinchSphere, rPinchSphere) {
        if (!this.colorCircleOpen) return;
        
        const dotWorldPosition = new THREE.Vector3();
        this.colorCircleDot.getWorldPosition(dotWorldPosition);
        
        const centerWorldPosition = new THREE.Vector3();
        this.colorCircleCenter.getWorldPosition(centerWorldPosition);
        
        const leftPinchingNearDot = lPinchOn && 
            lPinchSphere.position.distanceTo(dotWorldPosition) < 0.06;
        const rightPinchingNearDot = rPinchOn && 
            rPinchSphere.position.distanceTo(dotWorldPosition) < 0.06;
        
        if (!this.colorCircleDot.userData.isDragging) {
            if (leftPinchingNearDot) {
                this.colorCircleDot.userData.isDragging = true;
                this.colorCircleDot.userData.activeHand = 'left';
            } else if (rightPinchingNearDot) {
                this.colorCircleDot.userData.isDragging = true;
                this.colorCircleDot.userData.activeHand = 'right';
            }
        }
        
        if (this.colorCircleDot.userData.isDragging) {
            const pinchPosition = this.colorCircleDot.userData.activeHand === 'left' ? 
                lPinchSphere.position : rPinchSphere.position;
            
            const isStillPinching = this.colorCircleDot.userData.activeHand === 'left' ? 
                lPinchOn : rPinchOn;
            
            const localPinchPosition = new THREE.Vector3();
            localPinchPosition.copy(pinchPosition);
            this.colorCircleCenter.worldToLocal(localPinchPosition);
            
            const angle = Math.atan2(localPinchPosition.y, localPinchPosition.x);
            const radius = this.colorCircleDot.userData.radius;
            this.colorCircleDot.position.x = Math.cos(angle) * radius;
            this.colorCircleDot.position.y = Math.sin(angle) * radius;
            this.colorCircleDot.position.z = 0;
            
            let hue = ((Math.atan2(this.colorCircleDot.position.y, 
                                   this.colorCircleDot.position.x) * 180 / Math.PI) + 360) % 360;
            
            const color = new THREE.Color();
            color.setHSL(hue / 360, 1, 0.5);
            
            this.colorCircleDot.material.color = color;
            this.colorButton.material.color = color;
            this.updateShoeColor(color);
            
            if (!isStillPinching) {
                this.colorCircleDot.userData.isDragging = false;
                this.colorCircleDot.userData.activeHand = null;
            }
        }
    }
    
    closeColorCircle() {
        if (this.colorCircleOpen) {
            this.colorCircleOpen = false;
            gsap.to([this.colorCircleOrigin.scale, this.closeButtonPlane.scale], {
                x: 0, y: 0, z: 0,
                duration: 0.3,
                ease: "power2.inOut"
            });
        }
    }
    
    getColorButton() {
        return this.colorButton;
    }
    
    getColorCircleDot() {
        return this.colorCircleDot;
    }
    
    getColorCircleOrigin() {
        return this.colorCircleOrigin;
    }
    
    getCloseButtonPlane() {
        return this.closeButtonPlane;
    }
    
    isColorCircleOpen() {
        return this.colorCircleOpen;
    }
    
    setColorCircleOpen(value) {
        this.colorCircleOpen = value;
    }
}

