// A glass card. The quad is slightly larger than the card so the edge can be antialiased here
// instead of by geometry, which keeps it crisp while the card tilts.
precision highp float;

uniform vec2 uSize;      // card size in px
uniform float uPad;      // margin of the quad around the card, px
uniform float uRadius;   // corner radius, px
uniform vec2 uDraw;      // drawing buffer size, device px
uniform sampler2D tGlow; // the star field as soft glows, as seen "through" the glass
uniform float uGlass;    // 1 = clear glass, 0 = solid black
uniform float uOpacity;
uniform vec2 uPointer;   // pointer in card px, origin at the centre, y up
uniform float uPresence; // 0 when there is no mouse
uniform float uHover;
uniform float uTime;

uniform sampler2D tImage;
uniform float uHasImage;
uniform vec4 uImageRect;   // x, y, w, h in card px from the top-left corner
uniform float uImageAspect;
uniform vec2 uImageShift;

varying vec2 vUv;

float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = (vUv - 0.5) * (uSize + 2.0 * uPad);
  float d = roundedBox(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 0.0001);
  float cover = 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);

  vec2 n = p / (uSize * 0.5); // -1..1 across the card
  vec2 screen = gl_FragCoord.xy / uDraw;

  // Glass: the glow texture, bent a little more toward the edges like a thick pane.
  vec2 bend = n * dot(n, n) * 0.010;
  float glow = texture2D(tGlow, screen - bend).r;
  float tint = mix(0.016, 0.052, smoothstep(-1.0, 1.0, n.y)); // faintly lit from above
  float body = tint * (0.35 + 0.65 * uGlass) + glow * uGlass;

  // A soft pool of light under the pointer.
  float pd = length(p - uPointer);
  body += uPresence * (0.018 + 0.030 * uHover) * exp(-pd * pd / 52000.0);

  // Project image, grayscale, cropped to fill its frame. Sampled for every pixel (no branch) so
  // the texture filtering stays well defined along the frame's edge.
  vec2 q = vec2(p.x + uSize.x * 0.5, uSize.y * 0.5 - p.y);
  float id = roundedBox(q - (uImageRect.xy + uImageRect.zw * 0.5), uImageRect.zw * 0.5, 0.0);
  float inside = (1.0 - smoothstep(-aa * 0.5, aa * 0.5, id)) * uHasImage;
  vec2 uv = (q - uImageRect.xy) / uImageRect.zw;
  float frame = uImageRect.z / uImageRect.w;
  vec2 fit = frame > uImageAspect ? vec2(1.0, uImageAspect / frame) : vec2(frame / uImageAspect, 1.0);
  uv = (uv - 0.5) * fit / 1.10 + 0.5 + uImageShift;
  vec3 rgb = texture2D(tImage, vec2(uv.x, 1.0 - uv.y)).rgb;
  float gray = dot(rgb, vec3(0.299, 0.587, 0.114)) * (0.86 + 0.14 * uHover);
  // a hairline where the image meets the glass below it
  float rim = smoothstep(-1.0 - aa, -1.0, id) * 0.12;
  body = mix(body, gray + rim, inside);

  // Fine grain: reads as frosted glass and hides banding in the dark gradients.
  body += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.014;

  // Hairline border, brighter along the top and wherever the pointer is close.
  float line = smoothstep(-1.2 - aa * 0.5, -1.2 + aa * 0.5, d);
  float edge = 0.15 + 0.10 * smoothstep(0.2, 1.0, n.y) + uPresence * 0.75 * exp(-pd * pd / 26000.0);
  float value = mix(body, 1.0, line * clamp(edge, 0.0, 1.0));

  float alpha = cover * uOpacity;
  gl_FragColor = vec4(vec3(clamp(value, 0.0, 1.0)) * alpha, alpha);
}
