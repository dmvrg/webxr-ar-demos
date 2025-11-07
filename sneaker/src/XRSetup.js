import * as THREE from 'three';
import { XRButton } from 'three/addons/webxr/XRButton.js';

export class XRSetup {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = null;
        this.pmrem = null;
        this.xrButton = null;
        this.defaultBackground = new THREE.Color(0x505050);
        this.compositionPositioned = false;
        this.xrSessionStartTime = null;
        
        this.initRenderer();
        this.initXRButton();
        this.setupEventListeners();
    }
    
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        
        // Enable physically correct lighting and tone mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.physicallyCorrectLights = true;
        
        // Disable shadows for XR/MR performance
        this.renderer.shadowMap.enabled = false;
        
        document.body.appendChild(this.renderer.domElement);
        
        // PMREM setup for environment prefiltering
        this.pmrem = new THREE.PMREMGenerator(this.renderer);
        this.pmrem.compileEquirectangularShader();
    }
    
    initXRButton() {
        // Create WebXR button but keep it hidden
        this.xrButton = XRButton.createButton(this.renderer, { 
            'optionalFeatures': ['hand-tracking'] 
        });
        this.xrButton.style.display = 'none';
        this.xrButton.style.opacity = '0';
        this.xrButton.style.pointerEvents = 'none';
        this.xrButton.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.xrButton);
        
        // Make entire screen clickable to start XR
        document.body.style.cursor = 'pointer';
        const onBodyClickToEnterXR = () => {
            this.xrButton.click();
        };
        document.body.addEventListener('click', onBodyClickToEnterXR, { passive: true });
        
        // Hide any default XR buttons
        this.hideDefaultXRButtons();
    }
    
    hideDefaultXRButtons() {
        const hideDefaultXRButtonsInTree = (root) => {
            if (!root) return;
            const candidates = root.querySelectorAll ? 
                root.querySelectorAll('button, a, div, canvas, span') : [];
            const shouldHide = (el) => {
                if (!(el instanceof HTMLElement)) return false;
                const cls = (el.className || '').toString().toLowerCase();
                const id = (el.id || '').toString().toLowerCase();
                const txt = (el.textContent || '').toLowerCase();
                if (cls.includes('xr') || cls.includes('webxr') || cls.includes('vr')) return true;
                if (id.includes('xr') || id.includes('webxr') || id.includes('vr')) return true;
                if (/enter\s*(xr|ar|vr)/i.test(txt) || /start\s*(xr|ar|vr)/i.test(txt)) return true;
                return false;
            };
            candidates.forEach((el) => {
                if (shouldHide(el) && el !== this.xrButton) {
                    el.style.display = 'none';
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                    el.setAttribute('aria-hidden', 'true');
                }
            });
        };
        
        hideDefaultXRButtonsInTree(document.body);
        
        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach((n) => {
                        if (n instanceof HTMLElement) {
                            hideDefaultXRButtonsInTree(n);
                        }
                    });
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }
    
    setupEventListeners() {
        this.renderer.xr.addEventListener('sessionstart', () => this.onSessionStart());
        this.renderer.xr.addEventListener('sessionend', () => this.onSessionEnd());
        
        // Toggle CSS class on XR session start/end
        this.renderer.xr.addEventListener('sessionstart', () => {
            document.body.classList.add('xr-presenting');
            this.scene.background = null; // Transparent for passthrough
        });
        this.renderer.xr.addEventListener('sessionend', () => {
            document.body.classList.remove('xr-presenting');
            this.scene.background = this.defaultBackground;
        });
    }
    
    onSessionStart() {
        this.xrSessionStartTime = Date.now();
        this.compositionPositioned = false;
    }
    
    onSessionEnd() {
        this.xrSessionStartTime = null;
        this.compositionPositioned = false;
    }
    
    positionCompositionAtHeadHeight(baseComposition, productModel, sizeScales, selectedSizeIndex) {
        if (this.compositionPositioned || !this.xrSessionStartTime) return;
        
        const elapsedTime = Date.now() - this.xrSessionStartTime;
        if (elapsedTime < 1000) return; // Wait 1 second for scene to settle
        
        const headHeight = this.camera.position.y;
        const headDistance = this.camera.position.z;
        
        baseComposition.position.set(0, headHeight - 0.2, headDistance - 1.0);
        
        if (productModel) {
            productModel.position.set(0, 0.03, 0);
            productModel.rotation.set(0, 0, 0);
        }
        
        this.compositionPositioned = true;
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getPMREM() {
        return this.pmrem;
    }
    
    setAnimationLoop(callback) {
        this.renderer.setAnimationLoop(callback);
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

