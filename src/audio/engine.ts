import { byType } from "@/model/catalog";
import type { Project } from "@/model/types";
import { BLOCK_TYPE } from "./blocks.generated";

/**
 * The main-thread side of the audio engine.
 *
 * Owns the AudioContext, loads the WebAssembly, and keeps the worklet's view of
 * the project in step with the store's. Everything that makes a sound lives on
 * the other side of the port; this is only plumbing.
 */

export { BLOCK_TYPE };

/**
 * Blocks that make a sound today.
 *
 * Every block has a type number — the enum covers the whole catalogue so that
 * implementing one never renumbers the others — but only these have an engine
 * behind them. The engine skips the rest, and this list is what the interface
 * uses to say so.
 */
export const IMPLEMENTED = new Set([
  // Source
  "osc", "sub", "noise", "wavetable", "fmop", "string",
  // Shape
  "filter", "formant", "comb", "drive", "fold", "crush", "eq", "gate",
  // Modulate
  "env", "lfo",
  // Route
  "out",
]);

/**
 * Blocks whose engine exists but is standing in for something else.
 *
 * The Sampler plays a synthesised body because there is no file layer yet, and
 * a sampler that cannot load a sample is not a sampler. It is left out of the
 * list above on purpose: the dot means "this does what it says", not "this
 * emits a tone".
 */
export const PLACEHOLDER = new Set(["sampler"]);

export const hasEngine = (type: string) => IMPLEMENTED.has(type);

type Message =
  | { type: "blocks"; types: number[] }
  | { type: "param"; block: number; index: number; value: number }
  | { type: "step"; block: number; index: number; active: boolean; note: number; velocity: number; gate: number }
  | { type: "noteOn"; note: number; velocity: number }
  | { type: "noteOff"; note: number }
  | { type: "mods"; routes: Array<{ source: number; block: number; param: number; depth: number }> }
  | { type: "modDepth"; value: number }
  | { type: "modSlew"; value: number }
  | { type: "panic" };

/** What the audio thread reports back, thirty times a second. */
export type Status = { step: number; voices: number };

export class Audio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private ready = false;
  private pending: Message[] = [];
  private onReady: (() => void) | null = null;
  private listeners = new Set<(s: Status) => void>();
  status: Status = { step: -1, voices: 0 };

  /** Browsers will not start an AudioContext without a gesture, so this is
      called from the first click rather than at mount. */
  async start(onReady?: () => void) {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    this.onReady = onReady ?? null;

    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;

    await ctx.audioWorklet.addModule("/engine/worklet.js");

    // The worklet cannot fetch, so the module is read here and handed across as
    // source text — a worklet has no module loader either. The wasm is embedded
    // in it (SINGLE_FILE), so there is nothing else to carry.
    const glue = await fetch("/engine/engine.js").then((r) => r.text());

    const node = new AudioWorkletNode(ctx, "aka-engine", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node = node;

    node.port.onmessage = (e) => {
      if (e.data?.type === "ready") {
        this.ready = true;
        for (const m of this.pending) node.port.postMessage(m);
        this.pending.length = 0;
        this.onReady?.();
      }
      if (e.data?.type === "status") {
        this.status = e.data;
        for (const fn of this.listeners) fn(e.data);
      }
      if (e.data?.type === "error") console.error("[aka engine]", e.data.message);
    };

    node.port.postMessage({ type: "load", glue });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    this.analyser = analyser;

    node.connect(analyser).connect(ctx.destination);
  }

  private send(m: Message) {
    if (this.ready && this.node) this.node.port.postMessage(m);
    else this.pending.push(m);
  }

  /**
   * Push the whole project across.
   *
   * Blocks with no engine are sent as type 0, which the engine skips, so the
   * indices the UI uses and the ones the engine reads stay the same list. Any
   * other scheme means a parameter change addressed to the wrong block the
   * moment someone places a Reverb.
   */
  setProject(project: Project) {
    const blocks = project.pages.flatMap((p) => p.blocks);
    this.send({ type: "blocks", types: blocks.map((b) => BLOCK_TYPE[b.type] ?? 0) });
    blocks.forEach((b, i) => {
      const def = byType(b.type);
      if (!def) return;
      b.params.forEach((p) => {
        // Catalogue order, not display order — the engine's switch is written
        // against the definition, and the UI is free to reorder what it shows.
        const index = def.params.findIndex((d) => p.id.startsWith(`${d.label.toLowerCase()}-`));
        if (index >= 0) this.send({ type: "param", block: i, index, value: p.value });
      });
    });
  }

  setParam(project: Project, uid: string, paramId: string, value: number) {
    const blocks = project.pages.flatMap((p) => p.blocks);
    const block = blocks.findIndex((b) => b.uid === uid);
    if (block < 0) return;
    const def = byType(blocks[block]!.type);
    const index = def?.params.findIndex((d) => paramId.startsWith(`${d.label.toLowerCase()}-`)) ?? -1;
    if (index >= 0) this.send({ type: "param", block, index, value });
  }

  /** Subscribe to the audio thread's status. Returns the unsubscribe. */
  onStatus(fn: (s: Status) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * One sequencer step.
   *
   * Sent individually rather than as a pattern, because editing one step should
   * not resend sixteen — and because the grid edits one at a time.
   */
  setStep(
    project: Project, uid: string, index: number,
    step: { active: boolean; note: number; velocity: number; gate: number },
  ) {
    const block = project.pages.flatMap((p) => p.blocks).findIndex((b) => b.uid === uid);
    if (block < 0) return;
    this.send({ type: "step", block, index, ...step });
  }

  /** Every cable at once. See the worklet for why it is not incremental. */
  setMods(routes: Array<{ source: number; block: number; param: number; depth: number }>) {
    this.send({ type: "mods", routes });
  }

  setModDepth(value: number) { this.send({ type: "modDepth", value }); }
  setModSlew(value: number) { this.send({ type: "modSlew", value }); }

  noteOn(note: number, velocity = 0.9) { this.send({ type: "noteOn", note, velocity }); }
  noteOff(note: number) { this.send({ type: "noteOff", note }); }
  panic() { this.send({ type: "panic" }); }

  /** The meters and screens read from here rather than from a stand-in. */
  getAnalyser() { return this.analyser; }
  get running() { return this.ready; }
}

/** One per app. */
export const audio = new Audio();

// Reachable from the console in development. Audio bugs are the kind you cannot
// see, and being able to poke the engine from devtools is worth one global.
(globalThis as Record<string, unknown>).aka = audio;
