import * as THREE from 'three';
import { viewport } from '../core/viewport.ts';
import { createSharedCardUniforms, type SharedCardUniforms } from './cards.ts';
import { createShootingStar, type ShootingStar } from './shooting-star.ts';
import { createStardust, type Stardust } from './stardust.ts';
import { createStars, type Stars } from './stars.ts';

// Owns the WebGL canvas and draws a frame in two steps:
//   1. the star field as wide soft glows into a small texture (what you see through glass),
//   2. the sharp star field onto the screen, then the stardust title (when that style is on),
//      then the glass cards on top, sampling that texture.

/** Camera field of view. Narrow, so tilted cards do not distort much. */
const FOV = 28;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  stars: Stars;
  shootingStar: ShootingStar;
  /** The title as stars, for the "stardust" hero style. */
  stardust: Stardust;
  /** Scene the card meshes are added to. 1 unit = 1 px, origin at the screen centre, y up. */
  cardScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cardUniforms: SharedCardUniforms;
  /** Distance of the camera from the card plane; the text layer uses it as its CSS perspective. */
  readonly distance: number;
  resize(): void;
  render(glowRadius: number, glowGain: number): void;
  /** Average brightness of a region of the last frame, 0..1 (debugging). */
  sample(x: number, y: number, w: number, h: number): { mean: number; max: number };
}

export function createStage(canvas: HTMLCanvasElement, keepPixels: boolean): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: keepPixels,
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  const stars = createStars();
  const shootingStar = createShootingStar();
  const sky = new THREE.Scene();
  sky.add(stars.mesh, shootingStar.mesh);
  // the sky shaders position everything in screen px themselves, so this camera is never used
  const skyCamera = new THREE.Camera();

  // kept out of the sky scene so its stars are not also drawn as glows behind the glass
  const stardust = createStardust();
  const front = new THREE.Scene();
  front.add(stardust.mesh);

  const cardScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 10000);
  const cardUniforms = createSharedCardUniforms();

  const float = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const glowTarget = new THREE.WebGLRenderTarget(2, 2, {
    depthBuffer: false,
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  cardUniforms.tGlow.value = glowTarget.texture;

  let distance = 1;

  function resize(): void {
    const { w, h } = viewport;
    renderer.setPixelRatio(Math.min(viewport.dpr, viewport.coarse ? 1.75 : 2));
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(cardUniforms.uDraw.value);

    // the glows are blurry by nature, so half the screen resolution is plenty
    glowTarget.setSize(Math.max(2, Math.ceil(w / 2)), Math.max(2, Math.ceil(h / 2)));

    distance = h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.aspect = w / h;
    camera.position.set(0, 0, distance);
    camera.near = distance / 20;
    camera.far = distance * 4;
    camera.updateProjectionMatrix();

    stars.setSize(w, h);
    shootingStar.setSize(w, h);
    stardust.setSize(w, h);
  }

  resize();

  return {
    renderer,
    stars,
    shootingStar,
    stardust,
    cardScene,
    camera,
    cardUniforms,
    get distance() {
      return distance;
    },
    resize,
    render(glowRadius, glowGain) {
      stars.setGlow(true, glowRadius, glowGain);
      shootingStar.setGlow(true);
      renderer.setRenderTarget(glowTarget);
      renderer.clear();
      renderer.render(sky, skyCamera);

      stars.setGlow(false, glowRadius, glowGain);
      shootingStar.setGlow(false);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(sky, skyCamera);
      if (stardust.mesh.visible) renderer.render(front, skyCamera);
      renderer.render(cardScene, camera);
    },
    sample(x, y, w, h) {
      const gl = renderer.getContext();
      const scale = cardUniforms.uDraw.value.x / viewport.w;
      const sw = Math.max(1, Math.round(w * scale));
      const sh = Math.max(1, Math.round(h * scale));
      const pixels = new Uint8Array(sw * sh * 4);
      // WebGL rows start at the bottom
      gl.readPixels(Math.round(x * scale), Math.round((viewport.h - y - h) * scale), sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let sum = 0;
      let max = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sum += pixels[i];
        if (pixels[i] > max) max = pixels[i];
      }
      return { mean: sum / (pixels.length / 4) / 255, max: max / 255 };
    },
  };
}
