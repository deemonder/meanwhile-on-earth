// Records the animated GIFs shown in the README.
//
// Each clip is a list of frames; each frame is one view of the app (a
// distance, a place to look at) opened in poster mode by a headless browser
// and photographed. Because every frame is rendered from scratch at a frozen
// instant, the result is the same on any machine, however slow.
//
//   npm run dev                       (in another terminal)
//   BROWSER="C:\path\to\msedge.exe" npm run make-media -- [clip ...]
//
// Needs a Chromium-based browser (Edge, Chrome) and ffmpeg on the PATH.
// Options: --url http://localhost:5173   where the app is running
//          --jobs 4                      browsers running at once
//          --resume                      keep frames already taken by an earlier run

import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MIN_LY, lyFromSlider, sliderFromLy } from '../src/core/scale.js';
import { jdFromUnix, sameHourDistance } from '../src/core/sky.js';

const run = promisify(execFile);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? fallback : args.splice(at, 2)[1];
};
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at >= 0) args.splice(at, 1);
  return at >= 0;
};

const APP = option('url', 'http://localhost:5173');
const JOBS = Number(option('jobs', 4));
const RESUME = flag('resume');
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
  { from: 13e3, to: 27e3, frames: 14 }, // last ice age, up to its peak
  { from: 30e3, to: 2.5e6, frames: 12 }, // early humans
  { from: 3e6, to: 60e6, frames: 10 }, // age of mammals
  { from: 66e6, to: 250e6, frames: 14 }, // dinosaurs, Pangaea
  { from: 260e6, to: 630e6, frames: 10 }, // first animals
  { from: 640e6, to: 715e6, frames: 14 }, // Snowball Earth
  { from: 730e6, to: 3.9e9, frames: 16 }, // green seas, no oxygen
  { from: 4.02e9, to: 4.49e9, frames: 14 }, // magma ocean
  { from: 4.545e9, to: 4.595e9, frames: 10 }, // Earth still forming
  { from: 4.7e9, to: 13.5e9, frames: 10 }, // before the Sun
  { from: 13.8e9, to: 14e9, frames: 6 }, // before the Big Bang
];

function deepTime() {
  const distances = DEEP_CHAPTERS.flatMap((chapter) =>
    frames(chapter.frames, (t) => 10 ** lerp(Math.log10(chapter.from), Math.log10(chapter.to), t)),
  );
  // The planet keeps turning at a steady pace through every chapter.
  return distances.map((ly, i) => ({ ly, lat: 18, lng: 25 - i * 0.9 }));
}

// `width`, `fps` and `colours` trade sharpness for file size. A clip in which
// the camera moves changes every pixel of every frame, so it gets less of each.
const CLIPS = {
  // Back through recorded history. The camera stays still so that the only
  // things moving are the year and the borders; early on, the pace is quicker
  // to get past the decades in which nothing on the map changes.
  history: {
    width: 720,
    fps: 12,
    colours: 128,
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
  // From the last ice age to before the Universe, with the planet turning.
  'deep-time': { width: 520, fps: 10, colours: 80, frames: withPauses(deepTime(), 0, 12) },
  // One turn around today's Earth with the borders off: a seamless loop.
  planet: {
    width: 560,
    fps: 10,
    colours: 112,
    frames: frames(61, (t) => ({ ly: MIN_LY * 1.07, lat: 18, lng: 15 - 360 * t, borders: 'off' })).slice(0, 60),
  },
};

const urlFor = ({ ly, lat, lng, borders }) =>
  `${APP}/?poster=${WIDTH}x${HEIGHT}&lang=en&at=${AT}${borders ? `&borders=${borders}` : ''}` +
  `#ly=${Number(ly.toPrecision(12))}&lat=${lat.toFixed(3)}&lng=${(((lng + 540) % 360) - 180).toFixed(3)}`;

const exists = (file) => stat(file).then((s) => s.size > 0, () => false);

async function photograph(url, file, profile) {
  await run(
    BROWSER,
    [
      '--headless=new', '--no-first-run', '--hide-scrollbars', '--enable-unsafe-swiftshader',
      `--user-data-dir=${profile}`,
      // Larger than the picture: the poster has a fixed size and is cropped out later.
      `--window-size=${WIDTH + 200},${HEIGHT + 250}`,
      '--virtual-time-budget=10000', // let textures load and the shader settle
      `--screenshot=${file}`,
      url,
    ],
    { timeout: 120_000 },
  ).catch(() => {}); // the browser prints noise on stderr; the file is what counts
}

async function record(name, clip, work) {
  const dir = join(work, name);
  await mkdir(dir, { recursive: true });
  const todo = clip.frames.map((view, i) => ({ view, file: join(dir, `${String(i).padStart(4, '0')}.png`) }));
  const total = todo.length;

  let done = 0;
  await Promise.all(
    Array.from({ length: JOBS }, async (_, worker) => {
      const profile = join(work, `profile-${worker}`);
      for (let job = todo.shift(); job; job = todo.shift()) {
        for (let attempt = 0; attempt < 3 && !(await exists(job.file)); attempt++) {
          await photograph(urlFor(job.view), job.file, profile);
        }
        if (!(await exists(job.file))) throw new Error(`could not capture ${job.file}`);
        process.stdout.write(`\r${name}: ${++done}/${total} frames`);
      }
    }),
  );
  console.log();

  const docs = fileURLToPath(new URL('../docs/', import.meta.url));
  await mkdir(docs, { recursive: true });
  const out = join(docs, `${name}.gif`);
  await run('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(clip.fps), '-i', join(dir, '%04d.png'),
    '-vf',
    `crop=${WIDTH}:${HEIGHT}:0:0,scale=${clip.width}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${clip.colours}:stats_mode=diff[p];` +
      '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', '0', out,
  ]);
  const seconds = (total / clip.fps).toFixed(1);
  console.log(`  → docs/${name}.gif  ${((await stat(out)).size / 1e6).toFixed(1)} MB, ${seconds} s`);
}

const wanted = args.length ? args : Object.keys(CLIPS);
const work = join(tmpdir(), 'meanwhile-on-earth-media');
for (const name of wanted) {
  if (!CLIPS[name]) throw new Error(`Unknown clip "${name}". Choose from: ${Object.keys(CLIPS).join(', ')}`);
  if (!RESUME) await rm(join(work, name), { recursive: true, force: true });
  await record(name, CLIPS[name], work);
}
console.log(`Frames are kept in ${work}; delete that folder when done.`);
