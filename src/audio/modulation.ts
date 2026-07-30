import { byType } from "@/model/catalog";
import type { BlockInstance, Project } from "@/model/types";
import { IMPLEMENTED } from "./engine";

/**
 * What a cable connects, in terms of blocks that actually exist.
 *
 * The patch bay used to name six sources and six destinations that meant
 * nothing — OSC, CUTOFF, FOLD were labels on a grid, not addresses. A cable
 * that does not resolve to a real parameter on a real block is a picture of
 * routing, and the whole point of a patch bay is that the routing is the thing
 * you can see.
 *
 * So both sides resolve against the project. Sources are the modulator blocks
 * you have placed, by name. Destinations stay a fixed vocabulary — the six
 * things a synth is nearly always modulating — but each one resolves to the
 * first block that can be that thing, and reports honestly when nothing can.
 */

/**
 * Blocks whose output is a modulation signal a shared destination can use.
 *
 * Deliberately not the envelopes. An envelope belongs to a voice, and eight
 * voices have eight of them — pointing one at a single filter's cutoff has no
 * answer to "which voice's". That routing already exists where it makes sense:
 * the Filter's own Env knob, applied per voice inside the voice. Listing an
 * envelope here would draw a cable that quietly does nothing, which is worse
 * than not offering it.
 *
 * Same reason excludes Follower and Key tracking.
 */
const MOD_SOURCES = ["lfo", "seq", "random", "xy", "macros", "arp"];

/**
 * A jack label has about six characters.
 *
 * Taken from the block's type rather than its name, so "Envelope" does not
 * become "ENVELO". A renamed block uses the name — if you called it something,
 * that is what you will look for.
 */
const SHORT: Record<string, string> = {
  lfo: "LFO", seq: "SEQ", random: "RND", xy: "XY", macros: "MACRO", arp: "ARP",
};

export type ModSource = {
  /** Index in the flat block list — the engine's address. */
  block: number;
  label: string;
  live: boolean;
};

export type ModTarget = {
  name: string;
  block: number;
  param: number;
  /** What it resolved to, for the tooltip. Empty when nothing matched. */
  via: string;
};

/**
 * The six destinations, in order of preference.
 *
 * Each is a list of (block type, parameter label) pairs tried in turn, so
 * CUTOFF finds a Filter if you have one and a Comb if you do not. Falling back
 * rather than going dark is what makes the panel useful before the instrument
 * is finished — but it never invents a target, and a jack with nothing behind
 * it says so.
 */
const TARGETS: Array<{ name: string; tries: Array<[string, string]> }> = [
  { name: "PITCH",  tries: [["osc", "Tune"], ["wavetable", "Position"], ["fmop", "Ratio"], ["string", "Pitch"], ["sub", "Level"]] },
  { name: "CUTOFF", tries: [["filter", "Cutoff"], ["formant", "Morph"], ["comb", "Tune"], ["eq", "Hi mid"]] },
  { name: "LEVEL",  tries: [["out", "Level"], ["osc", "Level"], ["mixer", "A"]] },
  { name: "FOLD",   tries: [["fold", "Fold"], ["drive", "Drive"], ["crush", "Bits"], ["comb", "Feedback"]] },
  { name: "PAN",    tries: [["width", "Pan"], ["formant", "Width"], ["comb", "Mix"]] },
  { name: "SEND",   tries: [["delay", "Mix"], ["reverb", "Mix"], ["fxchain", "Mix"], ["drive", "Mix"]] },
];

const flat = (project: Project): BlockInstance[] => project.pages.flatMap((p) => p.blocks);

/** The modulators you have placed, in the order they appear. Six jacks' worth. */
export function modSources(project: Project): ModSource[] {
  const blocks = flat(project);
  const found: ModSource[] = [];

  blocks.forEach((b, i) => {
    if (found.length >= 6 || !MOD_SOURCES.includes(b.type)) return;
    const def = byType(b.type);
    const renamed = def && b.name !== def.name;
    const label = renamed ? b.name.toUpperCase().slice(0, 6) : (SHORT[b.type] ?? b.type.toUpperCase().slice(0, 6));
    found.push({ block: i, label, live: IMPLEMENTED.has(b.type) });
  });

  // Empty jacks rather than a short row: six is the shape of the panel, and a
  // patch bay that changes size as you add blocks is a patch bay you cannot
  // learn the position of.
  while (found.length < 6) found.push({ block: -1, label: "—", live: false });
  return found;
}

/** The six destinations, resolved against what is actually in the project. */
export function modTargets(project: Project): ModTarget[] {
  const blocks = flat(project);

  return TARGETS.map(({ name, tries }) => {
    for (const [type, label] of tries) {
      const block = blocks.findIndex((b) => b.type === type);
      if (block < 0) continue;
      const def = byType(type);
      const param = def?.params.findIndex((p) => p.label === label) ?? -1;
      if (param < 0) continue;
      return { name, block, param, via: `${blocks[block]!.name} · ${label}` };
    }
    return { name, block: -1, param: -1, via: "" };
  });
}

/**
 * The patch bay's cells as engine routes.
 *
 * Cells are source-major — the same encoding the grid used, so a patch made
 * before any of this existed still works.
 */
export function routesFrom(
  project: Project, cells: number[], depth: number,
): Array<{ source: number; block: number; param: number; depth: number }> {
  const sources = modSources(project);
  const targets = modTargets(project);
  const routes: Array<{ source: number; block: number; param: number; depth: number }> = [];

  for (let s = 0; s < sources.length; s++)
    for (let d = 0; d < targets.length; d++) {
      if (!cells[s * targets.length + d]) continue;
      const src = sources[s]!, dst = targets[d]!;
      if (src.block < 0 || dst.block < 0) continue;
      routes.push({ source: src.block, block: dst.block, param: dst.param, depth });
    }

  return routes;
}
