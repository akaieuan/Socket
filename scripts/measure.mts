/**
 * Drive the compiled engine offline and measure it.
 *
 * The browser is the wrong place to check whether a filter filters. Every
 * engine bug found in this project so far was found this way — a spectral
 * centroid, a dB per band, a peak level — and most would have been
 * near-impossible by ear: a formant filter silenced by its own reset, a string
 * decaying at 400dB a second, a downsampler whose smoothing knob was measuring
 * its own spectral leakage.
 *
 * This runs the same WebAssembly the worklet runs, with no audio device and no
 * browser. Its counterpart is `player/tools/render.cpp` in akaVST, which does
 * the same measurements on the compiled plugin — the two together are how the
 * claim "Socket and the Player run the same C++" gets held to account rather
 * than asserted.
 *
 *   node --experimental-strip-types scripts/measure.mts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const SR = 48000;
const N = 128;

const HERE = path.resolve(import.meta.dirname, "..");
const ENGINE = path.join(HERE, "public/engine/engine.js");
const CATALOG = path.resolve(
  HERE, "../akaVST/skeleton/modules/aka_skeleton/dsp/BlockCatalog.h");

// package.json says type: module, so require() of the glue returns an empty
// namespace. Evaluating the text as a function body is the shortest path to
// the factory that does not involve a second copy of the build.
const glue = readFileSync(ENGINE, "utf8");
const factory = new Function(`${glue}; return createEngine;`)() as () => Promise<any>;
const M = await factory();

// cwrap is not in EXPORTED_RUNTIME_METHODS — the worklet calls the underscore
// exports directly, so this measures exactly what ships.
export const api = {
  prepare: M._aka_prepare,
  beginBlocks: M._aka_begin_blocks,
  pushBlock: M._aka_push_block,
  commitBlocks: M._aka_commit_blocks,
  beginChain: M._aka_begin_chain,
  pushChain: M._aka_push_chain,
  commitChain: M._aka_commit_chain,
  setParam: M._aka_set_param,
  noteOn: M._aka_note_on,
  noteOff: M._aka_note_off,
  allOff: M._aka_all_notes_off,
  process: M._aka_process,
  voices: M._aka_active_voices,
  setMod: M._aka_set_mod,
  clearMods: M._aka_clear_mods,
  modDepth: M._aka_set_mod_depth,
  modSlew: M._aka_set_mod_slew,
};

const L = M._malloc(N * 4), R = M._malloc(N * 4);

/** Block type ids, read from the generated header so this cannot drift. */
export const TYPE: Record<string, number> = {};
for (const m of readFileSync(CATALOG, "utf8").matchAll(/^\s{4}(\w+)\s+=\s+(\d+),/gm))
  TYPE[m[1]!] = Number(m[2]);

/** Build an instrument out of block type names, chained in the order given. */
export function build(types: string[]) {
  api.beginBlocks();
  for (const t of types) api.pushBlock(TYPE[t] ?? 0);
  api.commitBlocks();
  api.beginChain();
  for (let i = 0; i < types.length; i++) api.pushChain(i);
  api.commitChain();
}

/** Render `seconds` of audio and return the left channel. */
export function render(seconds: number, { note = 60 as number | null } = {}) {
  const frames = Math.floor(SR * seconds);
  const out = new Float32Array(frames);
  if (note !== null) api.noteOn(note, 0.9);
  for (let i = 0; i < frames; i += N) {
    api.process(L, R, N);
    const chunk = new Float32Array(M.HEAPF32.buffer, L, N);
    out.set(chunk.subarray(0, Math.min(N, frames - i)), i);
  }
  return out;
}

export const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
export const rms = (x: Float32Array) =>
  Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));
export const db = (v: number) => (v > 1e-12 ? 20 * Math.log10(v) : -Infinity);

/**
 * DFT magnitude at one frequency, Hann-windowed.
 *
 * The window is not optional. Rectangular leakage from a strong fundamental
 * sits about 22dB down across the whole spectrum, which is louder than every
 * aliasing image a downsampler produces — so an unwindowed probe measures its
 * own leakage and reports that the images got quieter as they got louder.
 */
export function magAt(x: Float32Array, hz: number) {
  let re = 0, im = 0, norm = 0;
  const w = (2 * Math.PI * hz) / SR;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re += x[i]! * win * Math.cos(w * i);
    im -= x[i]! * win * Math.sin(w * i);
    norm += win;
  }
  return (2 * Math.hypot(re, im)) / Math.max(1, norm);
}

/** Where the energy sits, in Hz. The one number that says "brighter". */
export function centroid(x: Float32Array) {
  let num = 0, den = 0;
  for (let hz = 40; hz < 12000; hz *= 1.06) {
    const m = magAt(x, hz);
    num += hz * m;
    den += m;
  }
  return den > 0 ? num / den : 0;
}
