// Places an observer could be watching from.
//
// `ly` is the light-travel time in years. `ra`/`dec` are J2000 coordinates in
// degrees and say which side of Earth faces the observer; objects that wander
// across our sky (the Moon) have none. For galaxies and quasars "distance" is
// ambiguous in an expanding universe: here it always means how long the light
// has been travelling.

const SECOND = 1 / (365.25 * 86400);
const DAY = 1 / 365.25;

export const PLACES = [
  { id: 'moon', group: 'solar', icon: '🌙', ly: 1.282 * SECOND, it: 'Luna', en: 'The Moon' },
  { id: 'sun', group: 'solar', icon: '☀️', ly: 499 * SECOND, sun: true, it: 'Sole', en: 'The Sun' },
  { id: 'voyager1', group: 'solar', icon: '🛰️', ly: 1 * DAY, ra: 258.3, dec: 12.0, it: 'Sonda Voyager 1', en: 'Voyager 1 probe' },

  { id: 'proxima', group: 'stars', icon: '⭐', ly: 4.2465, ra: 217.429, dec: -62.68, it: 'Proxima Centauri', en: 'Proxima Centauri' },
  { id: 'sirius', group: 'stars', icon: '⭐', ly: 8.6, ra: 101.287, dec: -16.716, it: 'Sirio', en: 'Sirius' },
  { id: 'vega', group: 'stars', icon: '⭐', ly: 25.04, ra: 279.235, dec: 38.784, it: 'Vega', en: 'Vega' },
  { id: 'trappist1', group: 'stars', icon: '⭐', ly: 40.66, ra: 346.622, dec: -5.041, it: 'TRAPPIST-1 (sette pianeti rocciosi)', en: 'TRAPPIST-1 (seven rocky planets)' },
  { id: 'polaris', group: 'stars', icon: '⭐', ly: 433, ra: 37.955, dec: 89.264, it: 'Stella Polare', en: 'Polaris' },
  { id: 'pleiades', group: 'stars', icon: '✨', ly: 444, ra: 56.75, dec: 24.117, it: 'Pleiadi', en: 'The Pleiades' },
  { id: 'betelgeuse', group: 'stars', icon: '⭐', ly: 548, ra: 88.793, dec: 7.407, it: 'Betelgeuse', en: 'Betelgeuse' },
  { id: 'rigel', group: 'stars', icon: '⭐', ly: 860, ra: 78.634, dec: -8.202, it: 'Rigel', en: 'Rigel' },
  { id: 'orion', group: 'stars', icon: '✨', ly: 1344, ra: 83.822, dec: -5.391, it: 'Nebulosa di Orione', en: 'Orion Nebula' },
  { id: 'kepler452', group: 'stars', icon: '⭐', ly: 1800, ra: 296.004, dec: 44.278, it: 'Kepler-452 (un pianeta simile alla Terra)', en: 'Kepler-452 (an Earth-like planet)' },
  { id: 'deneb', group: 'stars', icon: '⭐', ly: 2600, ra: 310.358, dec: 45.28, it: 'Deneb', en: 'Deneb' },
  { id: 'crab', group: 'stars', icon: '✨', ly: 6500, ra: 83.633, dec: 22.015, it: 'Nebulosa del Granchio', en: 'Crab Nebula' },

  { id: 'sgra', group: 'galaxies', icon: '🌀', ly: 26670, ra: 266.417, dec: -29.008, it: 'Centro della Via Lattea', en: 'Centre of the Milky Way' },
  { id: 'lmc', group: 'galaxies', icon: '🌌', ly: 160000, ra: 80.894, dec: -69.756, it: 'Grande Nube di Magellano', en: 'Large Magellanic Cloud' },
  { id: 'andromeda', group: 'galaxies', icon: '🌌', ly: 2.537e6, ra: 10.685, dec: 41.269, it: 'Galassia di Andromeda', en: 'Andromeda Galaxy' },
  { id: 'm87', group: 'galaxies', icon: '🌌', ly: 53.5e6, ra: 187.706, dec: 12.391, it: 'Galassia M87', en: 'Galaxy M87' },
  { id: '3c273', group: 'galaxies', icon: '💫', ly: 2.0e9, ra: 187.278, dec: 2.052, it: 'Quasar 3C 273', en: 'Quasar 3C 273' },
];

export const GROUPS = {
  solar: { it: 'Sistema solare', en: 'Solar System' },
  stars: { it: 'Stelle e nebulose', en: 'Stars and nebulae' },
  galaxies: { it: 'Galassie e oltre', en: 'Galaxies and beyond' },
};

export const placeById = (id) => PLACES.find((p) => p.id === id) ?? null;

// Signposts under the slider, named after what you would be watching.
// As the slider gets shorter the `minor` ones are dropped first, then the `medium` ones.
export const SIGNPOSTS = [
  { ly: 1.282 * SECOND, it: 'Adesso', en: 'Now' },
  { ly: 4.2465, it: 'Proxima', en: 'Proxima', minor: true },
  { ly: 81, it: '1945', en: '1945' },
  { ly: 2000, it: 'Roma', en: 'Rome' },
  { ly: 21000, it: 'Era glaciale', en: 'Ice age', minor: true },
  { ly: 300000, it: 'Primi sapiens', en: 'First sapiens', medium: true },
  { ly: 100e6, it: 'Dinosauri', en: 'Dinosaurs' },
  { ly: 4.54e9, it: 'Nasce la Terra', en: 'Earth forms', minor: true },
];
