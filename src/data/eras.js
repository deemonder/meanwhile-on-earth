// What Earth was like at any point in its past.
//
// Spans are in years before present; when several contain a moment, the
// shortest wins, so a brief event (an asteroid impact) overrides the long era
// around it. `look` tells the globe how to draw the planet:
//
//   today     the familiar planet
//   glacial   ice sheets over the northern continents
//   peakIce   the same, at their greatest extent
//   paleo     continents were elsewhere; today's are drawn as faint ghosts
//   snowball  frozen from pole to pole
//   archean   green seas, rusty rock, orange haze, no oxygen
//   molten    a magma ocean
//   forming   no Earth yet: a disc of dust around the newborn Sun
//   cloud     no Sun either: only a cloud of gas
//   void      before the Big Bang: nothing at all
//
// Dates: International Chronostratigraphic Chart (2023) and standard references.

const K = 1e3;
const M = 1e6;
const G = 1e9;

export const ERAS = [
  {
    from: 0, to: 81, look: 'today', wiki: { it: 'Storia contemporanea', en: 'Contemporary history' },
    it: ['Età contemporanea', 'Il mondo come lo conosci: di notte le città brillano, e intorno al pianeta girano satelliti.'],
    en: ['Contemporary era', 'The world as you know it: cities glow at night and satellites circle the planet.'],
  },
  {
    from: 81, to: 112, look: 'today', wiki: { it: 'Seconda guerra mondiale', en: 'World War II' },
    it: ['Le guerre mondiali', 'Trent’anni, due guerre mondiali. Le luci elettriche cominciano appena a punteggiare la notte.'],
    en: ['The World Wars', 'Thirty years, two world wars. Electric light is only starting to dot the night side.'],
  },
  {
    from: 112, to: 266, look: 'today', wiki: { it: 'Rivoluzione industriale', en: 'Industrial Revolution' },
    it: ['Età industriale', 'Vapore, ferrovie e imperi coloniali. Il lato notturno del pianeta è ancora quasi del tutto buio.'],
    en: ['Industrial age', 'Steam, railways and colonial empires. The night side of the planet is still almost entirely dark.'],
  },
  {
    from: 266, to: 534, look: 'today', wiki: { it: 'Età moderna', en: 'Early modern period' },
    it: ['Età moderna', 'Velieri attraversano gli oceani e collegano per la prima volta tutti i continenti.'],
    en: ['Early modern period', 'Sailing ships cross the oceans and link every continent for the first time.'],
  },
  {
    from: 534, to: 1550, look: 'today', wiki: { it: 'Medioevo', en: 'Middle Ages' },
    it: ['Medioevo', 'Califfati e regni in Europa e Medio Oriente, Tang e Song in Cina, grandi città nelle Americhe.'],
    en: ['Middle Ages', 'Caliphates and kingdoms in Europe and the Middle East, Tang and Song China, great cities in the Americas.'],
  },
  {
    from: 1550, to: 2800, look: 'today', wiki: { it: 'Età classica', en: 'Classical antiquity' },
    it: ['Antichità classica', 'Greci, Persiani e Romani attorno al Mediterraneo; i Maurya in India, gli Han in Cina.'],
    en: ['Classical antiquity', 'Greeks, Persians and Romans around the Mediterranean; the Maurya in India, the Han in China.'],
  },
  {
    from: 2800, to: 5300, look: 'today', wiki: { it: 'Età del bronzo', en: 'Bronze Age' },
    it: ['Età del bronzo', 'Nascono la scrittura e le prime città: Sumer, l’Egitto dei faraoni, la valle dell’Indo.'],
    en: ['Bronze Age', 'Writing and the first cities appear: Sumer, the Egypt of the pharaohs, the Indus Valley.'],
  },
  {
    from: 5300, to: 11700, look: 'today', wiki: { it: 'Neolitico', en: 'Neolithic' },
    it: ['Neolitico', 'Gli esseri umani imparano a coltivare e ad allevare. Compaiono i primi villaggi stabili.'],
    en: ['Neolithic', 'Humans learn to farm and herd. The first permanent villages appear.'],
  },
  {
    from: 11700, to: 115 * K, look: 'glacial', wiki: { it: 'Ultimo periodo glaciale', en: 'Last Glacial Period' },
    it: ['Ultima era glaciale', 'Calotte di ghiaccio coprono il Nord. Cacciatori nomadi inseguono mammut e renne.'],
    en: ['Last ice age', 'Ice sheets cover the north. Nomadic hunters follow mammoths and reindeer.'],
  },
  {
    from: 19 * K, to: 26.5 * K, look: 'peakIce', wiki: { it: 'Ultimo massimo glaciale', en: 'Last Glacial Maximum' },
    it: ['Ultimo massimo glaciale', 'Ghiaccio spesso chilometri su Canada e Scandinavia. Il mare è 120 metri più basso di oggi.'],
    en: ['Last Glacial Maximum', 'Kilometre-thick ice over Canada and Scandinavia. The sea is 120 metres lower than today.'],
  },
  {
    from: 115 * K, to: 300 * K, look: 'glacial', wiki: { it: 'Homo sapiens', en: 'Human' },
    it: ['I primi Homo sapiens', 'La nostra specie compare in Africa. In Europa e in Asia vivono i Neanderthal.'],
    en: ['The first Homo sapiens', 'Our species appears in Africa. Neanderthals live in Europe and Asia.'],
  },
  {
    from: 300 * K, to: 2.58 * M, look: 'glacial', wiki: { it: 'Pleistocene', en: 'Pleistocene' },
    it: ['Pleistocene', 'Il clima oscilla tra glaciazioni e periodi miti. Homo erectus controlla il fuoco e lascia l’Africa.'],
    en: ['Pleistocene', 'The climate swings between ice ages and mild spells. Homo erectus tames fire and leaves Africa.'],
  },
  {
    from: 2.58 * M, to: 7 * M, look: 'today', wiki: { it: 'Australopithecus', en: 'Australopithecus' },
    it: ['I primi ominini', 'In Africa alcuni primati cominciano a camminare su due gambe: sono i nostri antenati.'],
    en: ['The first hominins', 'In Africa some apes begin to walk on two legs: they are our ancestors.'],
  },
  {
    from: 7 * M, to: 66 * M, look: 'paleo', wiki: { it: 'Cenozoico', en: 'Cenozoic' },
    it: ['Era dei mammiferi', 'Scomparsi i dinosauri, i mammiferi occupano il pianeta. L’India si scontra con l’Asia e nasce l’Himalaya.'],
    en: ['Age of mammals', 'With the dinosaurs gone, mammals take over. India rams into Asia and raises the Himalayas.'],
  },
  {
    from: 65.95 * M, to: 66.05 * M, look: 'paleo', wiki: { it: 'Cratere di Chicxulub', en: 'Chicxulub crater' },
    it: ['L’asteroide di Chicxulub', 'Un asteroide di dieci chilometri colpisce lo Yucatán. È la fine dei grandi dinosauri.'],
    en: ['The Chicxulub asteroid', 'A ten-kilometre asteroid strikes the Yucatán. It is the end of the great dinosaurs.'],
  },
  {
    from: 66 * M, to: 145 * M, look: 'paleo', wiki: { it: 'Cretacico', en: 'Cretaceous' },
    it: ['Cretacico', 'Tirannosauri e triceratopi. Sbocciano i primi fiori e l’Atlantico si allarga.'],
    en: ['Cretaceous', 'Tyrannosaurs and Triceratops. The first flowers bloom and the Atlantic widens.'],
  },
  {
    from: 145 * M, to: 201.4 * M, look: 'paleo', wiki: { it: 'Giurassico', en: 'Jurassic' },
    it: ['Giurassico', 'Sauropodi giganti e i primi uccelli. Il supercontinente Pangea si sta spezzando.'],
    en: ['Jurassic', 'Giant sauropods and the first birds. The supercontinent Pangaea is breaking apart.'],
  },
  {
    from: 201.4 * M, to: 251.9 * M, look: 'paleo', wiki: { it: 'Triassico', en: 'Triassic' },
    it: ['Triassico', 'Tutte le terre sono unite nella Pangea, circondata da un unico oceano. Compaiono i primi dinosauri.'],
    en: ['Triassic', 'All land is joined in Pangaea, surrounded by a single ocean. The first dinosaurs appear.'],
  },
  {
    from: 251.7 * M, to: 252.1 * M, look: 'paleo', wiki: { it: 'Estinzione di massa del Permiano-Triassico', en: 'Permian–Triassic extinction event' },
    it: ['La Grande Moria', 'La peggiore estinzione di sempre: scompaiono circa nove specie marine su dieci.'],
    en: ['The Great Dying', 'The worst extinction ever: about nine in ten marine species vanish.'],
  },
  {
    from: 251.9 * M, to: 358.9 * M, look: 'paleo', wiki: { it: 'Carbonifero', en: 'Carboniferous' },
    it: ['Carbonifero e Permiano', 'Foreste sterminate, che diventeranno carbone, e libellule grandi come falchi. Si forma la Pangea.'],
    en: ['Carboniferous and Permian', 'Endless forests, the future coal, and dragonflies the size of hawks. Pangaea assembles.'],
  },
  {
    from: 358.9 * M, to: 485.4 * M, look: 'paleo', wiki: { it: 'Devoniano', en: 'Devonian' },
    it: ['La vita conquista la terraferma', 'Prima le piante, poi gli insetti, infine i primi pesci con le zampe escono dall’acqua.'],
    en: ['Life moves onto land', 'First plants, then insects, and at last the first fish with legs leave the water.'],
  },
  {
    from: 485.4 * M, to: 538.8 * M, look: 'paleo', wiki: { it: 'Esplosione cambriana', en: 'Cambrian explosion' },
    it: ['Esplosione cambriana', 'Nei mari compaiono quasi tutti i grandi gruppi di animali. La terraferma è roccia nuda.'],
    en: ['Cambrian explosion', 'Almost every major group of animals appears in the seas. The land is bare rock.'],
  },
  {
    from: 538.8 * M, to: 635 * M, look: 'paleo', wiki: { it: 'Ediacarano', en: 'Ediacaran' },
    it: ['Ediacarano', 'Sui fondali vivono i primi organismi grandi: molli, piatti, diversi da tutto ciò che conosciamo.'],
    en: ['Ediacaran', 'The first large organisms live on the seabed: soft, flat, unlike anything alive today.'],
  },
  {
    from: 635 * M, to: 720 * M, look: 'snowball', wiki: { it: 'Terra a palla di neve', en: 'Snowball Earth' },
    it: ['Terra palla di neve', 'Il ghiaccio arriva fino all’equatore. Dallo spazio il pianeta è una sfera bianca.'],
    en: ['Snowball Earth', 'Ice reaches the equator. From space the planet is a white ball.'],
  },
  {
    from: 720 * M, to: 2.5 * G, look: 'archean', wiki: { it: 'Proterozoico', en: 'Proterozoic' },
    it: ['Proterozoico', 'Solo microbi, per quasi due miliardi di anni. L’ossigeno si accumula lentamente nell’aria.'],
    en: ['Proterozoic', 'Nothing but microbes for almost two billion years. Oxygen slowly builds up in the air.'],
  },
  {
    from: 2.5 * G, to: 4.0 * G, look: 'archean', wiki: { it: 'Archeano', en: 'Archean' },
    it: ['Archeano', 'Mari verdastri carichi di ferro sotto una foschia arancione, senza ossigeno. Nascono i primi microbi.'],
    en: ['Archean', 'Greenish, iron-laden seas under an orange haze, with no oxygen. The first microbes arise.'],
  },
  {
    from: 4.0 * G, to: 4.5 * G, look: 'molten', wiki: { it: 'Adeano', en: 'Hadean' },
    it: ['Adeano', 'La crosta è appena solidificata e viene bombardata dagli asteroidi. Si condensano i primi oceani.'],
    en: ['Hadean', 'The crust has barely set and asteroids keep pounding it. The first oceans condense.'],
  },
  {
    from: 4.5 * G, to: 4.54 * G, look: 'molten', wiki: { it: 'Teoria dell\'impatto gigante', en: 'Giant-impact hypothesis' },
    it: ['Nasce la Luna', 'Un pianeta grande quanto Marte si schianta sulla Terra. Dai detriti si forma la Luna.'],
    en: ['The Moon is born', 'A planet the size of Mars crashes into Earth. The Moon forms from the debris.'],
  },
  {
    from: 4.54 * G, to: 4.6 * G, look: 'forming', wiki: { it: 'Formazione ed evoluzione del sistema solare', en: 'Formation and evolution of the Solar System' },
    it: ['La Terra si sta formando', 'Attorno al Sole appena nato ruota un disco di polvere e gas. La Terra non c’è ancora.'],
    en: ['Earth is still forming', 'A disc of dust and gas circles the newborn Sun. There is no Earth yet.'],
  },
  {
    from: 4.6 * G, to: 13.787 * G, look: 'cloud', wiki: { it: 'Via Lattea', en: 'Milky Way' },
    it: ['Prima del Sistema solare', 'Qui c’è solo una nube di gas nella Via Lattea. Il Sole e la Terra devono ancora nascere.'],
    en: ['Before the Solar System', 'There is only a gas cloud in the Milky Way here. The Sun and Earth are yet to be born.'],
  },
  {
    from: 13.787 * G, to: Infinity, look: 'void', wiki: { it: 'Big Bang', en: 'Big Bang' },
    it: ['Più antico dell’Universo', 'Nessuna luce ha viaggiato così a lungo: l’Universo ha circa 13,8 miliardi di anni. Da qui non c’è niente da vedere.'],
    en: ['Older than the Universe', 'No light has travelled this long: the Universe is about 13.8 billion years old. From here there is nothing to see.'],
  },
];

/** The shortest era that contains a moment `age` years before present. */
export function eraAt(age) {
  let best = null;
  for (const era of ERAS) {
    if (age < era.from || age >= era.to) continue;
    // The last era is open-ended, so its span is infinite: it can only be
    // chosen by being the first match, never by beating another span.
    if (!best || era.to - era.from < best.to - best.from) best = era;
  }
  return best ?? ERAS[0];
}

/** False for the looks in which there is no planet to draw. */
export const hasEarth = (look) => look !== 'forming' && look !== 'cloud' && look !== 'void';

/**
 * Brightness of electric city lights, 0…1. There were none before the 1880s.
 * The night image is a modern composite, so this fades it; it cannot show
 * which cities were lit first.
 */
export function cityLightsIn(year) {
  if (year <= 1880) return 0;
  if (year >= 2000) return 1;
  const t = (year - 1880) / 120;
  return t * t;
}
