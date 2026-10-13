// Each star is a small quad. The same geometry is drawn twice per frame: once sharp onto the
// screen, and once as wide soft glows into a small texture that the glass cards look through.

attribute vec2 aPos;    // home position in the wrapping field, 0..1
attribute float aLayer; // depth: 1 = nearest (moves most), smaller = farther
attribute float aSize;  // radius of the sharp star in px
attribute float aBright;
attribute float aPhase;
attribute float aRate;
attribute float aRand;  // 0..1, used to thin the field with the density slider

uniform vec2 uRes;       // screen size in px
uniform float uScroll;   // scroll position in px
uniform float uTime;
uniform float uSpeed;    // px of star travel per px of scroll, nearest layer
uniform float uDrift;
uniform vec2 uPointer;   // eased pointer, -1..1
uniform float uPointerAmt;
uniform float uSizeMul;
uniform float uDensity;
uniform float uTwinkle;
uniform float uFade;
uniform float uGlow;       // 0 = sharp pass, 1 = glow pass
uniform float uGlowRadius; // px

varying vec2 vUv;
varying float vBright;
varying float vHalo;

void main() {
  // The field is a little larger than the screen and wraps, so it never runs out.
  vec2 field = uRes * vec2(1.12, 1.2);
  vec2 p = aPos * field;
  p.y -= (uScroll * uSpeed + uTime * uDrift * 1.1) * aLayer;
  p.x -= uTime * uDrift * 2.2 * aLayer;
  p -= uPointer * uPointerAmt * aLayer;
  p = mod(p, field) - (field - uRes) * 0.5;

  float twinkle = sin(uTime * aRate + aPhase) * 0.6 + sin(uTime * aRate * 2.7 + aPhase * 1.9) * 0.4;
  float bright = aBright * (1.0 + uTwinkle * twinkle * (0.35 + 0.65 * aBright));
  bright *= uFade;

  float radius = mix(aSize * uSizeMul, uGlowRadius * (0.55 + 0.45 * aBright), uGlow);
  // stars thinned out by the density slider collapse to nothing, so they cost no pixels
  radius *= step(aRand, uDensity);
  vec2 px = p + position.xy * radius;

  vUv = position.xy;
  vBright = bright;
  vHalo = smoothstep(0.55, 1.0, aBright);
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}
