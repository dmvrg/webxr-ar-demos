uniform float outlineThickness;
uniform vec3 outlineColor;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    // Calculate the Fresnel term
    float fresnelFactor = dot(normalize(vViewPosition), normalize(vNormal));
    fresnelFactor = 0.5 / fresnelFactor;
    fresnelFactor = pow(fresnelFactor, outlineThickness);       // Fresnel
    //fresnelFactor = step(0.7, fresnelFactor);                // Outline

    // Set the color of the outline based on the Fresnel term
    gl_FragColor = vec4(outlineColor, fresnelFactor);
}