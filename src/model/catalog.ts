import type { BlockDef, Param } from "./types.ts";

/**
 * The block catalogue.
 *
 * A block is a panel with parameters, ports and sometimes a face. That maps
 * onto how the instruments are already built — bleep and enzyme are both a grid
 * of panels, each owning a few parameters — and onto how they are wired, which
 * the layout alone never expressed.
 *
 * These are mock blocks: nothing here makes sound. `from` says where the DSP
 * lives today, and "— not built" means exactly that. Keeping the gap visible
 * while using the tool is the point; a catalogue that hides which half is real
 * would let us design against DSP that does not exist. That ordering is
 * deliberate anyway — the tool is what tells us what a block has to expose, and
 * guessing before building it is how you get an abstraction nobody can use.
 */

type Spec = Omit<Param, "id">;

const knob = (label: string, value = 0.5): Spec => ({ label, kind: "knob", value });
const fader = (label: string, value = 0.5): Spec => ({ label, kind: "fader", value });
const choice = (label: string, options: string[], value = 0): Spec => ({ label, kind: "choice", value, options });
const toggle = (label: string, on = false): Spec => ({ label, kind: "toggle", value: on ? 1 : 0 });
const mix = (value = 0.35) => knob("Mix", value);

/** Not in the audio path — a modulator or a display. */
const mod: BlockDef["ports"] = { audioIn: 0, audioOut: 0, modOut: true };
const gen: BlockDef["ports"] = { audioIn: 0, audioOut: 1, modOut: false };
const fx: BlockDef["ports"] = { audioIn: 1, audioOut: 1, modOut: false };
const sink: BlockDef["ports"] = { audioIn: 1, audioOut: 0, modOut: false };
const passive: BlockDef["ports"] = { audioIn: 0, audioOut: 0, modOut: false };

export const CATALOG: BlockDef[] = [
  /* ── Source ───────────────────────────────────────────────────────── */
  {
    // Sync is appended rather than slotted in beside Wave: parameters are
    // addressed by index, so inserting one in the middle silently re-points
    // every knob after it at the wrong thing.
    type: "osc", name: "Oscillator", group: "Source", from: "bleep · Oscillator.h",
    ports: gen, defaultSpan: 5,
    params: [
      // The order is Oscillator::Mode's, not a nicer one. The list used to read
      // Saw/Square/Sine/FM against an enum of Sine/Triangle/Saw/Square/FM, so
      // every label named the wrong wave and Triangle could not be chosen at
      // all. A choice list is an address into C++, not a menu.
      choice("Wave", ["Sine", "Tri", "Saw", "Square", "FM"], 2),
      knob("Tune"), knob("Fine"), knob("Level", 0.8), knob("PW"), knob("Sync", 0),
    ],
  },
  {
    type: "sub", name: "Sub", group: "Source", from: "bleep · Voice.cpp",
    ports: gen, defaultSpan: 3,
    params: [knob("Level", 0.4), choice("Octave", ["-1", "-2"]), choice("Shape", ["Sine", "Square"])],
  },
  {
    type: "noise", name: "Noise", group: "Source", from: "enzyme · Dirt",
    ports: gen, defaultSpan: 3,
    params: [choice("Kind", ["White", "Crackle", "Geiger", "Burst"]), knob("Level", 0.2), knob("Colour")],
  },
  {
    type: "wavetable", name: "Wavetable", group: "Source", from: "— not built",
    ports: gen, defaultSpan: 5, face: "scope",
    params: [choice("Table", ["Basic", "Metal", "Vox", "Glass"]), knob("Position", 0.3), knob("Warp"), knob("Level", 0.8)],
  },
  {
    type: "sampler", name: "Sampler", group: "Source", from: "enzyme · Layer.cpp",
    ports: gen, defaultSpan: 5, face: "scope",
    params: [knob("Start", 0), knob("Length", 1), knob("Tune"), knob("Level", 0.8), toggle("Loop", true)],
  },
  {
    type: "fmop", name: "FM operator", group: "Source", from: "bleep · Oscillator.h",
    ports: gen, defaultSpan: 4,
    params: [knob("Ratio", 0.25), knob("Index", 0.4), knob("Feedback", 0.1), knob("Level", 0.7)],
  },
  {
    type: "string", name: "String", group: "Source", from: "i4 · RingResonator.cpp",
    ports: gen, defaultSpan: 4,
    params: [knob("Pitch"), knob("Damping", 0.4), knob("Position", 0.3), knob("Level", 0.7)],
  },

  /* ── Shape ────────────────────────────────────────────────────────── */
  {
    type: "filter", name: "Filter", group: "Shape", from: "bleep · Voice.cpp",
    ports: fx, defaultSpan: 5,
    params: [choice("Mode", ["LP24", "LP12", "HP12", "BP12", "Notch"]), knob("Cutoff", 0.7), knob("Reso", 0.2), knob("Env", 0.3), knob("Key")],
  },
  {
    type: "formant", name: "Formant", group: "Shape", from: "— not built",
    ports: fx, defaultSpan: 4,
    params: [choice("Vowel", ["A", "E", "I", "O", "U"]), knob("Morph"), knob("Width", 0.4), mix(1)],
  },
  {
    type: "comb", name: "Comb", group: "Shape", from: "i4 · RingResonator.cpp",
    ports: fx, defaultSpan: 3,
    params: [knob("Tune", 0.4), knob("Feedback", 0.5), mix()],
  },
  {
    // Five named curves rather than one tanh with a knob on it. enzyme wrote
    // them because "more drive" and "a different kind of drive" are different
    // requests, and a single curve can only answer the first.
    type: "drive", name: "Character", group: "Shape", from: "enzyme · LoFiMangle.cpp",
    ports: fx, defaultSpan: 5,
    params: [
      choice("Type", ["PNP", "Tube", "Pickup", "Diode", "Crunch"]),
      knob("Drive", 0.4), knob("Bias"), knob("Tone", 0.5), mix(1),
    ],
  },
  {
    type: "fold", name: "Wavefolder", group: "Shape", from: "— not built",
    ports: fx, defaultSpan: 3,
    params: [knob("Fold", 0.3), knob("Symmetry"), mix(1)],
  },
  {
    type: "crush", name: "Bitcrusher", group: "Shape", from: "enzyme · LoFiMangle.cpp",
    ports: fx, defaultSpan: 4,
    params: [knob("Bits", 0.8), knob("Rate", 0.9), knob("Jitter", 0.1), mix()],
  },
  {
    // Its own block, though the Bitcrusher has a Rate knob, because bit depth
    // and sample rate are unrelated damage: one quantises amplitude, the other
    // time. enzyme fuses them in a fixed order and you cannot have the aliasing
    // without the quantisation noise. Here you can.
    type: "downsmp", name: "Downsample", group: "Shape", from: "enzyme · LoFiMangle.cpp",
    ports: fx, defaultSpan: 3,
    params: [knob("Rate", 0.15), knob("Smooth", 0), mix(1)],
  },
  {
    type: "eq", name: "EQ", group: "Shape", from: "— not built",
    ports: fx, defaultSpan: 5, face: "spectrum",
    params: [fader("Low"), fader("Lo mid"), fader("Hi mid"), fader("High")],
  },
  {
    type: "gate", name: "Gate", group: "Shape", from: "— not built",
    ports: fx, defaultSpan: 4,
    params: [knob("Thresh", 0.3), knob("Attack", 0.05), knob("Hold", 0.2), knob("Release", 0.3)],
  },
  {
    // i4 spends this as a macro inside both Deform and Ring, where it biases
    // gain across a band split. On its own it is a tilt EQ — one knob that
    // takes the whole spectrum from dark to bright through flat, which is a
    // more useful first move than four bands are.
    type: "tilt", name: "Tilt", group: "Shape", from: "i4 · DeformEngine.cpp",
    ports: fx, defaultSpan: 3,
    params: [knob("Tilt"), knob("Pivot", 0.5), knob("Gain", 0.5)],
  },

  /* ── Modulate ─────────────────────────────────────────────────────── */
  {
    type: "env", name: "Envelope", group: "Modulate", from: "three implementations, none shared",
    ports: mod, defaultSpan: 5, face: "curve",
    params: [knob("A", 0.1), knob("D", 0.4), knob("S", 0.6), knob("R", 0.3), knob("Curve"), knob("Vel", 0.4)],
  },
  {
    type: "env2", name: "Mod envelope", group: "Modulate", from: "— not built",
    ports: mod, defaultSpan: 6, face: "curve",
    params: [knob("Delay", 0), knob("A", 0.2), knob("D", 0.5), knob("S", 0.3), knob("R", 0.4), knob("Curve"), knob("Amount", 0.5)],
  },
  {
    type: "lfo", name: "LFO", group: "Modulate", from: "bleep · Voice.cpp",
    ports: mod, defaultSpan: 4,
    params: [choice("Shape", ["Sine", "Tri", "Square", "S&H"]), knob("Rate", 0.35), knob("Depth"), toggle("Sync", true)],
  },
  {
    type: "random", name: "Random", group: "Modulate", from: "— not built",
    ports: mod, defaultSpan: 4,
    params: [choice("Mode", ["S&H", "Drift", "Walk"]), knob("Rate", 0.4), knob("Amount", 0.5), knob("Smooth", 0.2)],
  },
  {
    type: "follow", name: "Follower", group: "Modulate", from: "— not built",
    ports: mod, defaultSpan: 3,
    params: [knob("Attack", 0.1), knob("Release", 0.4), knob("Gain", 0.6)],
  },
  {
    // Rate, Swing, Gate and Loop described a metronome. A sequencer's globals
    // are a tempo, a division, how much it shuffles, how long the notes are,
    // how many steps before it wraps, and whether it is running. What each step
    // *plays* is not a parameter — sixteen steps of note, velocity and gate is
    // sixty-four numbers and a parameter list is the wrong shape for it. Those
    // live in the grid.
    // minSpan 3, not 5: it was 5 when sixteen steps had to fit on one row.
    // The grid wraps to eight by two now, so a narrow sequencer is a shape the
    // block can actually take.
    type: "seq", name: "Sequencer", group: "Modulate", from: "bleep · Sequencer.cpp",
    ports: mod, defaultSpan: 10, minSpan: 4, face: "steps",
    params: [
      knob("Tempo", 0.4),
      choice("Rate", ["1/4", "1/8", "1/8T", "1/16", "1/16T", "1/32"], 3),
      knob("Swing", 0),
      knob("Gate", 0.5),
      knob("Length", 1),
      toggle("Run", false),
    ],
  },
  {
    type: "arp", name: "Arpeggiator", group: "Modulate", from: "— not built",
    ports: mod, defaultSpan: 5,
    params: [choice("Mode", ["Up", "Down", "Up/Dn", "Random"]), knob("Rate", 0.5), knob("Octaves", 0.25), knob("Gate", 0.5)],
  },
  {
    type: "keytrack", name: "Key tracking", group: "Modulate", from: "— not built",
    ports: mod, defaultSpan: 3,
    params: [knob("Amount", 0.5), knob("Centre"), choice("Curve", ["Lin", "Exp"])],
  },
  {
    // Three i4 engines depend on this and none of them presents it as a
    // feature. On its own it is the most useful block here for someone who
    // does not read music: patch it between anything and a pitch and wrong
    // notes stop being possible.
    // In is a real parameter, not a hidden signal port. That is what lets the
    // patch bay reach it with the machinery it already has — a cable into
    // Scale · In is the same kind of thing as a cable into Filter · Cutoff —
    // and it means the block still does something with nothing patched, which
    // a transformer with only a signal input never can.
    type: "scale", name: "Scale", group: "Modulate", from: "i4 · ScaleQuantizer.h",
    ports: mod, defaultSpan: 6, face: "degrees",
    params: [
      knob("In", 0.5),
      choice("Root", ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]),
      choice("Scale", [
        "Chrom", "Major", "Minor", "Dorian", "Lydian", "Mixo", "S-Loc",
        "Hex-A", "Hex-D", "Blues", "Pent", "Hira", "Kumoi",
        "Iwato", "Whole", "Pelog", "Tetra", "Fifths", "Oct", "Free",
      ], 1),
      knob("Range", 0.5),
      knob("Amount", 1),
    ],
  },
  {
    // Both plugins write this inline, twice, and neither exposes it. A held
    // value with its own clock is half of what makes a modular sound modular.
    type: "sh", name: "Sample & hold", group: "Modulate", from: "i4 + enzyme, written inline in both",
    ports: mod, defaultSpan: 4,
    params: [knob("Rate", 0.4), knob("Slew", 0), knob("Amount", 0.7), choice("Source", ["Noise", "Ramp", "Sine"])],
  },
  {
    // i4's Tape hides this as `glideMs`. As a block it is a slew limiter, and
    // it is the difference between a modulation that steps and one that moves.
    type: "slew", name: "Glide", group: "Modulate", from: "i4 · TapeEngine.h",
    ports: mod, defaultSpan: 4,
    params: [knob("In", 0.5), knob("Time", 0.3), knob("Curve", 0.5), choice("Mode", ["Both", "Rise", "Fall"])],
  },

  /* ── Effect ───────────────────────────────────────────────────────── */
  {
    type: "delay", name: "Delay", group: "Effect", from: "bleep · FxChain.cpp",
    ports: fx, defaultSpan: 6,
    params: [knob("Time", 0.4), knob("Feedback", 0.35), knob("Spread", 0.5), knob("Tone", 0.6), mix(0.25), toggle("Sync", true)],
  },
  {
    type: "reverb", name: "Reverb", group: "Effect", from: "bleep · FxChain.cpp",
    ports: fx, defaultSpan: 6,
    params: [knob("Size", 0.55), knob("Decay", 0.5), knob("Damp", 0.4), knob("Pre", 0.1), knob("Width", 0.7), mix(0.3)],
  },
  {
    type: "chorus", name: "Chorus", group: "Effect", from: "bleep · FxChain.cpp",
    ports: fx, defaultSpan: 5,
    params: [knob("Rate", 0.3), knob("Depth", 0.4), choice("Voices", ["2", "4", "6"]), knob("Spread", 0.6), mix(0.3)],
  },
  {
    type: "phaser", name: "Phaser", group: "Effect", from: "— not built",
    ports: fx, defaultSpan: 5,
    params: [knob("Rate", 0.25), knob("Depth", 0.6), choice("Stages", ["4", "6", "8", "12"]), knob("Feedback", 0.3), mix(0.4)],
  },
  {
    type: "flanger", name: "Flanger", group: "Effect", from: "— not built",
    ports: fx, defaultSpan: 4,
    params: [knob("Rate", 0.2), knob("Depth", 0.5), knob("Feedback", 0.45), mix(0.4)],
  },
  {
    type: "comp", name: "Compressor", group: "Effect", from: "— not built",
    ports: fx, defaultSpan: 6, face: "meter",
    params: [knob("Thresh", 0.6), knob("Ratio", 0.35), knob("Attack", 0.2), knob("Release", 0.4), knob("Makeup", 0.3)],
  },
  {
    type: "limiter", name: "Limiter", group: "Effect", from: "— not built",
    ports: fx, defaultSpan: 4, face: "meter",
    params: [knob("Ceiling", 0.95), knob("Release", 0.4)],
  },
  {
    type: "tape", name: "Tape", group: "Effect", from: "enzyme · LoFiMangle.cpp",
    ports: fx, defaultSpan: 5,
    params: [knob("Wow", 0.2), knob("Flutter", 0.15), knob("Sat", 0.4), knob("Hiss", 0.1), mix(1)],
  },
  {
    type: "grain", name: "Granular", group: "Effect", from: "i4 · MosaicEngine.cpp",
    ports: fx, defaultSpan: 5,
    params: [knob("Size", 0.4), knob("Spray", 0.3), knob("Pitch"), knob("Density", 0.5), mix(0.6)],
  },
  {
    type: "ring", name: "Resonator", group: "Effect", from: "i4 · RingResonator.cpp",
    ports: fx, defaultSpan: 4,
    params: [knob("Pitch"), knob("Decay", 0.6), knob("Tone", 0.4), mix(0.3)],
  },
  {
    type: "width", name: "Stereo", group: "Effect", from: "— not built",
    ports: fx, defaultSpan: 4,
    params: [knob("Width", 0.6), knob("Pan"), toggle("Bass mono", true)],
  },
  {
    type: "fxchain", name: "FX chain", group: "Effect", from: "bleep · FxChain.cpp",
    ports: fx, defaultSpan: 5,
    params: [knob("Chorus", 0.3), knob("Delay", 0.25), knob("Reverb", 0.4), mix()],
  },

  /* ── Route ────────────────────────────────────────────────────────── */
  {
    type: "patch", name: "Patch bay", group: "Route", from: "bleep · patch_* params",
    ports: passive, defaultSpan: 7, minSpan: 5, face: "matrix",
    params: [knob("Depth", 0.5), knob("Slew", 0.1)],
  },
  {
    type: "macros", name: "Macros", group: "Route", from: "— not built",
    ports: mod, defaultSpan: 4,
    params: [knob("M1"), knob("M2"), knob("M3"), knob("M4")],
  },
  {
    type: "mixer", name: "Mixer", group: "Route", from: "— not built",
    ports: sink, defaultSpan: 5, face: "meter",
    params: [fader("A", 0.7), fader("B", 0.6), fader("C", 0.5), fader("D", 0.4)],
  },
  {
    type: "voice", name: "Voice", group: "Route", from: "enzyme · EnzymeVoice",
    ports: passive, defaultSpan: 5,
    params: [choice("Mode", ["Poly", "Mono", "Legato"]), knob("Unison", 0.25), knob("Detune", 0.2), knob("Spread", 0.5), knob("Glide", 0)],
  },
  {
    type: "split", name: "Crossover", group: "Route", from: "— not built",
    ports: fx, defaultSpan: 4,
    params: [knob("Freq", 0.5), choice("Slope", ["12", "24", "48"]), knob("Balance")],
  },
  {
    type: "out", name: "Output", group: "Route", from: "every plugin, written three times",
    ports: sink, defaultSpan: 3, face: "meter",
    params: [knob("Level", 0.8)],
  },

  /* ── Display ──────────────────────────────────────────────────────── */
  {
    type: "screen", name: "Screen", group: "Display", from: "skeleton · PixelRack",
    ports: passive, defaultSpan: 5, minSpan: 3, face: "screen",
    params: [choice("Mode", ["Bloom", "Bars", "Mirror"], 2), knob("Rate", 0.5), knob("Tilt", 0.5), knob("Decay", 0.4)],
  },
  {
    type: "scope", name: "Scope", group: "Display", from: "— not built",
    ports: passive, defaultSpan: 4, face: "scope",
    params: [knob("Time", 0.4), knob("Gain", 0.6), choice("Trace", ["Line", "Dots"])],
  },
  {
    type: "analyser", name: "Analyser", group: "Display", from: "skeleton · RackAnalysis",
    ports: passive, defaultSpan: 5, face: "spectrum",
    params: [choice("Bands", ["16", "24", "32", "48"], 1), knob("Tilt", 0.5), knob("Smooth", 0.4)],
  },
  {
    type: "meter", name: "Meter", group: "Display", from: "skeleton · RackAnalysis",
    ports: passive, defaultSpan: 3, face: "meter",
    params: [knob("Hold", 0.6)],
  },
  {
    type: "keys", name: "Keyboard", group: "Display", from: "— not built",
    ports: passive, defaultSpan: 7, minSpan: 4, face: "keys",
    params: [choice("Range", ["1 oct", "2 oct", "3 oct", "5 oct"], 1)],
  },
  {
    type: "xy", name: "XY pad", group: "Display", from: "— not built",
    ports: mod, defaultSpan: 3, face: "xy",
    params: [choice("Grid", ["Off", "3×3", "5×5"], 1)],
  },
  {
    type: "pads", name: "Pads", group: "Display", from: "— not built",
    ports: mod, defaultSpan: 4, minSpan: 3, face: "pads",
    params: [choice("Cols", ["4", "8"]), choice("Rows", ["4", "2", "1"])],
  },
  {
    type: "readout", name: "Readout", group: "Display", from: "skeleton · ModuleReadout",
    ports: passive, defaultSpan: 3, face: "readout",
    params: [choice("Source", ["Voice", "Engine", "Perf"]), knob("Rate", 0.5)],
  },
];

/**
 * How much height each face wants before it starts looking cramped, in row
 * units. A face absorbs whatever height is left over, so these are floors
 * rather than fixed sizes.
 */
const FACE_ROWS: Record<string, number> = {
  screen: 5, scope: 4, spectrum: 4, curve: 4, meter: 4,
  // The grid plus its lane and pattern rows; and the patch bay needs room for
  // six jacks a side with cables between them, which a matrix of dots did not.
  matrix: 9, steps: 8, xy: 6, keys: 4, pads: 5, readout: 4, degrees: 4,
};

/**
 * A block's starting height.
 *
 * Derived rather than authored forty-nine times: a header, whatever the face
 * needs, and a row for the controls. Getting this close means a fresh block
 * lands snug instead of arriving with a hole in it that you then have to drag
 * shut — which was most of the dead space in the first layouts.
 */
export const rowsFor = (def: BlockDef) =>
  def.defaultRows ?? Math.max(def.minRows ?? 3, 2 + (def.face ? FACE_ROWS[def.face] ?? 4 : 0) + (def.params.length ? 4 : 0));

export const minRowsFor = (def: BlockDef) =>
  def.minRows ?? Math.max(3, (def.face ? Math.ceil((FACE_ROWS[def.face] ?? 4) / 2) + 2 : 0) + (def.params.length ? 3 : 0));

export const byType = (type: string) => CATALOG.find((d) => d.type === type);

export { GROUPS } from "./types.ts";
