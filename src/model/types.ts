/**
 * Socket's domain model.
 *
 * Four concepts the first prototype was missing, each of which turned out to be
 * structural rather than a feature:
 *
 *   Pages   — a plugin is not one face. bleep has Synth and FX, enzyme has five.
 *             Tabs painted onto a frame are decoration; pages that own their own
 *             layout are what a plugin actually is.
 *   Ports   — a block that only has parameters cannot be wired to anything, so
 *             block order was purely visual. Audio has to be a separate
 *             dimension from layout, because in a real instrument it is.
 *   Params  — nameable and reorderable, because what a knob is called and where
 *             it sits is most of the design work in a plugin panel.
 *   Faces   — a patch bay, a step grid and a keyboard are not knobs. A plugin
 *             that can only be built out of knobs is not a plugin builder, and
 *             hardcoding two of them into the renderer, as the prototype did,
 *             puts a ceiling on the catalogue at two.
 */

export type ParamKind = "knob" | "choice" | "toggle" | "fader";

export type Param = {
  id: string;
  label: string;
  kind: ParamKind;
  value: number;
  /** choice only */
  options?: string[];
};

/**
 * The non-parameter widgets a block can draw.
 *
 * Each name is dispatched through one registry in design/faces.tsx, so adding a
 * block that shows something new is one entry there and one word here.
 */
export type Face =
  | "screen" | "scope" | "spectrum" | "meter" | "curve"
  | "matrix" | "steps" | "xy" | "keys" | "pads" | "readout";

/** What a block accepts and produces. Empty means it is not in the audio path. */
export type Ports = { audioIn: number; audioOut: number; modOut: boolean };

export const GROUPS = ["Source", "Shape", "Modulate", "Effect", "Route", "Display"] as const;
export type Group = (typeof GROUPS)[number];

export type BlockDef = {
  type: string;
  name: string;
  /** Which family it belongs to, for grouping the palette. */
  group: Group;
  /** Where the DSP lives today, so the gap stays visible while using the tool. */
  from: string;
  ports: Ports;
  defaultSpan: number;
  /** Minimum columns this block reads at — a patch bay at 3 wide is unusable. */
  minSpan?: number;
  face?: Face;
  params: Omit<Param, "id">[];
};

export type BlockInstance = {
  uid: string;
  type: string;
  /** Overrides the definition's name, so two filters can be told apart. */
  name: string;
  span: number;
  params: Param[];
  /**
   * Face-local state — a patch point, a step pattern, an XY position.
   *
   * One untyped array, because the face is the only thing that can interpret
   * it, and giving each face its own field on the instance would put every
   * widget's schema into the core model. Empty means "your defaults".
   */
  face: number[];
};

export type Page = {
  id: string;
  name: string;
  blocks: BlockInstance[];
};

/** One audio connection, block uid to block uid. */
export type Wire = { from: string; to: string };

export type Size = { name: string; w: number; h: number; from?: string };

export const ACCENTS = ["blue", "rose", "amber", "violet", "green"] as const;
export type Accent = (typeof ACCENTS)[number];

export type Project = {
  name: string;
  size: Size;
  accent: Accent;
  pages: Page[];
  /** Signal flow is global, not per page — a filter on the FX page still
      processes the oscillator from the Synth page. Tying wires to a page would
      encode a layout decision as an audio one. */
  wires: Wire[];
};

/**
 * Real editor sizes from the instruments.
 *
 * Their spread is the point — wide and short, tall, large — so a first layout
 * starts from a shape proven to hold a working instrument rather than a guess.
 */
export const SIZES: Size[] = [
  { name: "Wide", w: 1180, h: 560, from: "akaBleep" },
  { name: "Tall", w: 1080, h: 760, from: "Enzyme" },
  { name: "Large", w: 1380, h: 820, from: "i4" },
  { name: "Compact", w: 900, h: 480 },
];
