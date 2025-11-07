import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import gsap from 'gsap';

export class UIHeader {
    constructor(baseComposition, textureLoader, configureTexture) {
        this.baseComposition = baseComposition;
        this.textureLoader = textureLoader;
        this.configureTexture = configureTexture;
        
        // Size selection state
        this.selectedSizeIndex = 2; // Default to 9.5
        this.sizeTexts = [];
        this.textConfigs = [];
        this.selector = null;
        
        // Size scale mapping
        this.sizeScales = [0.92, 0.97, 1.02, 1.06, 1.12];
        
        // Selector positions
        this.selectorPositions = [
            { x: -0.05, y: -0.06, z: 0.021 },  // Slot 0: "8"
            { x: -0.0, y: -0.06, z: 0.021 },   // Slot 1: "9"
            { x: 0.056, y: -0.06, z: 0.021 },  // Slot 2: "9.5" (default)
            { x: 0.110, y: -0.06, z: 0.021 },  // Slot 3: "10"
            { x: 0.155, y: -0.06, z: 0.021 }   // Slot 4: "11"
        ];
        
        this.header = null;
        this.initHeader();
    }
    
    initHeader() {
        const headerWidth = 0.406 * 0.9;
        const headerHeight = headerWidth * (201 / 406);
        const headerGeometry = new THREE.PlaneGeometry(headerWidth, headerHeight);
        
        const headerTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_header.png',
                (texture) => { headerMaterial.needsUpdate = true; },
                (xhr) => {},
                (error) => {}
            )
        );
        
        const headerMaterial = new THREE.MeshBasicMaterial({ 
            map: headerTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        
        this.header = new THREE.Mesh(headerGeometry, headerMaterial);
        this.header.position.set(0, 0.34, 0);
        this.baseComposition.add(this.header);
        
        this.loadFont();
    }
    
    loadFont() {
        const fontLoader = new FontLoader();
        fontLoader.load('/static/fonts/roboto_black.typeface.json', (font) => {
            this.createSizeTexts(font);
            this.createSelector();
            
            // Set initial state
            setTimeout(() => {
                this.updateSizeSelection(this.selectedSizeIndex, null);
            }, 100);
        });
    }
    
    createSizeTexts(font) {
        this.textConfigs = [
            { text: '8', position: [-0.06, -0.07, 0.001], index: 0 },
            { text: '9', position: [-0.01, -0.07, 0.001], index: 1 },
            { text: '9.5', position: [0.032, -0.07, 0.001], index: 2 },
            { text: '10', position: [0.09, -0.07, 0.001], index: 3 },
            { text: '11', position: [0.137, -0.07, 0.001], index: 4 }
        ];
        
        this.textConfigs.forEach(config => {
            const textGeometry = new TextGeometry(config.text, {
                font: font,
                size: 0.02,
                depth: 0.001,
                curveSegments: 12,
                bevelEnabled: false
            });
            
            const textMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                toneMapped: false
            });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(...config.position);
            
            textMesh.userData.isSizeButton = true;
            textMesh.userData.sizeIndex = config.index;
            textMesh.userData.isPressed = false;
            
            this.sizeTexts[config.index] = textMesh;
            this.header.add(textMesh);
        });
    }
    
    createSelector() {
        const selectorGeometry = new THREE.PlaneGeometry(0.06, 0.06);
        const selectorTexture = this.configureTexture(
            this.textureLoader.load('/static/ui_selector.png',
                (texture) => { selectorMaterial.needsUpdate = true; },
                (xhr) => {},
                (error) => {}
            )
        );
        
        const selectorMaterial = new THREE.MeshBasicMaterial({ 
            map: selectorTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        
        this.selector = new THREE.Mesh(selectorGeometry, selectorMaterial);
        const initialPosition = this.selectorPositions[this.selectedSizeIndex];
        this.selector.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        this.header.add(this.selector);
    }
    
    updateSizeSelection(newIndex, productModel) {
        try {
            if (!this.sizeTexts || !Array.isArray(this.sizeTexts)) {
                return;
            }
            
            // Reset all buttons to default state
            this.sizeTexts.forEach((textMesh, index) => {
                if (textMesh && textMesh.material) {
                    try {
                        textMesh.material.color.setHex(0xffffff);
                        textMesh.material.needsUpdate = true;
                        
                        gsap.to(textMesh.scale, {
                            x: 1.0, y: 1.0, z: 1.0,
                            duration: 0.2,
                            ease: "power2.out"
                        });
                    } catch (error) {}
                }
            });
            
            // Set new selected button to active state
            if (this.sizeTexts[newIndex] && this.sizeTexts[newIndex].material) {
                const selectedText = this.sizeTexts[newIndex];
                
                try {
                    selectedText.material.color.setHex(0x00FF01);
                    selectedText.material.needsUpdate = true;
                    
                    gsap.to(selectedText.scale, {
                        x: 1.2, y: 1.2, z: 1.2,
                        duration: 0.2,
                        ease: "power2.out"
                    });
                    
                    // Update selector position
                    if (this.selector && this.selectorPositions[newIndex]) {
                        const targetPosition = this.selectorPositions[newIndex];
                        
                        gsap.to(this.selector.position, {
                            x: targetPosition.x,
                            y: targetPosition.y,
                            z: targetPosition.z,
                            duration: 0.3,
                            ease: "power2.out"
                        });
                    }
                } catch (error) {}
            }
            
            this.selectedSizeIndex = newIndex;
            
            // Update shoe model scale
            if (productModel && this.sizeScales[newIndex] !== undefined) {
                const targetScale = this.sizeScales[newIndex];
                
                gsap.to(productModel.scale, {
                    x: targetScale,
                    y: targetScale,
                    z: targetScale,
                    duration: 0.4,
                    ease: "power2.out"
                });
            }
        } catch (error) {}
    }
    
    animateSizeButtonPress(buttonIndex, productModel) {
        try {
            const button = this.sizeTexts[buttonIndex];
            if (!button || !button.userData || button.userData.isPressed) return;
            
            button.userData.isPressed = true;
            
            gsap.to(button.scale, {
                x: 0.6, y: 0.6, z: 0.6,
                duration: 0.1,
                ease: "power2.out",
                onComplete: () => {
                    try {
                        this.updateSizeSelection(buttonIndex, productModel);
                        
                        setTimeout(() => {
                            if (button && button.userData) {
                                button.userData.isPressed = false;
                            }
                        }, 100);
                    } catch (error) {}
                }
            });
        } catch (error) {}
    }
    
    handleSizeButtonInteraction(lIndexObj, rIndexObj, productModel, 
                                 currentTime, lastButtonTouchTime, buttonTouchCooldown, 
                                 buttonTouchActive, colorCircleOpen) {
        if (!this.sizeTexts || this.sizeTexts.length === 0) {
            return { shouldUpdateCooldown: false };
        }
        
        const touchThreshold = 0.03; // Reduced from 0.06 to prevent multi-selection
        let closestButton = null;
        let closestDistance = Infinity;
        
        // First pass: find the closest button within threshold
        this.sizeTexts.forEach((sizeButton, index) => {
            if (!sizeButton || !sizeButton.userData) return;
            
            try {
                const sizeButtonWorldPosition = new THREE.Vector3();
                sizeButton.getWorldPosition(sizeButtonWorldPosition);
                
                const leftIndexDistance = lIndexObj ? 
                    lIndexObj.position.distanceTo(sizeButtonWorldPosition) : Infinity;
                const rightIndexDistance = rIndexObj ? 
                    rIndexObj.position.distanceTo(sizeButtonWorldPosition) : Infinity;
                
                const minDistance = Math.min(leftIndexDistance, rightIndexDistance);
                
                // Track the closest button
                if (minDistance < touchThreshold && minDistance < closestDistance) {
                    closestDistance = minDistance;
                    closestButton = { button: sizeButton, index: index };
                }
                
                // Reset press state for buttons not being touched
                if (minDistance >= touchThreshold && sizeButton.userData.isPressed) {
                    sizeButton.userData.isPressed = false;
                }
            } catch (error) {}
        });
        
        // Second pass: only trigger the closest button
        if (closestButton && !closestButton.button.userData.isPressed && 
            !buttonTouchActive && !colorCircleOpen &&
            (currentTime - lastButtonTouchTime) > buttonTouchCooldown) {
            
            this.animateSizeButtonPress(closestButton.index, productModel);
            return { shouldUpdateCooldown: true };
        }
        
        return { shouldUpdateCooldown: false };
    }
    
    getHeader() {
        return this.header;
    }
    
    getSizeScales() {
        return this.sizeScales;
    }
    
    getSelectedSizeIndex() {
        return this.selectedSizeIndex;
    }
}

