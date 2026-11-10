// Meanwhile on Earth: what would an alien civilization N light-years away see on Earth right now?
//
// This file holds the application state and keeps the three parts of the page
// in step with it: the globe, the controls around it and the side panel.
import './style.css';
import {
  ROTATION_KNOWN_FOR, calendarFromJd, decimalYear, departureJd, jdFromUnix, sameHourDistance, separation,
  subObserverPoint, subsolarPoint,
} from './core/sky.js';
import { clampLy, lyFromSlider, sliderFromLy } from './core/scale.js';
import { loadMap, mapFor, territoryAt } from './data/borders.js';
import { DRIFT_AGES, OLDEST_KNOWN, driftAgeFor, loadContinents, onLand, polarIceEdge } from './data/continents.js';
import { cityLightsIn, eraAt, hasEarth } from './data/eras.js';
import { KINDS, eventsAround, loadEvents, mostFamous, nearest } from './data/events.js';
import { loadLandMask, surfaceAt } from './data/land.js';
import { PLACES, SIGNPOSTS, placeById } from './data/places.js';
import { introForArticle, introForTerritory } from './data/wikipedia.js';
import { createEarth } from './globe/earth.js';
import {
  distanceText, escapeHtml, eventTitle, headline, lang, number, setLanguage, shortDistance, t, yearText,
} from './i18n.js';
import { aimHtml, eraHtml, momentHtml, nearbyHtml, telescopeHtml, worldHtml } from './ui/panel.js';

const $ = (id) => document.getElementById(id);
const SLIDER_STEPS = 10000;
const MAX_DOTS = 500;
/** Wikidata has next to nothing dated before this many years ago. */
const RECORDED_HISTORY = 5500;

// A link can freeze the clock (?at=2026-11-10T10:30:00Z), so that pictures
// taken minutes apart show the same instant. Otherwise "now" is now.
const frozenNow = Date.parse(new URLSearchParams(location.search).get('at') ?? '');
const nowMs = () => (Number.isFinite(frozenNow) ? frozenNow : Date.now());

/** ?poster: only the planet and the headline, for screenshots and recordings. */
const POSTER = new URLSearchParams(location.search).has('poster');

// ───────── State ─────────

/** The starting view: 2,000 light-years away, looking at Rome. */
const state = {
  ly: 2000,
  place: null, // id of a real vantage point, or null for a hand-set distance
  aim: { lat: 41.9, lng: 12.5 },
  follow: false, // keep the camera where the chosen star sees Earth from
  borders: true,
  ...readHash(),
};

let earth = null;
let eventCount = 0;
let eventsNow = { ly: null, list: [] };
let map = { file: null, year: null, status: 'none', territories: null };
let mapBusy = false;
let drift = { age: null, status: 'none', rings: null, painted: null }; // reconstructed continents
let driftBusy = false;
let marked = null; // where the observer's star is currently drawn
let flightEnds = 0; // while the camera is flying somewhere, follow mode must not interrupt it
let journey = null; // { position } while the automatic trip is running
let eventsTried = false; // the events file has loaded, or failed to
let shownHash = location.hash; // the link the current state came from
const intros = new Map(); // key → Wikipedia introduction, or null while absent

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const parsed = {};
  const ly = Number(params.get('ly'));
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (params.has('ly') && ly > 0) parsed.ly = clampLy(ly);
  if (params.has('lat') && params.has('lng') && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) parsed.aim = { lat, lng };
  const place = placeById(params.get('from'));
  if (place) Object.assign(parsed, { place: place.id, ly: place.ly });
  const clock = Number(params.get('t'));
  if (params.has('t') && Number.isFinite(clock)) parsed.clock = clock;
  return parsed;
}

let hashTimer;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const params = new URLSearchParams({
      ly: Number(state.ly.toPrecision(6)),
      lat: state.aim.lat.toFixed(2),
      lng: state.aim.lng.toFixed(2),
    });
    if (state.place) params.set('from', state.place);
    history.replaceState(null, '', `#${params}`);
  }, 300);
}

const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(`meanwhile-on-earth.${key}`);
    localStorage.setItem(`meanwhile-on-earth.${key}`, value);
  } catch {
    // private browsing: nothing is remembered, nothing breaks
  }
  return null;
};

// ───────── The moment being watched ─────────

const canFollow = (place) =>
  Boolean(place) && (place.sun || place.ra !== undefined) && place.ly <= ROTATION_KNOWN_FOR;

const shortName = (place) => place[lang].replace(/\s*\(.*\)/, '');

/** Everything that follows from the distance alone. */
function computeView() {
  const age = state.ly;
  const jd = departureJd(age, jdFromUnix(nowMs()));
  const year = decimalYear(jd);
  const era = eraAt(age);
  const place = placeById(state.place);
  const rotationKnown = age <= ROTATION_KNOWN_FOR;

  // Too far back to know where noon was: light the side being looked at.
  const sun = rotationKnown ? subsolarPoint(jd) : { lat: 14, lng: ((state.aim.lng + 222) % 360) - 180 };
  let overhead = null;
  if (place && rotationKnown) {
    overhead = place.sun ? sun : place.ra !== undefined ? subObserverPoint(place, jd) : null;
  }

  return {
    age, jd, year, era, place, rotationKnown, sun, overhead,
    calendar: calendarFromJd(jd),
    cityLights: cityLightsIn(year),
    recorded: age <= RECORDED_HISTORY && eventCount > 0,
  };
}

// ───────── Rendering ─────────

const lastHtml = new Map();
function fill(id, html) {
  if (lastHtml.get(id) === html) return;
  lastHtml.set(id, html);
  $(id).innerHTML = html;
}

/** Returns a loaded introduction, or starts loading it and re-renders when it arrives. */
function introOnceLoaded(key, load) {
  if (!intros.has(key)) {
    intros.set(key, null);
    load().then((intro) => {
      if (!intro) return;
      intros.set(key, intro);
      requestRender();
    });
  }
  return intros.get(key);
}

let settleTimer;
let settledTerritory = null;
/** Only look a territory up once the crosshair has rested on it for a moment. */
function territoryIntro(territory) {
  if (!territory) return null;
  const key = `territory|${lang}|${territory.name}`;
  if (intros.has(key)) return intros.get(key);
  if (settledTerritory !== key) {
    settledTerritory = key;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      introOnceLoaded(key, () => introForTerritory(territory.name, lang));
    }, 450);
  }
  return null;
}

function updateEvents(view) {
  if (eventsNow.ly === state.ly) return;
  const list = view.recorded ? eventsAround(view.year, view.age) : [];
  eventsNow = { ly: state.ly, list };
  const dots = mostFamous(list, { limit: MAX_DOTS }).map((event) => ({
    event,
    colour: KINDS[event.kind].colour,
    radius: 0.32 + 0.5 * Math.min(1, event.links / 120),
    tooltip: `<div class="event-tip"><b>${escapeHtml(eventTitle(event))}</b><br /><small>${KINDS[event.kind][lang]} · ${yearText(event.year)}</small></div>`,
  }));
  earth.setEvents(dots);
}

/**
 * Keeps the historical map in step with the year. Only one map downloads at a
 * time; when it lands, whatever map is wanted by then goes next, so dragging
 * the slider across fifty centuries does not start fifty downloads.
 */
function updateMap(view) {
  const wanted = hasEarth(view.era.look) ? mapFor(Math.round(view.year)) : null;
  if ((wanted?.file ?? null) === map.file) return;
  if (!wanted) {
    map = { file: null, year: null, status: 'none', territories: null };
    earth.setBorders(null);
    return;
  }
  map = { file: wanted.file, year: wanted.year, status: 'loading', territories: null };
  fetchMap();
}

async function fetchMap() {
  if (mapBusy) return;
  mapBusy = true;
  const asked = { file: map.file, year: map.year };
  try {
    const territories = await loadMap(asked);
    if (map.file === asked.file) {
      map = { ...map, status: 'ready', territories };
      earth.setBorders(territories);
    }
  } catch {
    if (map.file === asked.file) {
      map = { ...map, status: 'failed' };
      earth.setBorders(null);
    }
  }
  mapBusy = false;
  if (map.status === 'loading') fetchMap(); // the year moved on meanwhile
  requestRender();
}

/** Looks in which the continents are drawn where the plate model puts them. */
const DRIFT_LOOKS = new Set(['paleo', 'snowball', 'archean']);

/** Keeps the continents in step with the age, the same way updateMap does for borders. */
function updateDrift(view) {
  const wanted = DRIFT_LOOKS.has(view.era.look) ? driftAgeFor(view.age) : null;
  if (wanted === null) {
    if (drift.age !== null) {
      drift = { age: null, status: 'none', rings: null, painted: null };
      earth.setContinents(null);
    }
    return;
  }
  if (wanted !== drift.age) {
    drift = { age: wanted, status: 'loading', rings: null, painted: null };
    fetchDrift();
    return;
  }
  if (drift.status !== 'ready') return;
  // The same outlines can need repainting: polar ice comes and goes with the exact age.
  const iceEdge = polarIceEdge(view.age);
  const painted = `${drift.age}|${iceEdge}`;
  if (drift.painted === painted) return;
  drift.painted = painted;
  earth.setContinents(drift.rings, iceEdge);
}

async function fetchDrift() {
  if (driftBusy) return;
  driftBusy = true;
  const asked = drift.age;
  try {
    const rings = await loadContinents(asked);
    if (drift.age === asked) drift = { ...drift, status: 'ready', rings };
    // Fetch the neighbouring ages ahead of time, so dragging the slider
    // flips through them without waiting.
    const at = DRIFT_AGES.indexOf(asked);
    for (const near of DRIFT_AGES.slice(Math.max(0, at - 2), at + 5)) loadContinents(near).catch(() => {});
  } catch {
    if (drift.age === asked) drift = { ...drift, status: 'failed' };
  }
  driftBusy = false;
  if (drift.status === 'loading') fetchDrift(); // the age moved on meanwhile
  requestRender();
}

function renderHud(view) {
  const { big, details } = headline(view.calendar, view.age);
  $('hud-kicker').textContent = t('hudKicker', distanceText(view.age));
  $('hud-big').textContent = big;
  fill(
    'hud-details',
    details.map((d) => `<span>${escapeHtml(d)}</span>`).join('') +
      `<span class="chip">${escapeHtml(view.era[lang][0])}</span>`,
  );
}

function renderControls(view) {
  $('distance').textContent = distanceText(state.ly);
  if (document.activeElement !== $('slider') || journey) {
    $('slider').value = Math.round(sliderFromLy(state.ly) * SLIDER_STEPS);
  }
  if (document.activeElement !== $('ly')) $('ly').value = Number(state.ly.toPrecision(state.ly >= 1000 ? 7 : 4));

  for (const chip of $('chips').children) chip.setAttribute('aria-pressed', String(chip.dataset.id === state.place));

  const followable = canFollow(view.place);
  $('follow').hidden = !followable;
  if (followable) {
    $('follow').innerHTML = `<i></i>${escapeHtml(t('follow', shortName(view.place)))}`;
    $('follow').setAttribute('aria-pressed', String(state.follow));
  }
  $('borders').setAttribute('aria-pressed', String(state.borders));
  $('journey').textContent = journey ? `⏸ ${t('journeyStop')}` : `▶ ${t('journey')}`;
}

function render() {
  const view = computeView();
  const absent = !hasEarth(view.era.look);

  // Globe
  earth.setLook(view.era.look, view.cityLights);
  earth.setSun(view.sun);
  earth.showBorders(state.borders);
  updateEvents(view);
  updateMap(view);
  updateDrift(view);
  const star = view.overhead && !view.place.sun ? view.overhead : null;
  if (!star) {
    if (marked) earth.setObserver((marked = null));
  } else if (!marked || marked.id !== view.place.id || separation(marked, star) > 0.5) {
    marked = { ...star, id: view.place.id };
    earth.setObserver(star, shortName(view.place));
  }

  // What floats over the globe
  const territory = map.status === 'ready' ? territoryAt(map.territories, state.aim) : null;
  $('absent').hidden = !absent;
  $('absent').dataset.look = view.era.look;
  $('absent-text').textContent = view.era[lang][0];
  $('crosshair').style.opacity = absent ? 0 : 1;
  // Where the map names nobody, say whether that is water or unclaimed land.
  const surface = territory ? null : surfaceAt(state.aim);
  const unnamed = surface === 'sea' ? t('sea') : surface === 'land' ? t('unclaimed') : '';
  // In deep time there are no borders, only land and ocean where they were then.
  const ground = drift.status === 'ready' ? (onLand(drift.rings, state.aim) ? 'dryLand' : 'ocean') : null;
  const driftInfo = ground && { ground, age: drift.age, known: view.age <= OLDEST_KNOWN };
  $('aim-label').textContent = driftInfo
    ? t(ground)
    : map.status !== 'ready' || !state.borders ? '' : territory ? territory.name : unnamed;
  renderHud(view);
  renderControls(view);

  // Panel
  const hits = nearest(eventsNow.list, state.aim);
  const famous = mostFamous(eventsNow.list, { except: new Set(hits.map((hit) => hit.event.id)) });
  const eraIntro = introOnceLoaded(`era|${lang}|${view.era.wiki.en}`, () => introForArticle(view.era.wiki, lang));

  fill('moment', momentHtml(view));
  fill('aim', aimHtml(view, state.aim, { ...map, territory, surface, drift: driftInfo }, territoryIntro(territory)));
  fill('nearby', absent ? '' : nearbyHtml(view, hits));
  fill('world', absent ? '' : worldHtml(view, famous));
  fill('era', eraHtml(view, eraIntro));
  fill('telescope', telescopeHtml(view));

  // For recorders: which link this picture answers, and whether it is complete
  // (data loaded, nothing still easing into place).
  const settled =
    map.status !== 'loading' && drift.status !== 'loading' && eventsTried && earth.isSettled();
  Object.assign(document.documentElement.dataset, { view: shownHash, settled: String(settled) });
  if (POSTER && !settled) requestRender();
}

let renderQueued = false;
function requestRender() {
  if (renderQueued || !earth) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// ───────── Actions ─────────

function fly(point, ms) {
  flightEnds = performance.now() + ms;
  earth.aim(point, ms);
}

function flyToOverhead(ms) {
  const { overhead } = computeView();
  if (overhead) fly(overhead, ms);
}

function setDistance(ly) {
  if (!Number.isFinite(ly) || ly <= 0) return;
  journey = null;
  Object.assign(state, { ly: clampLy(ly), place: null, follow: false });
  writeHash();
  requestRender();
}

function choosePlace(id) {
  const place = placeById(id);
  if (!place) return;
  journey = null;
  Object.assign(state, { ly: place.ly, place: place.id, follow: canFollow(place) });
  if (state.follow) flyToOverhead(1400);
  writeHash();
  requestRender();
}

function stopFollowing() {
  if (!state.follow) return;
  state.follow = false;
  requestRender();
}

/**
 * The automatic trip: drift away from Earth and watch history run backwards.
 * It lingers over recorded history and hurries through the empty aeons.
 */
function toggleJourney() {
  if (journey) {
    journey = null;
    requestRender();
    return;
  }
  const start = sliderFromLy(state.ly);
  journey = { position: start > 0.97 ? 0.12 : start };
  Object.assign(state, { place: null, follow: false });
  let last = performance.now();
  const trip = journey;
  (function step(now) {
    if (journey !== trip) return; // stopped, or the user took the controls
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const inHistory = trip.position > 0.3 && trip.position < 0.62;
    trip.position += dt / (inHistory ? 110 : 45);
    // Step through distances that keep the Sun in place, or day and night would flicker.
    state.ly = sameHourDistance(lyFromSlider(Math.min(1, trip.position)), jdFromUnix(nowMs()));
    if (trip.position >= 1) journey = null;
    writeHash();
    render();
    requestAnimationFrame(step);
  })(last);
}

function showGuide(visible) {
  $('guide').hidden = !visible;
  if (visible) $('guide-start').focus();
  else remember('guide', 'seen');
}

// ───────── Static interface ─────────

function buildInterface() {
  document.documentElement.lang = lang;
  document.title = `Meanwhile on Earth — ${t('tagline')}`;
  for (const node of document.querySelectorAll('[data-t]')) node.textContent = t(node.dataset.t);

  $('chips').innerHTML = PLACES.map(
    (p) => `
      <button type="button" data-id="${p.id}" aria-pressed="false" title="${escapeHtml(p[lang])}">
        <span class="icon">${p.icon}</span><b>${escapeHtml(shortName(p))}</b><small>${shortDistance(p.ly)}</small>
      </button>`,
  ).join('');

  $('signposts').innerHTML = SIGNPOSTS.map(
    (s) =>
      `<button type="button" data-ly="${s.ly}"${s.minor ? ' class="minor"' : s.medium ? ' class="medium"' : ''} style="--at:${sliderFromLy(s.ly)}">${escapeHtml(s[lang])}</button>`,
  ).join('');

  $('guide-title').textContent = t('guideTitle');
  $('guide-intro').textContent = t('guideIntro');
  $('guide-steps').innerHTML = t('guideSteps')
    .map(([icon, title, text]) => `<li><span>${icon}</span><b>${escapeHtml(title)}</b>${escapeHtml(text)}</li>`)
    .join('');
  $('guide-start').textContent = t('guideStart');
  $('help').title = t('help');
  $('help').setAttribute('aria-label', t('help'));

  $('share').textContent = t('share');
  $('language').textContent = lang === 'it' ? 'English' : 'Italiano';
  $('status').textContent = eventCount ? t('eventsLoaded', number(eventCount)) : '';
}

function listen() {
  $('slider').addEventListener('input', (e) => setDistance(lyFromSlider(e.target.value / SLIDER_STEPS)));
  $('ly').addEventListener('change', (e) => setDistance(Number(e.target.value)));
  $('signposts').addEventListener('click', (e) => {
    const ly = Number(e.target.dataset?.ly);
    if (ly) setDistance(ly);
  });
  $('chips').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-id]');
    if (chip) choosePlace(chip.dataset.id);
  });
  $('follow').addEventListener('click', () => {
    state.follow = !state.follow;
    if (state.follow) flyToOverhead(1000);
    requestRender();
  });
  $('borders').addEventListener('click', () => {
    state.borders = !state.borders;
    requestRender();
  });
  $('journey').addEventListener('click', toggleJourney);

  $('help').addEventListener('click', () => showGuide(true));
  $('guide-start').addEventListener('click', () => showGuide(false));
  $('guide').addEventListener('click', (e) => {
    if (e.target === $('guide')) showGuide(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('guide').hidden) showGuide(false);
  });

  // Clicking an event in the lists turns the globe to it.
  $('scroll').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-lat]');
    if (!button) return;
    stopFollowing();
    fly({ lat: Number(button.dataset.lat), lng: Number(button.dataset.lng) }, 900);
  });

  $('share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('share').textContent = t('copied');
    } catch {
      prompt(t('share'), location.href);
    }
    setTimeout(() => ($('share').textContent = t('share')), 1800);
  });

  // A link pasted into the address bar of an open page.
  addEventListener('hashchange', () => {
    const { clock, ...next } = readHash();
    journey = null;
    shownHash = location.hash;
    Object.assign(state, { place: null, ...next, follow: false });
    if (clock !== undefined) earth.setClock(clock);
    if (next.aim) fly(next.aim, POSTER ? 0 : 800); // a poster shows the place at once
    requestRender();
  });

  $('language').addEventListener('click', () => {
    setLanguage(lang === 'it' ? 'en' : 'it');
    eventsNow.ly = null; // tooltips are language-specific
    marked = null; // so is the name written next to the observer's star
    buildInterface();
    requestRender();
  });
}

// ───────── Start ─────────

async function start() {
  // ?poster shows only the planet and the headline: used for screenshots and
  // for the link-preview image.
  // ?poster=1200x630 fixes the size of the picture whatever the window is.
  const posterParam = new URLSearchParams(location.search).get('poster');
  const poster = POSTER;
  document.body.classList.toggle('poster', poster);
  if (new URLSearchParams(location.search).get('borders') === 'off') state.borders = false;
  const [posterWidth, posterHeight] = (posterParam ?? '').split('x').map(Number);
  if (posterWidth > 0 && posterHeight > 0) {
    Object.assign($('stage').style, { width: `${posterWidth}px`, height: `${posterHeight}px` });
  }
  buildInterface();
  listen();
  if (!poster && !remember('guide')) showGuide(true);

  const firstAim = state.aim;
  earth = await createEarth($('globe'), {
    aim(point) {
      if (!earth) return; // the globe reports its default view while it is being built
      state.aim = point;
      writeHash();
      requestRender();
    },
    grab: stopFollowing,
    eventClick(event) {
      stopFollowing();
      fly(event, 800);
    },
  });
  // Keep the planet and the crosshair centred in the space the controls leave free.
  const frame = () => {
    const stage = $('stage').getBoundingClientRect();
    if (poster) {
      $('stage').style.setProperty('--pw', `${stage.width / 100}px`);
      $('stage').style.setProperty('--ph', `${stage.height / 100}px`);
      // Text on the left, the planet filling the right-hand side.
      earth.setMargins({ left: stage.width * 0.4, top: stage.height * 0.04, bottom: stage.height * 0.04 });
      return;
    }
    const top = $('hud').getBoundingClientRect().bottom - stage.top;
    const bottom = stage.bottom - $('dock').getBoundingClientRect().top;
    earth.setMargins({ top, bottom });
    $('stage').style.setProperty('--lift', `${(bottom - top) / 2}px`);
  };
  frame();
  const watcher = new ResizeObserver(frame);
  for (const id of ['stage', 'dock', 'hud']) watcher.observe($(id));

  state.aim = firstAim;
  earth.aim(firstAim, 0, earth.fittingAltitude());

  // ?t=12.5 freezes the animation clock (clouds, stars) at that many seconds,
  // so a recording can step through it frame by frame.
  const clock = new URLSearchParams(location.search).get('t') ?? readHash().clock ?? null;
  if (clock !== null && Number.isFinite(Number(clock))) earth.setClock(Number(clock));

  state.follow = canFollow(placeById(state.place));
  if (state.follow) flyToOverhead(0);
  render();

  // Time keeps passing: the clock ticks, the terminator creeps, and in follow
  // mode the planet turns under the observer.
  setInterval(() => {
    if (state.follow && performance.now() > flightEnds) flyToOverhead(0);
    requestRender();
  }, 1000);

  loadLandMask().then(requestRender, () => {}); // without it the panel just stays vague

  try {
    eventCount = await loadEvents();
    $('status').textContent = t('eventsLoaded', number(eventCount));
    eventsNow.ly = null;
  } catch {
    // The globe, borders and eras still work without the events file.
  }
  eventsTried = true;
  requestRender();
}

start();
