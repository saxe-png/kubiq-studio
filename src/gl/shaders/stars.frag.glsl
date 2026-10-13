precision highp float;

uniform float uGlow;
uniform float uGlowGain;

varying vec2 vUv;
varying float vBright;
varying float vHalo;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  // sharp: a tight core, plus a faint halo on the brightest stars
  float core = exp(-r2 * 7.0) + vHalo * 0.22 * exp(-r2 * 1.6);
  // glow: one wide soft disc that fades to nothing at the quad edge
  float soft = exp(-r2 * 3.2) * (1.0 - r2);

  float value = mix(core * vBright, soft * pow(vBright, 1.3) * uGlowGain, uGlow);
  gl_FragColor = vec4(vec3(value), 1.0);
}
