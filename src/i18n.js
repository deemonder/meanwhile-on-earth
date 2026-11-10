// Italian and English: interface text and number, date and distance formatting.

const TEXT = {
  it: {
    tagline: 'Se una civiltà aliena ci stesse osservando da lontano, cosa vedrebbe in questo momento?',
    distance: 'Quanto sei lontano dalla Terra?',
    lightYears: 'anni luce',
    hudKicker: 'Da quella distanza vedresti',
    now: 'Adesso',
    journey: 'Viaggio nel tempo',
    journeyStop: 'Ferma il viaggio',
    bordersToggle: 'Confini storici',
    placesLabel: 'Oppure mettiti in un luogo reale',
    follow: (place) => `Guarda da ${place}`,
    help: 'Come si usa',
    guideTitle: 'Guardare lontano è guardare indietro',
    guideIntro: 'La luce impiega tempo ad attraversare lo spazio. Chi ci osserva da lontano vede la Terra del passato.',
    guideSteps: [
      ['🔭', 'Allontanati', 'Sposta il cursore in basso: più sei lontano, più indietro nel tempo vedi.'],
      ['🌍', 'Punta un luogo', 'Trascina il globo. Il mirino al centro è il punto che stai osservando.'],
      ['⭐', 'Scegli una stella', 'Mettiti su una stella vera per vedere il lato della Terra rivolto verso di lei.'],
    ],
    guideStart: 'Inizia',
    shortLy: 'a.l.',
    shortMillion: ' mln',
    shortBillion: ' mld',
    headline: (distance) => `Da <b>${distance}</b> oggi vedresti la Terra com’era`,
    ago: (duration) => `${duration} fa`,
    live: 'quasi in diretta',
    aimTitle: 'Sotto il mirino',
    aimHelp: 'Trascina il globo, oppure clicca un punto, per cambiare il luogo osservato.',
    openSea: 'Mare aperto, o terre senza uno stato conosciuto',
    sea: 'Mare aperto',
    seaNote: 'Qui c’è solo acqua.',
    unclaimed: 'Nessuno stato conosciuto',
    unclaimedNote: 'È terraferma, ma la mappa storica non riporta qui nessuno stato o cultura per quel periodo. Non vuol dire che fosse disabitata.',
    subjectTo: (name) => `sotto il controllo di: ${name}`,
    mapOf: (year) => `Confini secondo la mappa storica del ${year}`,
    mapLoading: 'Carico la mappa storica…',
    mapFailed: 'Non riesco a caricare la mappa storica. Controlla la connessione.',
    ghostContinents: 'I continenti erano disposti diversamente: quelli di oggi sono disegnati in trasparenza solo come riferimento.',
    day: 'Qui è giorno',
    twilight: 'Qui è il crepuscolo',
    nightDark: 'Qui è notte, e non c’è luce elettrica: vedresti solo buio',
    nightDim: 'Qui è notte: vedresti appena le prime, deboli luci elettriche',
    nightLit: 'Qui è notte: vedresti le luci delle città',
    lightingUnknown: 'Così indietro nel tempo non si può sapere dove fosse giorno: l’illuminazione è indicativa.',
    seenNow: (place) => `Da ${place} questo punto è visibile in questo istante.`,
    hiddenNow: (place) => `Da ${place} questo punto ora è sul lato nascosto: tornerà visibile entro qualche ora, con la rotazione.`,
    neverSeen: (place) => `Da ${place} questo punto non si vede mai: resta sempre oltre l’orizzonte del pianeta.`,
    fromSun: 'Dal Sole si vede sempre e soltanto il lato illuminato.',
    overheadLegend: (place) => `Gli anelli gialli segnano il punto che ha ${place} allo zenit.`,
    nearbyTitle: 'Nei dintorni, in quel periodo',
    worldTitle: 'Nel resto del mondo',
    noNearby: 'Nessun evento registrato vicino a questo punto.',
    window: (years) => (years <= 1 ? 'nello stesso anno, o quasi' : `entro ${years} anni prima o dopo`),
    eraTitle: 'Epoca',
    wikipedia: 'Wikipedia',
    telescopeTitle: 'Con quale telescopio?',
    telescope: (size, comparison) =>
      `Per distinguere da lì qualcosa di 10 metri, come una casa o una nave, servirebbe uno specchio largo <b>${size}</b>: ${comparison}.`,
    telescopeNote: 'È il limite di diffrazione della luce visibile. Questo sito immagina che quel telescopio esista.',
    share: 'Copia il link a questa vista',
    copied: 'Link copiato',
    aboutTitle: 'Come funziona',
    about:
      'La luce impiega un anno a percorrere un anno luce. Chi ci osserva da 2.000 anni luce riceve adesso la luce partita 2.000 anni fa, e quindi vede la Terra di allora. ' +
      'Il sito calcola quel momento, la posizione del Sole e il lato del pianeta rivolto verso la stella scelta, tenendo conto della rotazione terrestre, del suo rallentamento e della precessione. ' +
      'Poi mostra i confini storici e gli eventi di quel periodo registrati su Wikidata.',
    sources: 'Dati',
    eventsLoaded: (n) => `${n} eventi`,
    comparisons: {
      telescope: 'come i più grandi telescopi di oggi',
      city: 'grande come una città',
      country: 'grande come una nazione',
      earth: (n) => `${n} volte il diametro della Terra`,
      sun: (n) => `${n} volte il diametro del Sole`,
      au: (n) => `${n} volte la distanza tra la Terra e il Sole`,
      stars: 'più della distanza che ci separa dalle stelle vicine',
      galaxy: 'più grande dell’intera Via Lattea',
    },
    months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    units: {
      second: ['secondo', 'secondi'], minute: ['minuto', 'minuti'], hour: ['ora', 'ore'],
      day: ['giorno', 'giorni'], year: ['anno', 'anni'], light: 'luce',
      million: ['milione', 'milioni'], billion: ['miliardo', 'miliardi'], of: ' di',
    },
    eventTitle: {
      birth: (name) => `Nasce ${name}`,
      city: (name) => `Fondazione di ${name}`,
      university: (name) => `Fondazione: ${name}`,
      monument: (name) => `${name} (fondazione o costruzione)`,
    },
  },
  en: {
    tagline: 'If an alien civilization were watching us from far away, what would it see right now?',
    distance: 'How far from Earth are you?',
    lightYears: 'light-years',
    hudKicker: 'From that far away you would see',
    now: 'Now',
    journey: 'Journey through time',
    journeyStop: 'Stop the journey',
    bordersToggle: 'Historical borders',
    placesLabel: 'Or stand somewhere real',
    follow: (place) => `Look from ${place}`,
    help: 'How to use it',
    guideTitle: 'Looking far is looking back',
    guideIntro: 'Light takes time to cross space. Anyone watching us from far away sees the Earth of the past.',
    guideSteps: [
      ['🔭', 'Move away', 'Drag the slider at the bottom: the farther you are, the further back in time you see.'],
      ['🌍', 'Aim at a place', 'Drag the globe. The crosshair in the middle is the spot you are watching.'],
      ['⭐', 'Pick a star', 'Stand on a real star to see the side of Earth that faces it.'],
    ],
    guideStart: 'Start',
    shortLy: 'ly',
    shortMillion: 'M',
    shortBillion: 'B',
    headline: (distance) => `From <b>${distance}</b> away, today you would see Earth as it was`,
    ago: (duration) => `${duration} ago`,
    live: 'almost live',
    aimTitle: 'Under the crosshair',
    aimHelp: 'Drag the globe, or click a spot, to change the place you are watching.',
    openSea: 'Open sea, or land with no known state',
    sea: 'Open sea',
    seaNote: 'There is only water here.',
    unclaimed: 'No known state',
    unclaimedNote: 'This is land, but the historical map records no state or culture here for that time. That does not mean nobody lived here.',
    subjectTo: (name) => `controlled by: ${name}`,
    mapOf: (year) => `Borders from the historical map of ${year}`,
    mapLoading: 'Loading the historical map…',
    mapFailed: 'Could not load the historical map. Check your connection.',
    ghostContinents: 'The continents were arranged differently: today’s are drawn faintly, only as a reference.',
    day: 'It is daytime here',
    twilight: 'It is twilight here',
    nightDark: 'It is night here, with no electric light: you would see only darkness',
    nightDim: 'It is night here: you would barely see the first, faint electric lights',
    nightLit: 'It is night here: you would see city lights',
    lightingUnknown: 'This far back nobody can tell where it was daytime: the lighting is only indicative.',
    seenNow: (place) => `From ${place} this spot is in view right now.`,
    hiddenNow: (place) => `From ${place} this spot is on the far side right now: it will turn into view within hours.`,
    neverSeen: (place) => `From ${place} this spot can never be seen: it always stays beyond the planet’s edge.`,
    fromSun: 'From the Sun you only ever see the daylight side.',
    overheadLegend: (place) => `The yellow rings mark the spot that has ${place} directly overhead.`,
    nearbyTitle: 'Nearby, around that time',
    worldTitle: 'Elsewhere in the world',
    noNearby: 'No recorded events near this spot.',
    window: (years) => (years <= 1 ? 'in the same year, or nearly' : `within ${years} years either way`),
    eraTitle: 'Era',
    wikipedia: 'Wikipedia',
    telescopeTitle: 'With what telescope?',
    telescope: (size, comparison) =>
      `To make out something 10 metres across from there, like a house or a ship, you would need a mirror <b>${size}</b> wide: ${comparison}.`,
    telescopeNote: 'This is the diffraction limit of visible light. This site imagines that such a telescope exists.',
    share: 'Copy a link to this view',
    copied: 'Link copied',
    aboutTitle: 'How it works',
    about:
      'Light takes one year to cross one light-year. Someone watching from 2,000 light-years away is receiving, right now, the light that left 2,000 years ago, so they see Earth as it was then. ' +
      'This site works out that moment, where the Sun was, and which side of the planet faced the chosen star, accounting for Earth’s rotation, its gradual slowdown and precession. ' +
      'It then shows the historical borders and the events of that time recorded in Wikidata.',
    sources: 'Data',
    eventsLoaded: (n) => `${n} events`,
    comparisons: {
      telescope: 'like the largest telescopes of today',
      city: 'the size of a city',
      country: 'the size of a country',
      earth: (n) => `${n} times the diameter of Earth`,
      sun: (n) => `${n} times the diameter of the Sun`,
      au: (n) => `${n} times the distance from Earth to the Sun`,
      stars: 'more than the distance to the nearby stars',
      galaxy: 'larger than the whole Milky Way',
    },
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    units: {
      second: ['second', 'seconds'], minute: ['minute', 'minutes'], hour: ['hour', 'hours'],
      day: ['day', 'days'], year: ['year', 'years'], light: 'light-',
      million: ['million', 'million'], billion: ['billion', 'billion'], of: '',
    },
    eventTitle: {
      birth: (name) => `${name} is born`,
      city: (name) => `${name} is founded`,
      university: (name) => `${name} is founded`,
      monument: (name) => `${name} (founded or built)`,
    },
  },
};

function initialLanguage() {
  try {
    const saved = localStorage.getItem('meanwhile-on-earth.lang');
    if (saved in TEXT) return saved;
  } catch {
    // storage can be unavailable (private mode): fall through
  }
  return navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export let lang = initialLanguage();

export function setLanguage(next) {
  lang = next in TEXT ? next : 'en';
  try {
    localStorage.setItem('meanwhile-on-earth.lang', lang);
  } catch {
    // not being able to remember the choice is harmless
  }
}

/** Looks up interface text; entries that are functions receive the arguments. */
export function t(key, ...args) {
  const entry = TEXT[lang][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 2000 → "2.000" (it) or "2,000" (en); `digits` caps the decimals. */
export function number(value, digits = 0) {
  return value.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', {
    maximumFractionDigits: digits,
    useGrouping: 'always',
  });
}

/** A count with about three significant figures: 4.25, 25, 2,000, 2.54 million. */
function rounded(value) {
  const { million, billion } = TEXT[lang].units;
  const word = (n, [one, many]) => `${number(n, 2)} ${number(n, 2) === '1' ? one : many}`;
  if (value >= 1e9) return { text: word(value / 1e9, billion), big: true };
  if (value >= 1e6) return { text: word(value / 1e6, million), big: true };
  return { text: number(value, value >= 100 ? 0 : value >= 10 ? 1 : 2), big: false };
}

/** Splits a span of years into the unit a person would use for it. */
function inNaturalUnit(years) {
  const seconds = years * 365.25 * 86400;
  if (seconds < 90) return [seconds, 'second'];
  if (seconds < 5400) return [seconds / 60, 'minute'];
  if (seconds < 129600) return [seconds / 3600, 'hour'];
  if (years < 1) return [seconds / 86400, 'day'];
  return [years, 'year'];
}

function quantity(years, light) {
  const units = TEXT[lang].units;
  const [amount, unit] = inNaturalUnit(years);
  const { text, big } = unit === 'year' ? rounded(amount) : { text: number(amount, amount < 10 ? 1 : 0), big: false };
  const [one, many] = units[unit];
  const noun = text === '1' ? one : many;
  // "2 milioni di anni luce" / "2 million light-years" / "8,3 minuti luce" / "8.3 light-minutes"
  const tail = light ? (lang === 'it' ? `${noun} ${units.light}` : `${units.light}${noun}`) : noun;
  return `${text}${big ? units.of : ''} ${tail}`;
}

/** "2.000 anni luce", "8,3 minuti luce", "2,54 milioni di anni luce". */
export const distanceText = (lightYears) => quantity(lightYears, true);

/** "2.000 anni", "8,3 minuti", "66 milioni di anni". */
export const durationText = (years) => quantity(years, false);

/** Compact distance for buttons: "25 a.l.", "2,5 mln a.l.", "8,3 minuti luce". */
export function shortDistance(lightYears) {
  if (lightYears < 1) return distanceText(lightYears);
  const text =
    lightYears >= 1e9 ? number(lightYears / 1e9, 1) + t('shortBillion')
    : lightYears >= 1e6 ? number(lightYears / 1e6, 1) + t('shortMillion')
    : number(lightYears, lightYears < 100 ? 1 : 0);
  return `${text} ${t('shortLy')}`;
}

/** Astronomical year → "26 d.C.", "480 a.C.", "1492". */
export function yearText(year) {
  if (year >= 1000) return String(year);
  if (year > 0) return lang === 'it' ? `${year} d.C.` : `AD ${year}`;
  return `${number(1 - year)} ${lang === 'it' ? 'a.C.' : 'BC'}`;
}

/**
 * The moment the light left, as precisely as it can honestly be stated:
 * to the second for nearby observers, to the day within recorded history,
 * then a rough year, then "N years ago".
 */
export function momentText(calendar, age) {
  const two = (n) => String(n).padStart(2, '0');
  const month = TEXT[lang].months[calendar.month - 1];
  if (age > 12000) return t('ago', durationText(age));
  if (age > 6000) {
    const year = yearText(Math.round(calendar.year / 100) * 100);
    return lang === 'it' ? `nell’anno ${year} circa` : `around ${year}`;
  }
  const date =
    lang === 'it'
      ? `il ${calendar.day} ${month} ${yearText(calendar.year)}`
      : `on ${month} ${calendar.day}, ${yearText(calendar.year)}`;
  if (age > 0.02) return date;
  const clock = `${two(calendar.hour)}:${two(calendar.minute)}:${two(calendar.second)} UTC`;
  return lang === 'it' ? `${date}, alle ${clock}` : `${date}, at ${clock}`;
}

/**
 * The same moment for the headline over the globe: one big phrase and a few
 * smaller details.
 */
export function headline(calendar, age) {
  const two = (n) => String(n).padStart(2, '0');
  const month = TEXT[lang].months[calendar.month - 1];
  const dayMonth = lang === 'it' ? `${calendar.day} ${month}` : `${month} ${calendar.day}`;
  const ago = t('ago', durationText(age));
  if (age > 12000) return { big: ago, details: [] };
  if (age > 6000) return { big: `≈ ${yearText(Math.round(calendar.year / 100) * 100)}`, details: [ago] };
  if (age > 1.5) return { big: yearText(calendar.year), details: [dayMonth, ago] };
  const date = `${dayMonth} ${calendar.year}`;
  if (age > 0.02) return { big: date, details: [ago] };
  return { big: `${two(calendar.hour)}:${two(calendar.minute)}:${two(calendar.second)}`, details: [`${date}, UTC`, ago, t('live')] };
}

/** A mirror diameter in metres, in a unit and with a comparison that mean something. */
export function mirrorText(metres) {
  const c = TEXT[lang].comparisons;
  const EARTH = 1.2742e7, SUN = 1.3927e9, AU = 1.496e11, LY = 9.4607e15;
  const km = rounded(metres / 1000);
  let size;
  if (metres < 1000) size = `${number(metres, 0)} m`;
  else if (metres < 0.1 * LY) size = `${km.text}${km.big ? TEXT[lang].units.of : ''} km`;
  else size = distanceText(metres / LY);
  let comparison;
  if (metres < 60) comparison = c.telescope;
  else if (metres < 5e4) comparison = c.city;
  else if (metres < EARTH) comparison = c.country;
  else if (metres < SUN) comparison = c.earth(rounded(metres / EARTH).text);
  else if (metres < AU) comparison = c.sun(rounded(metres / SUN).text);
  else if (metres < 4 * LY) comparison = c.au(rounded(metres / AU).text);
  else if (metres < 1e5 * LY) comparison = c.stars;
  else comparison = c.galaxy;
  return { size, comparison };
}

/** Event name with a verb where the bare name would be unclear ("Nasce Dante"). */
export function eventTitle(event) {
  const name = event[lang] || event.en;
  const phrase = TEXT[lang].eventTitle[event.kind];
  return phrase ? phrase(name) : name;
}

export const coordinatesText = ({ lat, lng }) =>
  `${number(Math.abs(lat), 1)}° ${lat >= 0 ? 'N' : 'S'}, ${number(Math.abs(lng), 1)}° ${lng >= 0 ? 'E' : lang === 'it' ? 'O' : 'W'}`;
