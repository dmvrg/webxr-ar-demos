varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
    // Pass the normal and view position to the fragment shader
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -viewPosition.xyz;
    
    // Pass UV coordinates for texture mapping
    vUv = uv;
    
    gl_Position = projectionMatrix * viewPosition;
}
