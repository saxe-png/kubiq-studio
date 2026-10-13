import * as THREE from 'three';
import fragmentShader from './shaders/card.frag.glsl?raw';
import vertexShader from './shaders/card.vert.glsl?raw';

/** Margin of each quad around its card, so the edge is antialiased inside the quad. */
export const CARD_PAD = 6;

/** Values every card shares; updating one of these updates all cards. */
export interface SharedCardUniforms {
  tGlow: { value: THREE.Texture | null };
  uDraw: { value: THREE.Vector2 };
  uGlass: { value: number };
  uRadius: { value: number };
  uTime: { value: number };
  uPresence: { value: number };
}

export function createSharedCardUniforms(): SharedCardUniforms {
  return {
    tGlow: { value: null },
    uDraw: { value: new THREE.Vector2(1, 1) },
    uGlass: { value: 1 },
    uRadius: { value: 4 },
    uTime: { value: 0 },
    uPresence: { value: 0 },
  };
}

export interface CardMesh {
  mesh: THREE.Mesh;
  setSize(w: number, h: number): void;
  setImage(texture: THREE.Texture, aspect: number): void;
  /** Frame of the image inside the card, px from its top-left corner. */
  setImageRect(x: number, y: number, w: number, h: number): void;
  setPointer(x: number, y: number, hover: number): void;
  setImageShift(x: number, y: number): void;
  setOpacity(value: number): void;
}

const plane = new THREE.PlaneGeometry(1, 1);
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blank.needsUpdate = true;

export function createCardMesh(shared: SharedCardUniforms): CardMesh {
  const uniforms = {
    ...shared,
    uSize: { value: new THREE.Vector2(1, 1) },
    uPad: { value: CARD_PAD },
    uOpacity: { value: 0 },
    uPointer: { value: new THREE.Vector2(9999, 9999) },
    uHover: { value: 0 },
    tImage: { value: blank as THREE.Texture },
    uHasImage: { value: 0 },
    uImageRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uImageAspect: { value: 1 },
    uImageShift: { value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    // the shader outputs colour already multiplied by alpha
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(plane, material);
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    mesh,
    setSize(w, h) {
      uniforms.uSize.value.set(w, h);
      mesh.scale.set(w + CARD_PAD * 2, h + CARD_PAD * 2, 1);
    },
    setImage(texture, aspect) {
      uniforms.tImage.value = texture;
      uniforms.uImageAspect.value = aspect;
      uniforms.uHasImage.value = 1;
    },
    setImageRect(x, y, w, h) {
      uniforms.uImageRect.value.set(x, y, Math.max(1, w), Math.max(1, h));
    },
    setPointer(x, y, hover) {
      uniforms.uPointer.value.set(x, y);
      uniforms.uHover.value = hover;
    },
    setImageShift(x, y) {
      uniforms.uImageShift.value.set(x, y);
    },
    setOpacity(value) {
      uniforms.uOpacity.value = value;
    },
  };
}

/**
 * Loads an image as a texture. Vector images are drawn onto a canvas first, because browsers
 * disagree about the size of an SVG handed straight to WebGL.
 */
export function loadCardTexture(image: HTMLImageElement, maxAnisotropy: number): { texture: THREE.Texture; aspect: number } {
  const aspect = image.naturalWidth / image.naturalHeight || 4 / 3;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 / aspect);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  // pixel values are used as they are; the shader works in display values
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  return { texture, aspect };
}
