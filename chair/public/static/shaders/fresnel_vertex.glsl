varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {

    // Pass the normal and view position to the fragment shader
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -viewPosition.xyz;
    
    gl_Position = projectionMatrix * viewPosition;
    
}