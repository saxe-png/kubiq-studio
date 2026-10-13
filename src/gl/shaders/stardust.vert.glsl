// The "stardust" title: thousands of small stars that fly in from all over the sky and settle
// into the shape of the letters. Each star knows its place inside its word; the word's position
// and size arrive as uniforms, so the stars follow the title wherever it goes.

attribute vec2 aHome;    // place in the word, font units (y grows downward, baseline at 0)
attribute vec2 aScatter; // where it starts, as a fraction of the screen
attribute vec4 aSeed;    // radius px, brightness, phase, arrival delay
attribute float aWord;   // which word it belongs to

uniform vec2 uRes;
uniform vec2 uOrigin[2]; // left edge and baseline of each word, px
uniform float uScale[2]; // px per font unit of each word
uniform float uGather;   // 0 = scattered, 1 = letters
uniform float uAmount;   // overall visibility
uniform float uTime;
uniform vec2 uPointer;   // px
uniform float uPointerOn;
uniform float uSize;

varying vec2 vUv;
varying float vBright;

void main() {
  vec2 origin = aWord < 0.5 ? uOrigin[0] : uOrigin[1];
  float scale = aWord < 0.5 ? uScale[0] : uScale[1];
  vec2 home = origin + aHome * scale;
  vec2 from = aScatter * uRes * 1.3 - uRes * 0.15;

  // stars arrive one after another, each easing into place
  float g = clamp(uGather * 1.7 - aSeed.w * 0.7, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  vec2 p = mix(from, home, g);

  // they travel on a slight arc rather than a straight line
  vec2 path = home - from;
  p += vec2(-path.y, path.x) * 0.16 * sin(g * 3.14159) * (aSeed.z / 3.14159 - 1.0);

  // once in place they never sit completely still
  p += vec2(sin(uTime * 0.9 + aSeed.z * 3.0), cos(uTime * 0.7 + aSeed.z * 5.0)) * 0.45 * g;

  // the pointer pushes nearby stars aside
  vec2 away = p - uPointer;
  float near = exp(-dot(away, away) / 9000.0);
  p += normalize(away + 0.0001) * near * 34.0 * uPointerOn * g;

  float twinkle = 1.0 + 0.3 * sin(uTime * (0.8 + aSeed.z * 0.5) + aSeed.z * 11.0);
  vBright = aSeed.y * twinkle * uAmount * mix(0.55, 1.0, g);
  vUv = position.xy;

  vec2 px = p + position.xy * aSeed.x * uSize;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}
