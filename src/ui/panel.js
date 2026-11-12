// The side panel: turns a computed view of the past into HTML, section by section.
import { mirrorNeeded, separation, visibilityOverADay, daylight } from '../core/sky.js';
import { hasEarth } from '../data/eras.js';
import { KINDS, articleUrl, toleranceFor } from '../data/events.js';
import {
  coordinatesText, distanceText, escapeHtml, eventTitle, lang, mirrorText, momentText, number, t, yearText,
} from '../i18n.js';

const GHOST_LOOKS = new Set(['paleo', 'snowball', 'archean']);

export function momentHtml(view) {
  const { age, calendar, era } = view;
  return `
    <p class="kicker">${t('headline', distanceText(age))} <b>${momentText(calendar, age)}</b></p>
    <p class="sub"><span class="chip">${escapeHtml(era[lang][0])}</span></p>`;
}

function introHtml(intro) {
  if (!intro) return '';
  const image = intro.image ? `<img src="${escapeHtml(intro.image)}" alt="" loading="lazy" />` : '';
  return `
    <div class="intro">${image}
      <p><span class="clamp">${escapeHtml(intro.text)}</span>
      <a href="${escapeHtml(intro.url)}" target="_blank" rel="noopener">${t('wikipedia')} ↗</a></p>
    </div>`;
}

function lightHtml(view, aim) {
  if (!view.rotationKnown) return `<p class="note">${t('lightingUnknown')}</p>`;
  const phase = daylight(aim, view.sun);
  const lights = view.cityLights;
  const text = phase !== 'night' ? t(phase) : t(lights === 0 ? 'nightDark' : lights < 0.3 ? 'nightDim' : 'nightLit');
  return `<p class="light ${phase}"><i></i>${text}</p>`;
}

function visibilityHtml(view, aim) {
  const { place, overhead } = view;
  if (!place || !overhead) return '';
  if (place.sun) return `<p class="note">${t('fromSun')}</p>`;
  const name = escapeHtml(place[lang]);
  const ever = visibilityOverADay(aim.lat, overhead.lat);
  const key = ever === 'never' ? 'neverSeen' : separation(aim, overhead) < 90 ? 'seenNow' : 'hiddenNow';
  return `<p class="note">${t(key, name)} ${t('overheadLegend', name)}</p>`;
}

/**
 * @param {object} view     the computed moment (see main.js)
 * @param {object} aim      { lat, lng } under the crosshair
 * @param {object} map      { status: 'none'|'loading'|'failed'|'ready', year, territory, surface, drift }
 *                          drift, in deep time: { ground: 'dryLand'|'ocean', age (My), known }
 *                          surface is 'sea', 'land' or null, and matters when there is no territory
 * @param {object|null} intro  Wikipedia introduction for the territory, when loaded
 */
export function aimHtml(view, aim, map, intro) {
  if (!hasEarth(view.era.look)) return '';
  let body = '';
  if (map.status === 'ready') {
    const territory = map.territory;
    body += territory
      ? `<p class="territory"><i class="swatch" style="background:hsl(${territory.hue} 75% 58%)"></i>${escapeHtml(territory.name)}</p>` +
        (territory.overlord ? `<p class="note">${t('subjectTo', escapeHtml(territory.overlord))}</p>` : '') +
        (territory.carriedFrom !== undefined
          ? `<p class="note">${t('carriedNote', yearText(territory.carriedFrom), yearText(map.year))}</p>`
          : '') +
        (territory.disputed ? `<p class="note">${t('disputedNote')}</p>` : '') +
        introHtml(intro)
      : map.surface === 'sea'
        ? `<p class="territory">${t('sea')}</p><p class="note">${t('seaNote')}</p>`
        : map.surface === 'land'
          ? `<p class="territory">${t('unclaimed')}</p><p class="note">${t('unclaimedNote')}</p>`
          : `<p>${t('openSea')}</p>`;
    body += `<p class="note">${t('mapOf', yearText(map.year))}</p>`;
  } else if (map.status === 'loading') {
    body += `<p class="note">${t('mapLoading')}</p>`;
  } else if (map.status === 'failed') {
    body += `<p class="note">${t('mapFailed')}</p>`;
  } else if (map.drift) {
    body += `<p class="territory">${t(map.drift.ground)}</p>`;
    body += `<p class="note">${map.drift.known ? t('driftNote', number(map.drift.age)) : t('driftUnknown')}</p>`;
  } else if (GHOST_LOOKS.has(view.era.look)) {
    body += `<p class="note">${t('ghostContinents')}</p>`;
  }
  return `
    <h2>${t('aimTitle')} <span>${coordinatesText(aim)}</span></h2>
    ${body}
    ${lightHtml(view, aim)}
    ${visibilityHtml(view, aim)}
`;
}

function eventRow(event, km) {
  const where = km === undefined ? '' : ` · ${number(Math.round(km / 10) * 10)} km`;
  return `
    <li>
      <i style="background:${KINDS[event.kind].colour}"></i>
      <button type="button" data-lat="${event.lat}" data-lng="${event.lng}">${escapeHtml(eventTitle(event))}</button>
      <a href="${articleUrl(event, lang)}" target="_blank" rel="noopener" aria-label="${t('wikipedia')}">↗</a>
      <small>${KINDS[event.kind][lang]} · ${yearText(event.year)}${where}</small>
    </li>`;
}

export function nearbyHtml(view, hits) {
  if (!view.recorded) return '';
  const window = t('window', Math.round(toleranceFor(view.age)));
  const list = hits.length
    ? `<ul class="events">${hits.map(({ event, km }) => eventRow(event, km)).join('')}</ul>`
    : `<p class="note">${t('noNearby')}</p>`;
  return `<h2>${t('nearbyTitle')} <span>${window}</span></h2>${list}`;
}

export function worldHtml(view, famous) {
  if (!famous.length) return '';
  return `<h2>${t('worldTitle')}</h2><ul class="events">${famous.map((event) => eventRow(event)).join('')}</ul>`;
}

export function eraHtml(view, intro) {
  const [name, text] = view.era[lang];
  const image = intro?.image ? `<img src="${escapeHtml(intro.image)}" alt="" loading="lazy" />` : '';
  const link = intro ? ` <a href="${escapeHtml(intro.url)}" target="_blank" rel="noopener">${t('wikipedia')} ↗</a>` : '';
  return `
    <h2>${t('eraTitle')}</h2>
    <p class="era-name">${escapeHtml(name)}</p>
    <div class="intro">${image}<p>${escapeHtml(text)}${link}</p></div>`;
}

export function telescopeHtml(view) {
  const { size, comparison } = mirrorText(mirrorNeeded(view.age));
  return `
    <h2>${t('telescopeTitle')}</h2>
    <p>${t('telescope', size, comparison)}</p>
    <p class="note">${t('telescopeNote')}</p>`;
}
