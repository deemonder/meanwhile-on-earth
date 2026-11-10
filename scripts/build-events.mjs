// Builds public/data/events.json from Wikidata (CC0).
//
// A live Wikidata query from the browser takes tens of seconds, so the app
// ships a prebuilt snapshot instead. This script runs a set of small global
// queries (one per kind of event) and merges them into one compact file.
//
//   npm run build-events
//
// Years use astronomical numbering, as the SPARQL endpoint returns them:
// year 0 is 1 BC, year -479 is 480 BC.

import { mkdir, writeFile } from 'node:fs/promises';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'meanwhile-on-earth-data-builder/0.1 (educational open-source project)';
const THIS_YEAR = new Date().getUTCFullYear();
const OUT = new URL('../public/data/events.json', import.meta.url);

// Wikidata time precision: 7 = century, 8 = decade, 9 = year, 11 = day.
const dated = (prop, minPrecision) => `
  ?item p:${prop}/psv:${prop} [ wikibase:timeValue ?date ; wikibase:timePrecision ?prec ] .
  FILTER(?prec >= ${minPrecision})`;

const happened = `
  { ${dated('P585', 9)} } UNION { ${dated('P580', 9)} }`;

// Coordinates on the item itself, or on the place where it happened.
const located = `
  OPTIONAL { ?item wdt:P625 ?own }
  OPTIONAL { ?item wdt:P276/wdt:P625 ?atPlace }
  BIND(COALESCE(?own, ?atPlace) AS ?coord)
  FILTER(BOUND(?coord))`;

const JOBS = [
  { kind: 'battle', minLinks: 5, body: `?item wdt:P31/wdt:P279* wd:Q178561 . ${happened} ${located}` },
  { kind: 'earthquake', minLinks: 6, body: `?item wdt:P31/wdt:P279* wd:Q7944 . ${happened} ${located}` },
  { kind: 'eruption', minLinks: 2, body: `?item wdt:P31/wdt:P279* wd:Q7692360 . ${happened} ${located}` },
  { kind: 'disaster', minLinks: 15, body: `?item wdt:P31/wdt:P279* wd:Q3839081 . ${happened} ${located}` },
  { kind: 'treaty', minLinks: 10, body: `?item wdt:P31/wdt:P279* wd:Q131569 . ${happened} ${located}` },
  {
    kind: 'monument',
    minLinks: 10,
    body: `?item wdt:P1435 wd:Q9259 ; wdt:P625 ?coord . ${dated('P571', 8)}`,
  },
  {
    kind: 'city',
    minLinks: 50,
    body: `VALUES ?class { wd:Q515 wd:Q1549591 wd:Q5119 wd:Q174844 wd:Q1637706 wd:Q200250 }
           ?item wdt:P31 ?class ; wdt:P625 ?coord . ${dated('P571', 8)}`,
  },
  {
    kind: 'university',
    minLinks: 45,
    body: `?item wdt:P31/wdt:P279* wd:Q3918 ; wdt:P625 ?coord . ${dated('P571', 9)}`,
  },
];

// Births of very well-known people, placed at their birthplace. Scanning all
// humans at once times out, so the query is cut into birth-date slices; the
// bar is higher for recent centuries, where Wikidata knows far more people.
const BIRTH_SLICES = [
  [-4000, 0, 40], [0, 800, 40], [800, 1200, 45], [1200, 1400, 50], [1400, 1500, 55],
  [1500, 1600, 60], [1600, 1700, 65], [1700, 1750, 70], [1750, 1800, 75],
  [1800, 1830, 85], [1830, 1860, 90], [1860, 1880, 95], [1880, 1900, 100],
  [1900, 1915, 105], [1915, 1930, 110], [1930, 1945, 115], [1945, 1960, 120],
  [1960, 1975, 125], [1975, 1990, 130], [1990, 2010, 130],
];

const xsdYear = (y) => {
  const sign = y < 0 ? '-' : '';
  return `"${sign}${String(Math.abs(y)).padStart(4, '0')}-01-01T00:00:00Z"^^xsd:dateTime`;
};

for (const [from, to, minLinks] of BIRTH_SLICES) {
  JOBS.push({
    kind: 'birth',
    name: `birth ${from}…${to}`,
    minLinks,
    body: `?item wdt:P569 ?date . hint:Prior hint:rangeSafe true .
           FILTER(?date >= ${xsdYear(from)} && ?date < ${xsdYear(to)})
           ?item wdt:P31 wd:Q5 ; wdt:P19 ?birthplace .
           ?birthplace wdt:P625 ?coord .`,
  });
}

const sparql = ({ body, minLinks }) => `
SELECT ?item ?date ?coord ?links ?en ?it WHERE {
  ${body}
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?it . FILTER(LANG(?it) = "it") }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(query, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // A query that hits the 60 s server limit comes back as truncated JSON.
      return JSON.parse(await res.text()).results.bindings;
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(4000 * attempt);
    }
  }
}

function parseRow(row, kind) {
  const year = Number(/^(-?\d+)-/.exec(row.date?.value ?? '')?.[1]);
  const point = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(row.coord?.value ?? '');
  const en = row.en?.value ?? '';
  const it = row.it?.value ?? '';
  if (!Number.isFinite(year) || year > THIS_YEAR || !point || (!en && !it)) return null;
  const lng = Number(point[1]);
  const lat = Number(point[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    id: row.item.value.slice(row.item.value.lastIndexOf('/') + 1),
    year,
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    kind,
    links: Number(row.links.value),
    en,
    it: it === en ? '' : it, // saves space; the app falls back to English
  };
}

const events = new Map();
const failed = [];

for (const job of JOBS) {
  const name = job.name ?? job.kind;
  const started = Date.now();
  try {
    const rows = await run(sparql(job));
    let kept = 0;
    for (const row of rows) {
      const ev = parseRow(row, job.kind);
      if (!ev) continue;
      const seen = events.get(ev.id);
      // An item can match twice (two dates, two classes): keep its earliest date.
      if (seen && seen.year <= ev.year) continue;
      events.set(ev.id, ev);
      kept++;
    }
    console.log(`${name.padEnd(22)} ${String(kept).padStart(5)} events  ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    failed.push(name);
    console.log(`${name.padEnd(22)} FAILED (${err.message})`);
  }
  await sleep(1200); // stay well inside the public endpoint's limits
}

const KINDS = [...new Set(JOBS.map((j) => j.kind))];
const rows = [...events.values()]
  .sort((a, b) => a.year - b.year)
  .map((e) => [e.id, e.year, e.lat, e.lng, KINDS.indexOf(e.kind), e.links, e.en, e.it]);

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    source: 'Wikidata, CC0 — https://www.wikidata.org',
    built: new Date().toISOString().slice(0, 10),
    kinds: KINDS,
    columns: ['id', 'year', 'lat', 'lng', 'kind', 'links', 'en', 'it'],
    rows,
  }),
);

console.log(`\n${rows.length} events written to public/data/events.json`);
if (failed.length) console.log(`Skipped (endpoint timeout or error): ${failed.join(', ')}`);
