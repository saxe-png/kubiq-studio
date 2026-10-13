precision highp float;

varying vec2 vUv;
varying float vBright;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vec3(exp(-r2 * 5.0) * vBright), 1.0);
}
