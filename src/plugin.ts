/**
 * Plugin-level settings — the thing the blocks go inside.
 *
 * The first version had no plugin, only a grid of panels floating in a dark
 * area, and that is why it did not read as a plugin editor. A real editor is a
 * fixed-size window: the whole discipline of laying one out comes from having a
 * bounded canvas that everything has to fit inside. Without the frame there is
 * no layout problem to solve, and therefore nothing to design.
 */

export type Size = { name: string; w: number; h: number; from?: string };

/**
 * Real editor sizes from the instruments, because those are proven to hold a
 * working layout — and their spread is the point. bleep is wide and short,
 * enzyme tall, i4 large. Someone laying out their first plugin should start from
 * a shape that works rather than from a guess.
 */
export const SIZES: Size[] = [
  { name: "Wide", w: 1180, h: 560, from: "akaBleep" },
  { name: "Tall", w: 1080, h: 760, from: "Enzyme" },
  { name: "Large", w: 1380, h: 820, from: "i4" },
  { name: "Compact", w: 900, h: 480 },
];

export const ACCENTS = ["blue", "rose", "amber", "violet", "green"] as const;
export type Accent = (typeof ACCENTS)[number];

export type PluginState = {
  name: string;
  size: Size;
  accent: Accent;
};

export const initialPlugin: PluginState = {
  name: "untitled",
  size: SIZES[0]!,
  accent: "blue",
};
