/**
 * The block catalogue.
 *
 * A block is a panel with controls — that is the unit you compose a plugin out
 * of, and it maps onto how the instruments are already built: bleep and enzyme
 * are both a grid of panels, each owning a few parameters.
 *
 * These are mock blocks. Every one of them corresponds to DSP that exists today
 * inside bleep, enzyme or i4 and has not been extracted yet, so the parameters
 * are real but nothing makes sound. That is deliberate ordering: the composition
 * UI is what tells us what a block has to expose, and guessing that before
 * building the UI is how you get an abstraction nobody can use.
 */

export type ParamKind = "knob" | "choice";

export type Param = {
  id: string;
  label: string;
  kind: ParamKind;
  /** Knobs only: 0..1 default. */
  value?: number;
  /** Choices only. */
  options?: string[];
  selected?: number;
};

export type BlockDef = {
  type: string;
  name: string;
  /** Where the DSP for this currently lives, so the gap stays visible. */
  from: string;
  /** Grid columns the panel spans, out of 12. */
  span: number;
  params: Param[];
};

const knob = (id: string, label: string, value = 0.5): Param => ({ id, label, kind: "knob", value });
const choice = (id: string, label: string, options: string[], selected = 0): Param => ({
  id, label, kind: "choice", options, selected,
});

export const CATALOG: BlockDef[] = [
  {
    type: "osc",
    name: "Oscillator",
    from: "bleep · Oscillator.h",
    span: 4,
    params: [
      choice("wave", "Wave", ["Saw", "Square", "Sine", "FM"]),
      knob("tune", "Tune", 0.5),
      knob("level", "Level", 0.8),
      knob("pw", "PW", 0.5),
    ],
  },
  {
    type: "filter",
    name: "Filter",
    from: "bleep · Voice.cpp",
    span: 4,
    params: [
      choice("mode", "Mode", ["LP24", "LP12", "HP12", "BP12"]),
      knob("cutoff", "Cutoff", 0.7),
      knob("reso", "Reso", 0.2),
      knob("env", "Env", 0.3),
    ],
  },
  {
    type: "env",
    name: "Envelope",
    from: "three implementations, none shared",
    span: 4,
    params: [knob("a", "A", 0.1), knob("d", "D", 0.4), knob("s", "S", 0.6), knob("r", "R", 0.3)],
  },
  {
    type: "lfo",
    name: "LFO",
    from: "bleep · Voice.cpp",
    span: 3,
    params: [choice("shape", "Shape", ["Sine", "Tri", "Square", "S&H"]), knob("rate", "Rate", 0.35), knob("depth", "Depth", 0.5)],
  },
  {
    type: "drive",
    name: "Character",
    from: "enzyme · LoFiMangle.cpp",
    span: 3,
    params: [knob("drive", "Drive", 0.4), knob("bits", "Bits", 0.8), knob("mix", "Mix", 0.5)],
  },
  {
    type: "fx",
    name: "FX chain",
    from: "bleep · FxChain.cpp",
    span: 5,
    params: [knob("chorus", "Chorus", 0.3), knob("delay", "Delay", 0.25), knob("reverb", "Reverb", 0.4), knob("mix", "Mix", 0.5)],
  },
  {
    type: "grain",
    name: "Granular",
    from: "i4 · MosaicEngine.cpp",
    span: 4,
    params: [knob("size", "Size", 0.4), knob("spray", "Spray", 0.3), knob("pitch", "Pitch", 0.5), knob("mix", "Mix", 0.6)],
  },
  {
    type: "screen",
    name: "Screen",
    from: "skeleton · PixelRack",
    span: 3,
    params: [],
  },
];

/** A block placed on the canvas. */
export type Placed = BlockDef & { uid: string };

let counter = 0;
export const place = (def: BlockDef): Placed => ({
  ...def,
  uid: `${def.type}-${++counter}`,
  params: def.params.map((p) => ({ ...p })),
});
