// A shooting star: one quad stretched from its head back along its path, in screen px.
uniform vec2 uRes;
uniform vec2 uHead;
uniform vec2 uDir;
uniform float uLength;
uniform float uWidth;

varying vec2 vUv;

void main() {
  vec2 across = vec2(-uDir.y, uDir.x);
  // position.x: 0 at the head, 1 at the end of the tail. position.y: -1..1 across.
  vec2 px = uHead - uDir * position.x * uLength + across * position.y * uWidth;
  vUv = position.xy;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}
