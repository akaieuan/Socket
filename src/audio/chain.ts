import { byType } from "@/model/catalog";
import type { BlockInstance, Project } from "@/model/types";

/**
 * The signal chain, from the wires.
 *
 * The Signal view has always stored wires and the engine has always ignored
 * them, running blocks in layout order — which is a layout decision standing in
 * for a routing one, and the whole reason that view exists is that those are
 * different questions.
 *
 * A chain is a topological sort: a block runs after everything feeding it. That
 * is the only rule, and it is enough, because a plugin chain is a DAG in
 * practice even when the editor would let you draw a cycle.
 */

const flat = (p: Project): BlockInstance[] => p.pages.flatMap((pg) => pg.blocks);

/** Blocks that can carry audio at all. Everything else is not in this question. */
const inPath = (b: BlockInstance) => {
  const d = byType(b.type);
  return !!d && (d.ports.audioIn > 0 || d.ports.audioOut > 0);
};

export type Chain = {
  /** Block indices, in the order the engine should run them. */
  order: number[];
  /** Block uids that reach an output. Everything else is silent. */
  reaching: Set<string>;
  /** True if the wires contain a cycle, which the sort had to break. */
  cyclic: boolean;
};

/**
 * Sort the audio blocks so each runs after whatever feeds it.
 *
 * Kahn's algorithm, with two deliberate departures. Blocks with no wires keep
 * their layout position rather than being dropped — a half-wired instrument
 * should still make the sound it was making. And a cycle is broken rather than
 * refused: the editor lets you draw one, so the engine has to survive one, and
 * saying so in the interface is more use than silence.
 */
export function chainOf(project: Project): Chain {
  const blocks = flat(project);
  const index = new Map(blocks.map((b, i) => [b.uid, i]));
  const audio = blocks.map((b, i) => ({ b, i })).filter(({ b }) => inPath(b));
  const ids = new Set(audio.map(({ b }) => b.uid));

  const wires = project.wires.filter((w) => ids.has(w.from) && ids.has(w.to));
  const incoming = new Map<string, number>(audio.map(({ b }) => [b.uid, 0]));
  const out = new Map<string, string[]>(audio.map(({ b }) => [b.uid, []]));

  for (const w of wires) {
    out.get(w.from)!.push(w.to);
    incoming.set(w.to, incoming.get(w.to)! + 1);
  }

  // Layout order among the ready set, so an unwired instrument sounds exactly
  // as it did and adding one wire changes one thing.
  const ready = audio.filter(({ b }) => incoming.get(b.uid) === 0).map(({ b }) => b.uid);
  const sorted: string[] = [];

  while (ready.length) {
    const uid = ready.shift()!;
    sorted.push(uid);
    for (const next of out.get(uid) ?? []) {
      incoming.set(next, incoming.get(next)! - 1);
      if (incoming.get(next) === 0) ready.push(next);
    }
  }

  const cyclic = sorted.length < audio.length;
  if (cyclic) for (const { b } of audio) if (!sorted.includes(b.uid)) sorted.push(b.uid);

  return {
    order: sorted.map((uid) => index.get(uid)!),
    reaching: reachingOutput(project, blocks, wires),
    cyclic,
  };
}

/**
 * Which blocks actually get heard.
 *
 * Walked backwards from every sink — a block that makes audio and sends it
 * nowhere is silent, and nothing in the interface said so. With no sink at all
 * everything counts as reaching, because that is the unwired case and the
 * engine plays it in layout order.
 */
function reachingOutput(
  project: Project, blocks: BlockInstance[], wires: Array<{ from: string; to: string }>,
): Set<string> {
  const audio = blocks.filter(inPath);
  const sinks = audio.filter((b) => (byType(b.type)?.ports.audioOut ?? 0) === 0);
  if (sinks.length === 0) return new Set(audio.map((b) => b.uid));

  const feeders = new Map<string, string[]>();
  for (const w of wires) (feeders.get(w.to) ?? feeders.set(w.to, []).get(w.to)!).push(w.from);

  const seen = new Set<string>();
  const stack = sinks.map((b) => b.uid);
  while (stack.length) {
    const uid = stack.pop()!;
    if (seen.has(uid)) continue;
    seen.add(uid);
    for (const from of feeders.get(uid) ?? []) stack.push(from);
  }
  return seen;
}

/** A readable summary of the chain, for the strip along the top of the view. */
export function chainLabels(project: Project): string[] {
  const blocks = flat(project);
  return chainOf(project).order.map((i) => blocks[i]!.name);
}
