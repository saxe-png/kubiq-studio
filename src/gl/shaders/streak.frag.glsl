precision highp float;

uniform float uAlpha;

varying vec2 vUv;

void main() {
  float tail = pow(1.0 - vUv.x, 2.4);
  float across = exp(-vUv.y * vUv.y * 5.0) * (1.0 - vUv.y * vUv.y);
  float head = exp(-vUv.x * vUv.x * 900.0);
  gl_FragColor = vec4(vec3((tail * 0.75 + head) * across * uAlpha), 1.0);
}
