import { byType, CATALOG, rowsFor } from "./catalog";
import type { BlockInstance, Page, Project } from "./types";
import { SIZES } from "./types";

/**
 * Project operations.
 *
 * Pure functions returning new state rather than methods on a class, so every
 * change is a value the UI can hold, compare and eventually undo. The store is
 * deliberately thin over these.
 */

let counter = 0;
const uid = (type: string) => `${type}-${++counter}`;

export function instantiate(type: string): BlockInstance | null {
  const def = byType(type);
  if (!def) return null;
  return {
    uid: uid(type),
    type,
    name: def.name,
    span: def.defaultSpan,
    rows: rowsFor(def),
    params: def.params.map((p, i) => ({ ...p, id: `${p.label.toLowerCase()}-${i}` })),
    face: [],
  };
}

export const initialProject = (): Project => {
  /**
   * Something already built, rather than an empty window.
   *
   * Three pages that between them use a source, a shape, a modulator, an
   * effect, a display and the patch bay — enough that the shape of the tool is
   * legible before you have added anything, and close enough to how bleep is
   * actually laid out to be worth arguing with.
   */
  const make = (types: string[]) => types.map(instantiate).filter(Boolean) as BlockInstance[];
  const synth = make(["osc", "filter", "env", "screen"]);
  const mod = make(["lfo", "seq", "patch"]);
  const fx = make(["delay", "reverb", "out"]);

  return {
    name: "untitled",
    size: SIZES[0]!,
    accent: "blue",
    pages: [
      { id: "p1", name: "Synth", blocks: synth },
      { id: "p2", name: "Mod", blocks: mod },
      { id: "p3", name: "FX", blocks: fx },
    ],
    // Wired the obvious way to start: source into shape into effects into out.
    // Shows what the signal view is for without making someone build a chain
    // before they can see one.
    wires: chain([synth[0], synth[1], fx[0], fx[1], fx[2]]),
  };
};

/** Consecutive pairs of whatever actually exists. */
const chain = (blocks: (BlockInstance | undefined)[]) => {
  const real = blocks.filter(Boolean) as BlockInstance[];
  return real.slice(0, -1).map((b, i) => ({ from: b.uid, to: real[i + 1]!.uid }));
};

export const allBlocks = (p: Project): BlockInstance[] => p.pages.flatMap((pg) => pg.blocks);

export const findBlock = (p: Project, uid: string) =>
  allBlocks(p).find((b) => b.uid === uid) ?? null;

export const pageOf = (p: Project, uid: string): Page | null =>
  p.pages.find((pg) => pg.blocks.some((b) => b.uid === uid)) ?? null;

/** Blocks that can sit in the audio path, in the order they were added. */
export const audioBlocks = (p: Project) =>
  allBlocks(p).filter((b) => {
    const d = byType(b.type);
    return !!d && (d.ports.audioIn > 0 || d.ports.audioOut > 0);
  });

export const modBlocks = (p: Project) =>
  allBlocks(p).filter((b) => byType(b.type)?.ports.modOut);

export { CATALOG };
