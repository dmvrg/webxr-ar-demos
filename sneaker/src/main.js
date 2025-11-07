import * as THREE from 'three';
import gsap from 'gsap';
import { XRSetup } from './XRSetup.js';
import { HandInput } from './HandInput.js';
import { UIHeader } from './UIHeader.js';
import { UIColorPicker } from './UIColorPicker.js';
import { UITagsCloud } from './UITagsCloud.js';
import { Environment } from './Environment.js';
import { Models } from './Models.js';

// Configure GSAP for optimal performance with Three.js
gsap.ticker.lagSmoothing(0);
gsap.ticker.fps(60);

// Helper function to configure textures
function configureTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    return texture;
}

// Scene
const scene = new THREE.Scene();
const defaultBackground = new THREE.Color(0x505050);
scene.background = defaultBackground;

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.set(0, 1.6, 3);
scene.add(camera);

// Initialize XR Setup
const xrSetup = new XRSetup(scene, camera);
const renderer = xrSetup.getRenderer();
const pmrem = xrSetup.getPMREM();

// Base Composition
const tempGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const tempMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true,
    opacity: 0.0,
    depthTest: false,
    depthWrite: false
});
const baseComposition = new THREE.Mesh(tempGeo, tempMat);
baseComposition.scale.set(0.9, 0.9, 0.9);
scene.add(baseComposition);
baseComposition.visible = false;

// Create objects parent group
const objectsParent = new THREE.Group();
objectsParent.position.set(0, 0, 0);
objectsParent.rotation.set(0, 0, 0);
baseComposition.add(objectsParent);

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Add ground plane
const planeGeometry = new THREE.PlaneGeometry(0.4, 0.4);
const uiCircleTexture = configureTexture(textureLoader.load('/static/ui_circle.png'));
const planeMaterial = new THREE.MeshLambertMaterial({ 
    map: uiCircleTexture,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    toneMapped: false
});
const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.set(0, -0.1, 0);
baseComposition.add(groundPlane);

// Add button
const buttonGeometry = new THREE.PlaneGeometry(0.1517, 0.0525);
const buttonTexture = configureTexture(textureLoader.load('/static/ui_button-search.png'));
const buttonTextureEdit = configureTexture(textureLoader.load('/static/ui_button-search.png'));
const buttonTextureDone = configureTexture(textureLoader.load('/static/ui_button-done.png'));

const buttonMaterial = new THREE.MeshBasicMaterial({ 
    map: buttonTexture,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    toneMapped: false
});

const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
button.position.set(0, -0.18, 0.22);
button.rotation.x = -20 * Math.PI / 180;
baseComposition.add(button);

// Button state tracking
let isButtonPressed = false;
let buttonTouchActive = false;
let lastButtonTouchTime = 0;
const buttonTouchCooldown = 500;

// Function to update button texture
function updateButtonTexture() {
    if (models.getCurrentObjectType() === 'shoe') {
        buttonMaterial.map = buttonTexture;
    } else {
        buttonMaterial.map = buttonTextureDone;
    }
    buttonMaterial.needsUpdate = true;
}

// Function to animate button press
function animateButtonPress() {
    if (isButtonPressed) return;
    
    isButtonPressed = true;
    const originalScale = 1.0;
    
    gsap.to(button.scale, {
        x: originalScale * 0.7,
        y: originalScale * 0.7,
        z: originalScale * 0.7,
        duration: 0.12,
        ease: "power2.out",
        onComplete: () => {
            models.toggleShoeCloudVisibility({
                header: uiHeader.getHeader(),
                headerTags: uiTagsCloud.getHeaderTags(),
                groundPlane: groundPlane,
                colorPicker: uiColorPicker,
                cachedDotPlanes: uiTagsCloud.cachedDotPlanes
            });
            updateButtonTexture();
            
            gsap.to(button.scale, {
                x: originalScale,
                y: originalScale,
                z: originalScale,
                duration: 0.3,
                ease: "power2.out",
                onComplete: () => {
                    isButtonPressed = false;
                }
            });
        }
    });
}

// Initialize modules
const uiHeader = new UIHeader(baseComposition, textureLoader, configureTexture);
const uiColorPicker = new UIColorPicker(uiHeader.getHeader(), textureLoader, configureTexture);
const uiTagsCloud = new UITagsCloud(baseComposition, textureLoader, configureTexture, camera);
const environment = new Environment(scene, pmrem);
const models = new Models(objectsParent, uiHeader.getSizeScales(), uiHeader.getSelectedSizeIndex());

// Initialize hand input
const handInput = new HandInput(scene, renderer, camera);

// Load models
models.loadShoe(() => {
    // Set color layer reference
    uiColorPicker.setShoeColorLayer(models.getShoeColorLayer());
    
    // Ensure shoe is in correct position when session starts
    renderer.xr.addEventListener('sessionstart', () => {
        baseComposition.visible = true;
        
        const productModel = models.getProductModel();
        if (productModel && !handInput.userMovedShoeThisSession) {
            gsap.killTweensOf(productModel.position);
            gsap.killTweensOf(productModel.rotation);
            gsap.killTweensOf(productModel.scale);
            
            productModel.position.set(0, 0.03, 0);
            productModel.rotation.set(0, 0, 0);
            const currentScale = uiHeader.getSizeScales()[uiHeader.getSelectedSizeIndex()] || 1.0;
            productModel.scale.set(currentScale, currentScale, currentScale);
        }
        
        handInput.resetGrabAndPinchState(
            productModel,
            objectsParent,
            uiHeader.getSizeScales(),
            uiHeader.getSelectedSizeIndex()
        );
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        baseComposition.visible = false;
    });
});

models.loadCloud(() => {}, (cloudModel) => {
    uiTagsCloud.createDotPlanes(cloudModel);
});

// Set initial button texture
updateButtonTexture();

// Clock for delta time
const clock = new THREE.Clock();

// Main animation loop
xrSetup.setAnimationLoop(function() {
    const delta = clock.getDelta();
    gsap.ticker.tick(delta);
    
    xrSetup.render();
    
    // Update hand input
    const handContext = {
        productModel: models.getProductModel(),
        cloudModel: models.getCloudModel(),
        objectsParent: objectsParent,
        rotationSpeed: models.getRotationSpeed(),
        currentObjectType: models.getCurrentObjectType(),
        shoeRotation: models.getShoeRotation(),
        cloudRotation: models.getCloudRotation(),
        colorCircleDot: uiColorPicker.getColorCircleDot(),
        colorCircleOpen: uiColorPicker.isColorCircleOpen(),
        colorCircleOrigin: uiColorPicker.getColorCircleOrigin(),
        closeButtonPlane: uiColorPicker.getCloseButtonPlane(),
        setColorCircleOpen: (value) => uiColorPicker.setColorCircleOpen(value)
    };
    
    handInput.update(handContext);
    
    // Handle interactions
    handleInteractions();
    
    // Update dot planes to face camera
    uiTagsCloud.updateDotPlanesToFaceCamera(models.getCloudModel());
    
    // Position composition at head height
    if (!xrSetup.compositionPositioned) {
        xrSetup.positionCompositionAtHeadHeight(
            baseComposition,
            models.getProductModel(),
            uiHeader.getSizeScales(),
            uiHeader.getSelectedSizeIndex()
        );
    }
});

function handleInteractions() {
    const currentTime = Date.now();
    const lIndexObj = handInput.lIndexObj;
    const rIndexObj = handInput.rIndexObj;
    
    // Button touch detection
    const buttonWorldPosition = new THREE.Vector3();
    button.getWorldPosition(buttonWorldPosition);
    
    if (lIndexObj && button) {
        const leftIndexToButton = lIndexObj.position.distanceTo(buttonWorldPosition);
        if (leftIndexToButton < 0.06 && !buttonTouchActive && 
            (currentTime - lastButtonTouchTime) > buttonTouchCooldown) {
            buttonTouchActive = true;
            lastButtonTouchTime = currentTime;
            animateButtonPress();
        }
    }
    
    if (rIndexObj && button) {
        const rightIndexToButton = rIndexObj.position.distanceTo(buttonWorldPosition);
        if (rightIndexToButton < 0.06 && !buttonTouchActive && 
            (currentTime - lastButtonTouchTime) > buttonTouchCooldown) {
            buttonTouchActive = false;
            lastButtonTouchTime = currentTime;
            animateButtonPress();
        }
    }
    
    // Reset button touch state
    if (lIndexObj && button && rIndexObj && button) {
        const leftIndexToButton = lIndexObj.position.distanceTo(buttonWorldPosition);
        const rightIndexToButton = rIndexObj.position.distanceTo(buttonWorldPosition);
        
        if (leftIndexToButton > 0.09 && rightIndexToButton > 0.09) {
            buttonTouchActive = false;
        }
    }
    
    // Color button interaction
    const colorButtonPressed = uiColorPicker.handleColorButtonInteraction(
        lIndexObj,
        rIndexObj,
        currentTime,
        lastButtonTouchTime,
        buttonTouchCooldown
    );
    
    if (colorButtonPressed) {
        lastButtonTouchTime = currentTime;
    }
    
    // Color circle dot interaction
    uiColorPicker.handleColorCircleDotInteraction(
        handInput.lPinchOn,
        handInput.rPinchOn,
        handInput.lPinchSphere,
        handInput.rPinchSphere
    );
    
    // Size button interaction
    const sizeResult = uiHeader.handleSizeButtonInteraction(
        lIndexObj,
        rIndexObj,
        models.getProductModel(),
        currentTime,
        lastButtonTouchTime,
        buttonTouchCooldown,
        buttonTouchActive,
        uiColorPicker.isColorCircleOpen()
    );
    
    if (sizeResult && sizeResult.shouldUpdateCooldown) {
        lastButtonTouchTime = currentTime;
        buttonTouchActive = true;
    }
    
    // Tag interaction
    const tagResult = uiTagsCloud.handleTagInteraction(
        lIndexObj,
        rIndexObj,
        models.getCloudModel(),
        currentTime,
        lastButtonTouchTime,
        buttonTouchCooldown,
        buttonTouchActive
    );
    
    if (tagResult && tagResult.shouldUpdateCooldown) {
        lastButtonTouchTime = currentTime;
        buttonTouchActive = true;
    }
}

