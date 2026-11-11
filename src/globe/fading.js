// A picture wrapped around the globe that can change without a jump.
//
// There are two textures. One is on screen; the next picture is painted onto
// the other, which nobody can see, and then the shader fades from one to the
// other. So the slow part (uploading a freshly painted canvas to the graphics
// card) always happens off screen, never in the middle of a fade.
//
// The idea is dimKant's, from the r/threejs thread about this project.
import { CanvasTexture, SRGBColorSpace } from 'three';

const LONGEST_FADE = 0.45; // seconds
const SHORTEST_FADE = 0.06;

export function fadingLayer(width, height, anisotropy) {
  const canvases = [0, 1].map(() => Object.assign(document.createElement('canvas'), { width, height }));
  const textures = canvases.map((canvas) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return texture;
  });

  const fade = { value: 0 }; // shader uniform: 0 shows the first texture, 1 the second
  let shown = 0; // the texture the fade is heading for
  let empty = true;
  let duration = LONGEST_FADE;
  let lastChange = -Infinity;

  return {
    textures,
    fade,

    /** Paints the next picture with `paint(canvas)` and starts fading to it. */
    show(paint) {
      fade.value = shown; // finish any fade still under way
      const next = empty ? shown : 1 - shown; // the very first picture has nothing to fade from
      paint(canvases[next]);
      textures[next].needsUpdate = true;

      // When pictures arrive in quick succession (dragging the slider, the
      // journey), each fade lasts just as long as the gap between them, so
      // they run together into one continuous change.
      const now = performance.now() / 1000;
      duration = Math.min(LONGEST_FADE, Math.max(SHORTEST_FADE, (now - lastChange) * 0.9));
      lastChange = now;
      shown = next;
      empty = false;
    },

    /** Forgets the current picture: the next one appears without a fade. */
    clear() {
      empty = true;
    },

    /** Advances the fade by `dt` seconds, or completes it when `instantly` is set. */
    step(dt, instantly) {
      const gap = shown - fade.value;
      fade.value = instantly ? shown : fade.value + Math.sign(gap) * Math.min(Math.abs(gap), dt / duration);
    },

    get settled() {
      return fade.value === shown;
    },
  };
}
