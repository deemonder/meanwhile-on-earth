// Everything around the planet: twinkling stars, the band of the Milky Way,
// the Sun, and a bright marker for the star the observer is watching from.
//
// The star field is decorative (no catalogue), but the Sun and the observer's
// star sit in their true directions as seen from Earth at that moment.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Points, ShaderMaterial, Sprite,
  SpriteMaterial, SRGBColorSpace, Vector3,
} from 'three';

const FAR = 20000; // inside globe.gl's far plane, well beyond the camera's reach

// The camera rides with the planet, so the stars wheel slowly around Earth's
// axis behind it. Far faster than the real fifteen degrees an hour, and far
// slower than the centuries on the slider: just enough to feel time passing.
const SKY_TURN = (0.6 * Math.PI) / 180; // radians per second

// Seeded, so the sky is the same on every visit.
function randomSource(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rough star colours, from hot blue-white to cool orange.
const TINTS = ['#9db4ff', '#bcd0ff', '#ffffff', '#fff4e0', '#ffd9a0', '#ffb07a'].map((hex) => new Color(hex));

function buildStars(random) {
  const positions = [];
  const colours = [];
  const sizes = [];
  const phases = [];

  // The galactic plane, tilted like the real Milky Way is against Earth's equator.
  const pole = new Vector3(-0.87, 0.45, -0.2).normalize();
  const inPlaneA = new Vector3().crossVectors(pole, new Vector3(0, 1, 0)).normalize();
  const inPlaneB = new Vector3().crossVectors(pole, inPlaneA);

  const add = (direction, size, tint, brightness) => {
    positions.push(direction.x * FAR, direction.y * FAR, direction.z * FAR);
    colours.push(tint.r * brightness, tint.g * brightness, tint.b * brightness);
    sizes.push(size);
    phases.push(random() * 6.283);
  };

  const anywhere = () => {
    const z = random() * 2 - 1;
    const angle = random() * 6.283;
    const r = Math.sqrt(1 - z * z);
    return new Vector3(r * Math.cos(angle), z, r * Math.sin(angle));
  };

  const nearThePlane = (spread) => {
    const angle = random() * 6.283;
    // Sum of uniforms: a cheap bell curve around the plane.
    const off = (random() + random() + random() - 1.5) * spread;
    return inPlaneA.clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(inPlaneB, Math.sin(angle))
      .addScaledVector(pole, off)
      .normalize();
  };

  // A few bright stars, many faint ones.
  for (let i = 0; i < 7000; i++) {
    const rank = random() ** 6;
    add(anywhere(), 1.5 + rank * 7, TINTS[Math.floor(random() * TINTS.length)], 0.6 + rank * 1.1);
  }
  // The Milky Way: a dense dusting of small stars…
  for (let i = 0; i < 9000; i++) {
    add(nearThePlane(0.22), 1 + random() * 1.3, TINTS[1 + Math.floor(random() * 4)], 0.3 + random() * 0.35);
  }
  // …over large, very faint blobs that merge into a glowing band.
  const haze = ['#5a6cff', '#8a5cff', '#ff9d6c', '#6fb7ff'].map((hex) => new Color(hex));
  for (let i = 0; i < 420; i++) {
    add(nearThePlane(0.13), 70 + random() * 150, haze[Math.floor(random() * haze.length)], 0.028 + random() * 0.03);
  }
  // A few distant nebulae elsewhere, so no part of the sky is plain black.
  for (let i = 0; i < 14; i++) {
    const centre = anywhere();
    const tint = haze[Math.floor(random() * haze.length)];
    for (let j = 0; j < 9; j++) {
      const near = centre.clone().add(anywhere().multiplyScalar(0.16)).normalize();
      add(near, 160 + random() * 200, tint, 0.022 + random() * 0.02);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aColour', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(sizes), 1));
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1));
  return geometry;
}

const starMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute vec3 aColour;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColour;

      void main() {
        // Small stars twinkle; the big haze blobs must not.
        float twinkle = 1.0 + 0.32 * sin(uTime * (0.7 + fract(aPhase) * 1.6) + aPhase) * step(aSize, 20.0);
        vColour = aColour * twinkle;
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;

      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float falloff = pow(max(1.0 - d, 0.0), 1.8);
        gl_FragColor = vec4(vColour * falloff, 1.0);
        #include <colorspace_fragment>
      }
    `,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

function glowTexture(draw, width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function drawSun(ctx, w, h) {
  const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.06, 'rgba(255, 250, 225, 1)');
  glow.addColorStop(0.14, 'rgba(255, 214, 140, 0.55)');
  glow.addColorStop(0.4, 'rgba(255, 150, 70, 0.12)');
  glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// A four-pointed star with its name underneath.
function drawBeacon(ctx, w, h, name) {
  const cx = w / 2;
  const cy = h * 0.36;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.34);
  halo.addColorStop(0, 'rgba(255, 255, 255, 1)');
  halo.addColorStop(0.12, 'rgba(255, 232, 170, 0.9)');
  halo.addColorStop(0.45, 'rgba(255, 200, 90, 0.16)');
  halo.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h * 0.72);

  ctx.strokeStyle = 'rgba(255, 244, 214, 0.9)';
  ctx.lineCap = 'round';
  for (const [dx, dy, length, width] of [[1, 0, 0.3, 3], [0, 1, 0.3, 3], [0.7, 0.7, 0.12, 1.5], [0.7, -0.7, 0.12, 1.5]]) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx - dx * h * length, cy - dy * h * length);
    ctx.lineTo(cx + dx * h * length, cy + dy * h * length);
    ctx.stroke();
  }

  ctx.font = '600 44px Inter, "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(3, 5, 12, 0.9)';
  ctx.strokeText(name, cx, h * 0.86);
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(name, cx, h * 0.86);
}

const ignorePointer = (object) => {
  object.raycast = () => {};
  return object;
};

export function createSky(scene) {
  const stars = ignorePointer(new Points(buildStars(randomSource(20261110)), starMaterial()));
  stars.frustumCulled = false;
  scene.add(stars);

  const sun = ignorePointer(
    new Sprite(new SpriteMaterial({ map: glowTexture(drawSun), blending: AdditiveBlending, depthWrite: false })),
  );
  sun.scale.setScalar(FAR * 0.42);
  scene.add(sun);

  const beacon = ignorePointer(
    new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false })),
  );
  beacon.scale.set(0.36, 0.18, 1);
  beacon.visible = false;
  scene.add(beacon);
  let beaconName = null;

  return {
    tick(dt) {
      this.setTime(stars.material.uniforms.uTime.value + dt);
    },

    /** Sets the animation clock: how far the stars have twinkled and turned. */
    setTime(seconds) {
      stars.material.uniforms.uTime.value = seconds;
      stars.rotation.y = -seconds * SKY_TURN; // westward, like the real sky
    },

    /** Hides the stars for the time before there were any. */
    setStars(visible) {
      stars.visible = visible;
    },

    /** @param {Vector3} direction unit vector towards the Sun */
    setSun(direction, visible = true) {
      sun.position.copy(direction).multiplyScalar(FAR * 0.8);
      sun.visible = visible;
    },

    /** Shows the observer's star in the sky, or hides it when `direction` is null. */
    setBeacon(direction, name) {
      beacon.visible = Boolean(direction);
      if (!direction) return;
      beacon.position.copy(direction).multiplyScalar(FAR * 0.7);
      if (name !== beaconName) {
        beaconName = name;
        beacon.material.map?.dispose();
        beacon.material.map = glowTexture((ctx, w, h) => drawBeacon(ctx, w, h, name), 512, 256);
        beacon.material.needsUpdate = true;
      }
    },
  };
}
