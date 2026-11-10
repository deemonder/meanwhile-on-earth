// The 3D scene: globe.gl provides the camera and the event dots; the planet,
// its clouds and atmosphere use our own shaders, and the sky is our own too.
import Globe from 'globe.gl';
import {
  AdditiveBlending, BackSide, CanvasTexture, Color, Mesh, RepeatWrapping, ShaderMaterial, SphereGeometry,
  SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import { paintMap } from '../data/borders.js';
import { LOOKS, atmosphere, clouds, surface } from './shader.js';
import { createSky } from './sky.js';

const RADIUS = 100; // globe.gl's planet radius, in scene units
const CLOUD_HEIGHT = 1.006;
const AIR_HEIGHT = 1.13;
const EASED = ['uBordersMix', 'uCityLights', 'uCloudCover', 'uIce', 'uPaleo', 'uSnowball', 'uArchean', 'uMolten'];

/**
 * @param {HTMLElement} container
 * @param {object} on
 * @param {(aim: {lat: number, lng: number}) => void} on.aim   the view centre moved
 * @param {() => void} on.grab                                 the user started dragging
 * @param {(event: object) => void} on.eventClick              an event dot was clicked
 */
export async function createEarth(container, on) {
  const folder = `${import.meta.env.BASE_URL}textures/`;
  const loader = new TextureLoader();
  const [day, night, water, relief, cloudMap] = await Promise.all(
    ['earth-day.jpg', 'earth-night.jpg', 'earth-water.png', 'earth-relief.png', 'earth-clouds.jpg'].map((file) =>
      loader.loadAsync(folder + file),
    ),
  );
  day.colorSpace = SRGBColorSpace;
  night.colorSpace = SRGBColorSpace;
  cloudMap.wrapS = RepeatWrapping; // the clouds drift around the planet

  const globe = new Globe(container, { animateIn: false });
  const renderer = globe.renderer();
  const scene = globe.scene();

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = Math.min(4096, renderer.capabilities.maxTextureSize);
  mapCanvas.height = mapCanvas.width / 2;
  const borders = new CanvasTexture(mapCanvas);
  borders.colorSpace = SRGBColorSpace;
  for (const texture of [day, night, cloudMap, borders]) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  // Uniform objects are shared between the three materials, so setting the
  // Sun or the cloud drift once updates all of them.
  const uniforms = {
    uDay: { value: day },
    uNight: { value: night },
    uWater: { value: water },
    uRelief: { value: relief },
    uClouds: { value: cloudMap },
    uBorders: { value: borders },
    uSun: { value: new Vector3(1, 0, 0) },
    uAir: { value: new Color(LOOKS.today.air) },
    uTint: { value: new Color(LOOKS.today.cloudTint) },
    uShell: { value: AIR_HEIGHT },
    uCloudShift: { value: 0 },
    uCloudCover: { value: 0.85 },
    uBordersMix: { value: 0 },
    uCityLights: { value: 1 },
    uIce: { value: 0 },
    uPaleo: { value: 0 },
    uSnowball: { value: 0 },
    uArchean: { value: 0 },
    uMolten: { value: 0 },
    uTime: { value: 0 },
  };
  const targets = Object.fromEntries(EASED.map((name) => [name, uniforms[name].value]));
  const targetAir = new Color(LOOKS.today.air);
  const targetTint = new Color(LOOKS.today.cloudTint);

  globe
    .backgroundColor('#03040b') // opaque: additive star glows need a solid backdrop
    .showAtmosphere(false) // replaced by our own, which follows the Sun
    .globeMaterial(new ShaderMaterial({ uniforms, ...surface }))
    // Events: flat coloured discs floating just above the clouds.
    .pointsData([])
    .pointLat((d) => d.event.lat)
    .pointLng((d) => d.event.lng)
    .pointAltitude(0.012)
    .pointRadius((d) => d.radius)
    .pointColor((d) => d.colour)
    .pointResolution(14)
    .pointsMerge(false)
    .pointsTransitionDuration(0)
    .pointLabel((d) => d.tooltip)
    .onPointClick((d) => on.eventClick(d.event))
    // Pulsing rings mark the spot that has the observer's star overhead.
    .ringsData([])
    .ringAltitude(0.013)
    .ringColor(() => (t) => `rgba(255, 209, 102, ${1 - t})`)
    .ringMaxRadius(5)
    .ringPropagationSpeed(2.5)
    .ringRepeatPeriod(900)
    .onGlobeClick(({ lat, lng }) => {
      on.grab();
      globe.pointOfView({ lat, lng }, 700);
    })
    .onZoom(({ lat, lng }) => on.aim({ lat, lng }));

  const shell = (height, material) => {
    const mesh = new Mesh(new SphereGeometry(RADIUS * height, 96, 64), material);
    mesh.rotation.y = -Math.PI / 2; // same orientation as globe.gl's planet
    mesh.raycast = () => {}; // clicks go through to the planet
    scene.add(mesh);
    return mesh;
  };
  const cloudShell = shell(
    CLOUD_HEIGHT,
    new ShaderMaterial({ uniforms, ...clouds, transparent: true, depthWrite: false }),
  );
  const airShell = shell(
    AIR_HEIGHT,
    new ShaderMaterial({ uniforms, ...atmosphere, side: BackSide, blending: AdditiveBlending, transparent: true, depthWrite: false }),
  );

  const sky = createSky(scene);

  const controls = globe.controls();
  controls.minDistance = 125;
  controls.maxDistance = 560;
  controls.rotateSpeed = 0.6;
  controls.addEventListener('start', () => on.grab());

  // The controls cover the top and bottom of the stage, so the planet is
  // drawn in the middle of the free space between them, not of the canvas.
  const camera = globe.camera();
  let margins = { top: 0, bottom: 0 };
  const layOut = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    // Negative y moves the planet up. (Setting the camera view offset directly
    // does not work: globe.gl owns it and resets it.)
    globe.width(width).height(height).globeOffset([0, (margins.top - margins.bottom) / 2]);
  };
  new ResizeObserver(layOut).observe(container);

  // Ease towards the targets so eras melt into each other; drift the clouds.
  let last = performance.now();
  (function animate(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += dt;
    uniforms.uCloudShift.value = (uniforms.uCloudShift.value + dt * 0.0006) % 1;
    const blend = 1 - Math.exp(-dt * 5);
    for (const name of EASED) uniforms[name].value += (targets[name] - uniforms[name].value) * blend;
    uniforms.uAir.value.lerp(targetAir, blend);
    uniforms.uTint.value.lerp(targetTint, blend);
    sky.tick(dt);
    requestAnimationFrame(animate);
  })(last);

  const direction = ({ lat, lng }) => {
    const { x, y, z } = globe.getCoords(lat, lng, 0);
    return new Vector3(x, y, z).normalize();
  };

  let look = LOOKS.today;
  let shownLook = 'today';
  let bordersWanted = true;
  let bordersLoaded = false;

  // Clouds thin out while the historical map is shown, so it stays readable.
  const applyLayers = () => {
    const mapOn = bordersWanted && bordersLoaded;
    targets.uBordersMix = mapOn ? 1 : 0;
    targets.uCloudCover = look.cover * (mapOn ? 0.4 : 0.9);
  };

  return {
    /** Tells the scene how many pixels the controls cover at the top and bottom. */
    setMargins(top, bottom) {
      margins = { top, bottom };
      layOut();
    },

    /** Camera altitude (in planet radii) at which the planet fills the free space. */
    fittingAltitude() {
      const height = container.clientHeight;
      const free = Math.min(container.clientWidth, height - margins.top - margins.bottom);
      const radiusOnScreen = Math.max(120, free * 0.46);
      const k = (radiusOnScreen * Math.tan((camera.fov * Math.PI) / 360)) / (height / 2);
      const altitude = 1 / Math.sin(Math.atan(k)) - 1;
      return Math.min(4.4, Math.max(0.6, altitude));
    },

    /** Points the camera so that (lat, lng) sits under the crosshair. */
    aim({ lat, lng }, ms = 0, altitude) {
      globe.pointOfView(altitude === undefined ? { lat, lng } : { lat, lng, altitude }, ms);
    },

    /** Sets the place where the Sun is overhead. */
    setSun(point) {
      uniforms.uSun.value.copy(direction(point));
      sky.setSun(uniforms.uSun.value, look.planet !== false);
    },

    /** Applies one of the looks from data/eras.js. */
    setLook(name, cityLights) {
      targets.uCityLights = cityLights;
      if (name === shownLook) return;
      shownLook = name;
      look = LOOKS[name] ?? LOOKS.today;
      for (const key of EASED) if (key in look) targets[key] = look[key];
      targetAir.set(look.air);
      targetTint.set(look.cloudTint);
      const exists = look.planet !== false;
      sky.setStars(look.stars !== false);
      globe.showGlobe(exists);
      cloudShell.visible = exists;
      airShell.visible = exists;
      applyLayers();
    },

    /** Loads a historical map onto the surface, or unloads it with null. */
    setBorders(territories) {
      bordersLoaded = Boolean(territories);
      if (territories) {
        paintMap(mapCanvas, territories);
        borders.needsUpdate = true;
      }
      applyLayers();
    },

    /** Shows or hides the loaded map without discarding it. */
    showBorders(visible) {
      bordersWanted = visible;
      applyLayers();
    },

    /** @param {{event: object, colour: string, radius: number, tooltip: string}[]} dots */
    setEvents(dots) {
      globe.pointsData(dots);
    },

    /**
     * Marks the observer's star: rings on the ground where it is overhead and
     * a named light in the sky in its direction. Pass null to clear both.
     */
    setObserver(point, name) {
      globe.ringsData(point ? [point] : []);
      sky.setBeacon(point ? direction(point) : null, name);
    },
  };
}
