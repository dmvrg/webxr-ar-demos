varying vec2 vUv;
uniform float uTime;

vec3 palette( float t )
{

    vec3 a = vec3(0.938, 0.328, 0.718);
    vec3 b = vec3(0.659, 0.438, 0.328);
    vec3 c = vec3(0.388, 0.388, 0.296);
    vec3 d = vec3(2.538, 2.478, 0.168);

    return a + b*cos( 6.28318*(c*t+d) );
    
}

void main() {
    
    vec2 mUv = vec2(vUv.x - 0.5, vUv.y - 0.5);

    float d = length(mUv);

    vec3 col = palette(d + uTime);

    d = sin(d * 8.0 + uTime) / 8.0;
    d = abs(d);

    d = 0.02 / d;

    col *= d;

    gl_FragColor = vec4(col, 1.0);

}