import { instantiate } from "./project";
import type { Accent, BlockInstance, Project } from "./types";
import { SIZES } from "./types";
import { NUM_SOURCES, NUM_TARGETS } from "@/audio/modulation";

/**
 * Starting points.
 *
 * A preset here is a whole instrument, not a bank of parameter values — the
 * layout, the wiring, the patch cables and the sequencer pattern as well as
 * every knob. That is what Socket makes, so it is what a preset has to be; a
 * parameter set would only be meaningful against a layout you had already
 * built, which is the thing a starting point is supposed to save you.
 *
 * Eight of them, each showing a different corner of the catalogue. An empty
 * window is a hard thing to evaluate, and "make a sound from nothing" is a
 * worse first task than "take this apart".
 */

/** Params by label rather than index — a preset should read like a patch sheet. */
type Params = Record<string, number>;

type BlockSpec = {
  type: string;
  name?: string;
  params?: Params;
  /** Columns and rows. Omitted means whatever the catalogue thinks. */
  box?: [number, number];
};

type PresetSpec = {
  id: string;
  name: string;
  /** One line: what it is, and what to look at. */
  note: string;
  accent: Accent;
  size?: string;
  pages: Array<{ name: string; blocks: BlockSpec[] }>;
  /** Signal chain, as indices into the flat block list. */
  wires?: Array<[number, number]>;
  /** Patch cables, as [source jack, destination jack] positions. */
  patch?: Array<[number, number]>;
  /** Sequencer steps that fire, and optionally what they play. */
  steps?: { on: number[]; notes?: number[]; velocity?: number[] };
};

/* ── The bank ─────────────────────────────────────────────────────────── */

const SPECS: PresetSpec[] = [
  {
    id: "init",
    name: "Init",
    note: "One oscillator, one filter, one envelope. The smallest thing that is an instrument.",
    accent: "blue",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "osc", params: { Wave: 0, Level: 0.8 } },
        { type: "filter", params: { Cutoff: 0.7, Reso: 0.2, Env: 0.6 } },
        { type: "env", params: { A: 0.05, D: 0.4, S: 0.6, R: 0.3 } },
        { type: "screen", params: { Mode: 2 } },
        { type: "out", params: { Level: 0.8 } },
      ],
    }],
    wires: [[0, 1], [1, 4]],
  },

  {
    id: "bass",
    name: "Sub bass",
    note: "Saw and a sub an octave down, through a ladder with the envelope on the cutoff.",
    accent: "blue",
    size: "Compact",
    pages: [{
      name: "Bass",
      blocks: [
        { type: "osc", params: { Wave: 0, Level: 0.7, Fine: 0.52 } },
        { type: "sub", params: { Level: 0.8, Octave: 0, Shape: 0 } },
        { type: "filter", params: { Mode: 0, Cutoff: 0.32, Reso: 0.35, Env: 0.78 } },
        { type: "drive", params: { Drive: 0.35, Bias: 0.6, Tone: 0.35, Mix: 0.7 } },
        { type: "env", params: { A: 0, D: 0.35, S: 0.25, R: 0.2, Curve: 0.3 } },
        { type: "meter" },
        { type: "out", params: { Level: 0.85 } },
      ],
    }],
    wires: [[0, 2], [1, 2], [2, 3], [3, 6]],
  },

  {
    id: "acid",
    name: "Acid",
    note: "Sequencer running, LFO on the cutoff. Pull the cable in the patch bay to hear what it was doing.",
    accent: "green",
    pages: [
      {
        name: "Synth",
        blocks: [
          { type: "osc", params: { Wave: 0, Level: 0.85 } },
          { type: "filter", params: { Mode: 1, Cutoff: 0.28, Reso: 0.85, Env: 0.7 } },
          { type: "env", params: { A: 0, D: 0.28, S: 0.1, R: 0.15, Curve: 0.25 } },
          { type: "screen", params: { Mode: 1, Rate: 0.7 } },
          { type: "out", params: { Level: 0.8 } },
        ],
      },
      {
        name: "Mod",
        blocks: [
          { type: "seq", params: { Tempo: 0.45, Rate: 3, Swing: 0.18, Gate: 0.35, Length: 0.24, Run: 1 } },
          { type: "lfo", params: { Shape: 0, Rate: 0.28, Depth: 0.55 } },
          { type: "patch", params: { Depth: 0.55, Slew: 0.12 } },
        ],
      },
    ],
    wires: [[0, 1], [1, 4]],
    // LFO is the second modulator in the list, CUTOFF the second destination.
    patch: [[1, 1]],
    steps: {
      on: [0, 2, 3, 6, 8, 10, 11, 14],
      notes: [36, 36, 48, 36, 36, 43, 36, 39, 36, 36, 48, 36, 36, 43, 51, 36],
      velocity: [1, 0.5, 0.9, 0.55, 1, 0.5, 0.85, 0.6, 1, 0.5, 0.95, 0.5, 1, 0.6, 0.8, 0.5],
    },
  },

  {
    id: "pluck",
    name: "Pluck",
    note: "A plucked string into a delay. Damping is the whole character — try it near zero.",
    accent: "amber",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "string", params: { Damping: 0.28, Position: 0.22, Level: 0.85 } },
        { type: "filter", params: { Mode: 1, Cutoff: 0.72, Reso: 0.15 } },
        { type: "env", params: { A: 0, D: 0.55, S: 0.5, R: 0.35 } },
        { type: "delay", params: { Time: 0.32, Feedback: 0.42, Spread: 0.7, Tone: 0.6, Mix: 0.28 } },
        { type: "scope", params: { Time: 0.25, Gain: 0.7 } },
        { type: "out", params: { Level: 0.78 } },
      ],
    }],
    wires: [[0, 1], [1, 3], [3, 5]],
  },

  {
    id: "pad",
    name: "Pad",
    note: "Two oscillators a few cents apart, a slow envelope and a long reverb.",
    accent: "violet",
    size: "Tall",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "osc", name: "Osc A", params: { Wave: 0, Fine: 0.44, Level: 0.55 } },
        { type: "osc", name: "Osc B", params: { Wave: 1, Fine: 0.58, Level: 0.45, PW: 0.4 } },
        { type: "filter", params: { Mode: 1, Cutoff: 0.55, Reso: 0.12, Env: 0.35, Key: 0.4 } },
        { type: "env", params: { A: 0.42, D: 0.6, S: 0.75, R: 0.62, Curve: 0.62 } },
        { type: "chorus", params: { Rate: 0.18, Depth: 0.5, Voices: 1, Spread: 0.8, Mix: 0.45 } },
        { type: "reverb", params: { Size: 0.82, Decay: 0.72, Damp: 0.35, Pre: 0.2, Width: 0.9, Mix: 0.42 } },
        { type: "analyser", params: { Bands: 2, Tilt: 0.6, Smooth: 0.7 } },
        { type: "out", params: { Level: 0.75 } },
      ],
    }],
    wires: [[0, 2], [1, 2], [2, 4], [4, 5], [5, 7]],
  },

  {
    id: "bell",
    name: "Bell",
    note: "Two-op FM with a wide ratio. Index is how metallic; feedback is how unstable.",
    accent: "rose",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "fmop", params: { Ratio: 0.72, Index: 0.42, Feedback: 0.12, Level: 0.8 } },
        { type: "env", params: { A: 0, D: 0.62, S: 0.05, R: 0.55, Curve: 0.3 } },
        { type: "reverb", params: { Size: 0.68, Decay: 0.6, Damp: 0.5, Mix: 0.35 } },
        { type: "screen", params: { Mode: 0, Rate: 0.4, Tilt: 0.7 } },
        { type: "out", params: { Level: 0.72 } },
      ],
    }],
    wires: [[0, 2], [2, 4]],
  },

  {
    id: "drone",
    name: "Drone",
    note: "Wavetable and noise through a vowel filter and a comb. Nothing here decays.",
    accent: "amber",
    size: "Tall",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "wavetable", params: { Table: 0.34, Position: 0.4, Warp: 0.3, Level: 0.6 } },
        { type: "noise", params: { Kind: 0.34, Level: 0.12, Colour: 0.3 } },
        { type: "formant", params: { Vowel: 0.6, Morph: 0.35, Width: 0.5, Mix: 0.65 } },
        { type: "comb", params: { Tune: 0.32, Feedback: 0.62, Mix: 0.4 } },
        { type: "env", params: { A: 0.55, D: 0.5, S: 1, R: 0.7 } },
        { type: "reverb", params: { Size: 0.9, Decay: 0.85, Damp: 0.25, Width: 1, Mix: 0.5 } },
        { type: "screen", params: { Mode: 2, Rate: 0.2, Tilt: 0.65, Decay: 0.8 } },
        { type: "out", params: { Level: 0.7 } },
      ],
    }],
    wires: [[0, 2], [1, 2], [2, 3], [3, 5], [5, 7]],
  },

  {
    id: "crush",
    name: "Crush",
    note: "Square into a wavefolder and a bitcrusher. Bits is how many levels; Rate is how often.",
    accent: "rose",
    size: "Compact",
    pages: [{
      name: "Synth",
      blocks: [
        { type: "osc", params: { Wave: 1, Level: 0.7, PW: 0.35 } },
        { type: "fold", params: { Fold: 0.45, Symmetry: 0.62, Mix: 0.8 } },
        { type: "crush", params: { Bits: 0.28, Rate: 0.42, Jitter: 0.2, Mix: 0.75 } },
        { type: "filter", params: { Mode: 1, Cutoff: 0.6, Reso: 0.3 } },
        { type: "env", params: { A: 0, D: 0.3, S: 0.4, R: 0.22 } },
        { type: "scope", params: { Time: 0.15, Gain: 0.55, Trace: 1 } },
        { type: "out", params: { Level: 0.7 } },
      ],
    }],
    wires: [[0, 1], [1, 2], [2, 3], [3, 6]],
  },
];

/* ── Building one ─────────────────────────────────────────────────────── */

/** Set a block's parameters by label, ignoring any the block does not have. */
function withParams(block: BlockInstance, params: Params | undefined): BlockInstance {
  if (!params) return block;
  return {
    ...block,
    params: block.params.map((p) => {
      const v = params[p.label];
      return v === undefined ? p : { ...p, value: v };
    }),
  };
}

/** Sixteen steps of active, note, velocity, gate — the sequencer's face layout. */
function stepFace(spec: NonNullable<PresetSpec["steps"]>): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    const page = i % 16;
    out.push(
      spec.on.includes(page) ? 1 : 0,
      spec.notes?.[page] ?? 60,
      spec.velocity?.[page] ?? 0.9,
      0.5,
    );
  }
  return out;
}

function build(spec: PresetSpec): Project {
  const pages = spec.pages.map((page, pi) => ({
    id: `p${pi + 1}`,
    name: page.name,
    blocks: page.blocks
      .map((b) => {
        const made = instantiate(b.type);
        if (!made) return null;
        return {
          ...withParams(made, b.params),
          name: b.name ?? made.name,
          span: b.box?.[0] ?? made.span,
          rows: b.box?.[1] ?? made.rows,
          face:
            b.type === "seq" && spec.steps ? stepFace(spec.steps)
            : b.type === "patch" && spec.patch ? patchFace(spec.patch)
            : made.face,
        };
      })
      .filter(Boolean) as BlockInstance[],
  }));

  const flat = pages.flatMap((p) => p.blocks);

  return {
    name: spec.name.toLowerCase(),
    size: SIZES.find((s) => s.name === spec.size) ?? SIZES[0]!,
    accent: spec.accent,
    pages,
    wires: (spec.wires ?? [])
      .filter(([a, b]) => flat[a] && flat[b])
      .map(([a, b]) => ({ from: flat[a]!.uid, to: flat[b]!.uid })),
  };
}

/**
 * Six sources by however many destinations, source-major.
 *
 * The width is imported rather than written as a literal: a preset stores the
 * pair, not the index, so adding a destination cannot silently move an existing
 * cable — but only if both sides agree on the stride, and a 6 typed here would
 * be the one place that stopped agreeing.
 */
function patchFace(cables: Array<[number, number]>): number[] {
  const cells = new Array(NUM_SOURCES * NUM_TARGETS).fill(0);
  for (const [src, dst] of cables) cells[src * NUM_TARGETS + dst] = 1;
  return cells;
}

export type Preset = { id: string; name: string; note: string; make: () => Project };

export const PRESETS: Preset[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  note: spec.note,
  // Built on demand: every block instance needs its own uid, so loading the
  // same preset twice has to produce two different projects.
  make: () => build(spec),
}));
