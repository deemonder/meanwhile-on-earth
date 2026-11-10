// Dated, located events from Wikidata (see scripts/build-events.mjs).
import { kmBetween } from '../core/sky.js';

export const KINDS = {
  battle: { colour: '#ff6b6b', it: 'Battaglia', en: 'Battle' },
  earthquake: { colour: '#d0a2ff', it: 'Terremoto', en: 'Earthquake' },
  eruption: { colour: '#ff9f43', it: 'Eruzione', en: 'Eruption' },
  disaster: { colour: '#f783ac', it: 'Disastro', en: 'Disaster' },
  treaty: { colour: '#ffe066', it: 'Trattato', en: 'Treaty' },
  monument: { colour: '#63e6be', it: 'Costruzione', en: 'Construction' },
  city: { colour: '#74c0fc', it: 'Città fondata', en: 'City founded' },
  university: { colour: '#a5d8ff', it: 'Università fondata', en: 'University founded' },
  birth: { colour: '#f8f9fa', it: 'Nascita', en: 'Birth' },
};

let events = [];

export async function loadEvents() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/events.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { kinds, rows } = await response.json();
  events = rows.map(([id, year, lat, lng, kind, links, en, it]) => ({
    id, year, lat, lng, kind: kinds[kind], links, en, it: it || en,
  }));
  return events.length;
}

/**
 * How many years either side of the moment still count as "now". Dates get
 * vaguer with age, and an observer would not notice a decade at this range.
 */
export const toleranceFor = (age) => Math.min(150, Math.max(1, age * 0.006));

/** Events whose year falls within the tolerance of a decimal year. */
export function eventsAround(year, age) {
  const tolerance = toleranceFor(age);
  return events.filter((e) => Math.abs(e.year + 0.5 - year) <= tolerance);
}

/** The closest events to a point, nearest first. */
export function nearest(list, point, { withinKm = 2500, limit = 7 } = {}) {
  return list
    .map((event) => ({ event, km: kmBetween(point, event) }))
    .filter((hit) => hit.km <= withinKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/** The best-known events, by number of Wikipedia language editions. */
export function mostFamous(list, { limit = 6, except = new Set() } = {}) {
  return list
    .filter((e) => !except.has(e.id))
    .sort((a, b) => b.links - a.links)
    .slice(0, limit);
}

/** Opens the article in the reader's language when there is one, else in English. */
export const articleUrl = (event, lang) =>
  `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${lang === 'it' ? 'itwiki,enwiki' : 'enwiki,itwiki'}/${event.id}`;
