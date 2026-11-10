// Is a point on land or on water?
//
// The historical maps only say who held a place. Where they say nothing, the
// point may be open sea or land that no known state claimed, and those are
// very different things to tell the user. The answer comes from the same
// land/water image the globe uses for its oceans.

const WIDTH = 720; // half a degree per pixel: thin rivers blur away, coasts stay
const HEIGHT = 360;

let pixels = null;

export function loadLandMask() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
      pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
      resolve();
    };
    image.onerror = reject;
    image.src = `${import.meta.env.BASE_URL}textures/earth-water.png`;
  });
}

/** 'sea', 'land', or null while the image is still loading. */
export function surfaceAt({ lat, lng }) {
  if (!pixels) return null;
  const x = Math.min(WIDTH - 1, Math.max(0, Math.floor(((lng + 180) / 360) * WIDTH)));
  const y = Math.min(HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * HEIGHT)));
  return pixels[(y * WIDTH + x) * 4] > 127 ? 'sea' : 'land'; // white = water
}
