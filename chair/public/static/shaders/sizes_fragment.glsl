uniform vec3 baseColor;
uniform float opacity;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
    // Simple plain white color
    gl_FragColor = vec4(baseColor, opacity);
}
