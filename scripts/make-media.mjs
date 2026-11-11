// Records the animated GIFs shown in the README.
//
// Each clip is a list of frames; each frame is one view of the app (a
// distance, a place to look at, a moment on the animation clock). The script
// opens the app once in poster mode, in a headless browser, and for every
// frame changes the link, waits for the page to say that view is completely
// drawn, and photographs it. Nothing depends on how fast the machine is.
//
//   npm run dev                       (in another terminal)
//   BROWSER="C:\path\to\msedge.exe" npm run make-media -- [clip ...]
//
// Needs a Chromium-based browser (Edge, Chrome) and ffmpeg on the PATH.
// Options: --url http://localhost:5173   where the app is running

import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer-core';
import { MIN_LY, lyFromSlider, sliderFromLy } from '../src/core/scale.js';
import { jdFromUnix, sameHourDistance } from '../src/core/sky.js';

const run = promisify(execFile);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? fallback : args.splice(at, 2)[1];
};

const APP = option('url', 'http://localhost:5173');
const BROWSER = process.env.BROWSER;
if (!BROWSER) throw new Error('Set BROWSER to the path of Edge or Chrome.');

// A mid-morning instant over Europe, so the Mediterranean is in daylight.
const AT = '2026-11-10T10:30:00Z';
const NOW = jdFromUnix(Date.parse(AT));
const [WIDTH, HEIGHT] = [720, 405]; // size of the photographs

const lerp = (a, b, t) => a + (b - a) * t;
const frames = (count, view) => Array.from({ length: count }, (_, i) => view(count > 1 ? i / (count - 1) : 0));
/** Repeats the first and last frame so the eye can settle on them. */
const withPauses = (list, before, after) => [
  ...Array(before).fill(list[0]),
  ...list,
  ...Array(after).fill(list.at(-1)),
];

// Deep time is mostly empty: a steady sweep would spend one frame on Snowball
// Earth. Instead each chapter gets its share of frames, and the distance runs
// from `from` to `to` (in light-years) within it.
const DEEP_CHAPTERS = [
  { from: 13e3, to: 27e3, frames: 12 }, // last ice age, up to its peak
  { from: 30e3, to: 2.5e6, frames: 8 }, // early humans
  { from: 5e6, to: 60e6, frames: 14 }, // India crosses the ocean
  { from: 66e6, to: 250e6, frames: 30 }, // the Atlantic closes: Pangaea
  { from: 255e6, to: 630e6, frames: 20 }, // Pangaea comes apart again, backwards
  { from: 640e6, to: 715e6, frames: 12 }, // Snowball Earth
  { from: 730e6, to: 3.9e9, frames: 14 }, // green seas, no oxygen
  { from: 4.02e9, to: 4.49e9, frames: 12 }, // magma ocean
  { from: 4.545e9, to: 4.595e9, frames: 8 }, // Earth still forming
  { from: 4.7e9, to: 13.5e9, frames: 8 }, // before the Sun
  { from: 13.8e9, to: 14e9, frames: 4 }, // before the Big Bang
];

function deepTime() {
  const distances = DEEP_CHAPTERS.flatMap((chapter) =>
    frames(chapter.frames, (t) => 10 ** lerp(Math.log10(chapter.from), Math.log10(chapter.to), t)),
  );
  // The planet keeps turning at a steady pace through every chapter.
  return distances.map((ly, i) => ({ ly, lat: 12, lng: 25 - i * 0.8 }));
}

// `width`, `fps` and `colours` trade sharpness for file size. A clip in which
// the camera moves changes every pixel of every frame, so it gets less of each.
// `clockSpeed` is how fast the app's own animations (clouds, twinkling, the
// turn of the sky) run in the clip: 1 is as in the app. In the looping clip the
// clock stands still, because its last frame must meet its first.
const CLIPS = {
  // Back through recorded history. The camera stays on the Mediterranean while
  // the year and the borders change, and the sky wheels behind the planet.
  // Early on the pace is quicker, to get past the decades in which nothing on
  // the map changes.
  history: {
    width: 720,
    fps: 12,
    colours: 128,
    clockSpeed: 3,
    frames: withPauses(
      frames(126, (t) => ({
        ly: sameHourDistance(lyFromSlider(lerp(sliderFromLy(1), sliderFromLy(5200), t ** 0.62)), NOW),
        lat: 36,
        lng: 24,
      })),
      8,
      16,
    ),
  },
  // From the last ice age to before the Universe, the continents drifting
  // back into Pangaea on the way, with the planet turning.
  'deep-time': { width: 520, fps: 10, colours: 80, clockSpeed: 2, frames: withPauses(deepTime(), 0, 12) },
  // One turn around today's Earth with the borders off: a seamless loop.
  planet: {
    width: 560,
    fps: 10,
    colours: 112,
    clockSpeed: 0,
    query: '&borders=off',
    frames: frames(61, (t) => ({ ly: MIN_LY * 1.07, lat: 18, lng: 15 - 360 * t })).slice(0, 60),
  },
};

/** The part of the link that changes from frame to frame. */
const hashFor = ({ ly, lat, lng }, clock) =>
  `#ly=${Number(ly.toPrecision(12))}&lat=${lat.toFixed(3)}&lng=${(((lng + 540) % 360) - 180).toFixed(3)}` +
  `&t=${clock.toFixed(3)}`;

/** Resolves once the page reports that the view for `hash` is completely drawn. */
async function settle(page, hash) {
  await page.waitForFunction(
    (wanted) => {
      const { view, settled } = document.documentElement.dataset;
      return view === wanted && settled === 'true';
    },
    { timeout: 60_000, polling: 'raf' },
    hash,
  );
  // Two more frames, so the last canvas upload has reached the screen.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function record(browser, name, clip, work) {
  const dir = join(work, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const clockAt = (i) => (i * clip.clockSpeed) / clip.fps;
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH + 80, height: HEIGHT + 80, deviceScaleFactor: 1 });
  const first = hashFor(clip.frames[0], clockAt(0));
  await page.goto(`${APP}/?poster=${WIDTH}x${HEIGHT}&lang=en&at=${AT}${clip.query ?? ''}${first}`);
  await settle(page, first);

  for (const [i, view] of clip.frames.entries()) {
    const hash = hashFor(view, clockAt(i));
    if (i > 0) {
      await page.evaluate((next) => (location.hash = next), hash);
      await settle(page, hash);
    }
    await page.screenshot({
      path: join(dir, `${String(i).padStart(4, '0')}.png`),
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    process.stdout.write(`\r${name}: ${i + 1}/${clip.frames.length} frames`);
  }
  console.log();
  await page.close();

  const docs = fileURLToPath(new URL('../docs/', import.meta.url));
  await mkdir(docs, { recursive: true });
  const out = join(docs, `${name}.gif`);
  await run('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(clip.fps), '-i', join(dir, '%04d.png'),
    '-vf',
    `scale=${clip.width}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${clip.colours}:stats_mode=diff[p];` +
      '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', '0', out,
  ]);
  const seconds = (clip.frames.length / clip.fps).toFixed(1);
  console.log(`  → docs/${name}.gif  ${((await stat(out)).size / 1e6).toFixed(1)} MB, ${seconds} s`);
}

const wanted = args.length ? args : Object.keys(CLIPS);
for (const name of wanted) {
  if (!CLIPS[name]) throw new Error(`Unknown clip "${name}". Choose from: ${Object.keys(CLIPS).join(', ')}`);
}
const work = join(tmpdir(), 'meanwhile-on-earth-media');
const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: [
    '--hide-scrollbars', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    // Edge may restart itself in a second process on launch, which cuts the
    // connection to this script. Chrome ignores the flag.
    '--edge-skip-compat-layer-relaunch',
  ],
});
try {
  for (const name of wanted) await record(browser, name, CLIPS[name], work);
} finally {
  await browser.close();
}
console.log(`Frames are kept in ${work}; delete that folder when done.`);
