// How the planet is painted: three shaders stacked like the real thing.
//
//   surface     land, sea, ice, city lights, historical borders
//   clouds      a thin shell just above, drifting slowly
//   atmosphere  a larger shell seen from behind, glowing at the limb
//
// The surface shader handles every era. It starts from today's Earth and
// blends towards ice sheets, a frozen, oxygen-free or molten planet as the
// uniforms say, then lights the result from where the Sun really was.

const worldVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosition = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const noise = /* glsl */ `
  // Value noise sampled on the sphere itself, so it has no seam.
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return sum;
  }
`;

// Warm light where the Sun is on the horizon: 1 at the terminator, 0 elsewhere.
const sunset = /* glsl */ `
  float sunsetBand(float facingSun) {
    return smoothstep(-0.14, 0.02, facingSun) * (1.0 - smoothstep(0.02, 0.32, facingSun));
  }
`;

export const surface = {
  vertexShader: worldVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform sampler2D uWater;    // white = sea, black = land
    uniform sampler2D uRelief;   // height map
    uniform sampler2D uClouds;
    uniform sampler2D uBorders;  // historical map, drawn on a canvas
    uniform vec3 uSun;           // direction to the Sun, world space
    uniform vec3 uAir;           // colour of the atmosphere
    uniform float uCloudShift;
    uniform float uCloudCover;
    uniform float uBordersMix;
    uniform float uCityLights;
    uniform float uIce;          // 0 none … 1 Last Glacial Maximum
    uniform float uPaleo;        // continents were elsewhere: show ghosts
    uniform float uSnowball;
    uniform float uArchean;
    uniform float uMolten;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    ${noise}
    ${sunset}

    float bump(float x, float centre, float width) {
      float d = (x - centre) / width;
      return exp(-d * d);
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 toCamera = normalize(cameraPosition - vPosition);
      float lat = (vUv.y - 0.5) * 180.0;
      float lng = (vUv.x - 0.5) * 360.0;

      vec3 ground = texture2D(uDay, vUv).rgb;
      float water = texture2D(uWater, vUv).r;
      float grain = fbm(n * 6.0);

      // Mountains: tilt the surface normal along the slope of the height map,
      // so ranges cast shading that moves with the Sun.
      vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
      float slopeEast = texture2D(uRelief, vUv + vec2(texel.x, 0.0)).r - texture2D(uRelief, vUv - vec2(texel.x, 0.0)).r;
      float slopeNorth = texture2D(uRelief, vUv + vec2(0.0, texel.y)).r - texture2D(uRelief, vUv - vec2(0.0, texel.y)).r;
      vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4, 0.0, 0.0));
      vec3 north = cross(n, east);
      float reliefStrength = 7.0 * (1.0 - uSnowball) * (1.0 - uMolten);
      vec3 relief = normalize(n - reliefStrength * (slopeEast * east + slopeNorth * north));

      // Ice ages. The sheets reached furthest south over North America (~40°N)
      // and northern Europe (~50°N), while most of Siberia stayed ice-free.
      float iceEdge = 74.0 - uIce * (6.0 + 28.0 * bump(lng, -92.0, 38.0) + 20.0 * bump(lng, 18.0, 30.0));
      float roughLat = lat + (grain - 0.5) * 10.0;
      float landIce = smoothstep(iceEdge - 2.5, iceEdge + 2.5, roughLat);
      float seaIce = 0.7 * smoothstep(iceEdge + 12.0, iceEdge + 20.0, roughLat); // the sea freezes only further north
      float ice = step(0.001, uIce) * mix(landIce, seaIce, water);
      ground = mix(ground, vec3(0.92, 0.95, 1.0), ice);

      // Deep time: the continents were arranged differently, so today's fade
      // into the sea and remain only as a reference.
      vec3 ocean = vec3(0.02, 0.07, 0.2);
      ground = mix(ground, mix(ocean, ground, 0.3), uPaleo * (1.0 - water));

      // Snowball Earth: ice everywhere, crossed by darker fractures.
      vec3 snow = vec3(0.86, 0.91, 0.96) - 0.2 * smoothstep(0.52, 0.72, fbm(n * 14.0));
      ground = mix(ground, snow, uSnowball);

      // Before oxygen: iron-rich green seas, bare volcanic rock.
      vec3 greenSea = vec3(0.07, 0.25, 0.17) * (0.75 + 0.5 * grain);
      vec3 bareRock = vec3(0.3, 0.15, 0.09) * (0.6 + 0.8 * fbm(n * 20.0));
      ground = mix(ground, mix(bareRock, greenSea, water), uArchean);

      // Sunlight. Brightness follows the angle of the Sun over the (tilted)
      // ground, which darkens the limb and the terminator like a real sphere.
      float facingSun = dot(n, uSun);
      float lit = smoothstep(-0.12, 0.2, facingSun);
      float slope = clamp(mix(facingSun, dot(relief, uSun), 0.85 * (1.0 - water)), 0.0, 1.0);
      vec3 dayColour = ground * (0.16 + 1.1 * pow(slope, 0.75));

      // Clouds shade the ground beneath them, offset away from the Sun.
      vec2 towardsSun = vec2(dot(uSun, east), dot(uSun, north)) * 0.004;
      float cloudAbove = texture2D(uClouds, vec2(vUv.x + uCloudShift, vUv.y) + towardsSun).r;
      dayColour *= 1.0 - 0.5 * uCloudCover * smoothstep(0.1, 0.8, cloudAbove);

      // Low Sun turns everything amber.
      float dusk = sunsetBand(facingSun);
      dayColour *= mix(vec3(1.0), vec3(1.3, 0.78, 0.5), dusk * 0.7);

      vec3 cityGlow = texture2D(uNight, vUv).rgb * vec3(1.0, 0.84, 0.6);
      vec3 nightColour = ground * 0.012 + cityGlow * uCityLights * 1.9 * (1.0 - 0.6 * uCloudCover * cloudAbove);
      vec3 colour = mix(nightColour, dayColour, lit);

      // The Sun on open water: a tight glint inside a wide soft sheen.
      float alignment = max(dot(n, normalize(toCamera + uSun)), 0.0);
      float glint = pow(alignment, 260.0) * 1.3 + pow(alignment, 28.0) * 0.14;
      float openWater = water * (1.0 - ice) * (1.0 - uSnowball) * (1.0 - uMolten) * (1.0 - 0.8 * uCloudCover * cloudAbove);
      colour += vec3(1.0, 0.94, 0.82) * glint * openWater * lit;

      // Historical borders, dimmed but still readable on the night side.
      vec4 borders = texture2D(uBorders, vUv);
      colour = mix(colour, borders.rgb * (0.14 + 0.86 * lit), borders.a * uBordersMix);

      // Magma ocean: a dark crust split by glowing, slowly shifting cracks.
      float cracks = fbm(n * 5.0 + vec3(0.0, uTime * 0.02, 0.0));
      float veins = fbm(n * 16.0 - vec3(uTime * 0.015, 0.0, 0.0));
      vec3 crust = vec3(0.09, 0.03, 0.02) * (0.3 + lit);
      vec3 glow = vec3(1.0, 0.38, 0.06) * smoothstep(0.42, 0.66, cracks) * 1.4 + vec3(1.0, 0.75, 0.3) * smoothstep(0.62, 0.72, veins) * 0.5;
      colour = mix(colour, crust + glow, uMolten);

      // Air between the camera and the ground: thicker towards the limb.
      float grazing = pow(1.0 - max(dot(n, toCamera), 0.0), 3.2);
      colour += uAir * grazing * 0.75 * smoothstep(-0.25, 0.35, facingSun);

      gl_FragColor = vec4(colour, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

export const clouds = {
  vertexShader: worldVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D uClouds;
    uniform vec3 uSun;
    uniform vec3 uTint;
    uniform float uCloudShift;
    uniform float uCloudCover;

    varying vec2 vUv;
    varying vec3 vNormal;

    ${sunset}

    void main() {
      float density = texture2D(uClouds, vec2(vUv.x + uCloudShift, vUv.y)).r;
      float facingSun = dot(normalize(vNormal), uSun);
      float lit = smoothstep(-0.15, 0.25, facingSun);
      vec3 colour = uTint * (0.25 + 0.85 * clamp(facingSun, 0.0, 1.0) + 0.1);
      colour *= mix(vec3(1.0), vec3(1.35, 0.75, 0.48), sunsetBand(facingSun) * 0.85);
      // On the night side clouds are only a faint veil against the dark.
      float alpha = smoothstep(0.06, 0.8, density) * uCloudCover * mix(0.22, 1.0, lit);
      gl_FragColor = vec4(mix(vec3(0.02, 0.03, 0.06), colour, lit), alpha);
      #include <colorspace_fragment>
    }
  `,
};

export const atmosphere = {
  vertexShader: worldVertex,
  fragmentShader: /* glsl */ `
    uniform vec3 uSun;
    uniform vec3 uAir;
    uniform float uShell; // shell radius divided by the planet's

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      // This shell is drawn from behind. Looking past the planet's edge, the
      // glow is strongest right at the limb and fades to nothing outwards.
      vec3 n = normalize(vNormal);
      float depth = -dot(n, normalize(cameraPosition - vPosition));
      float limb = sqrt(1.0 - 1.0 / (uShell * uShell));
      float glow = pow(clamp(depth / limb, 0.0, 1.0), 4.0);

      float facingSun = dot(n, uSun);
      float daylight = smoothstep(-0.2, 0.55, facingSun);
      float dusk = smoothstep(-0.3, 0.05, facingSun) * (1.0 - smoothstep(0.05, 0.4, facingSun));
      vec3 colour = mix(uAir, vec3(1.0, 0.5, 0.25), dusk * 0.45);
      gl_FragColor = vec4(colour * glow * (0.03 + 0.95 * daylight), 1.0);
      #include <colorspace_fragment>
    }
  `,
};

// Settings for each look named in data/eras.js. `air` tints the atmosphere,
// `cloudTint` the clouds; `cover` is how much cloud there is.
export const LOOKS = {
  today: { uIce: 0, uPaleo: 0, uSnowball: 0, uArchean: 0, uMolten: 0, cover: 1, air: '#4d9bff', cloudTint: '#ffffff' },
  glacial: { uIce: 0.55, uPaleo: 0, uSnowball: 0, uArchean: 0, uMolten: 0, cover: 1, air: '#5ea6ff', cloudTint: '#ffffff' },
  peakIce: { uIce: 1, uPaleo: 0, uSnowball: 0, uArchean: 0, uMolten: 0, cover: 1, air: '#74b4ff', cloudTint: '#ffffff' },
  paleo: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 0, uMolten: 0, cover: 1, air: '#4d9bff', cloudTint: '#ffffff' },
  snowball: { uIce: 0, uPaleo: 1, uSnowball: 1, uArchean: 0, uMolten: 0, cover: 0.45, air: '#b9dcff', cloudTint: '#ffffff' },
  archean: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 1, uMolten: 0, cover: 0.9, air: '#e58a3c', cloudTint: '#ffd9a8' },
  molten: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 0, uMolten: 1, cover: 0.5, air: '#ff5a1f', cloudTint: '#5a4038' },
  // Before Earth: no planet is drawn. Before the Big Bang there are no stars either.
  forming: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 0, uMolten: 1, cover: 0, air: '#ff5a1f', cloudTint: '#5a4038', planet: false },
  cloud: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 0, uMolten: 1, cover: 0, air: '#ff5a1f', cloudTint: '#5a4038', planet: false },
  void: { uIce: 0, uPaleo: 1, uSnowball: 0, uArchean: 0, uMolten: 1, cover: 0, air: '#ff5a1f', cloudTint: '#5a4038', planet: false, stars: false },
};
