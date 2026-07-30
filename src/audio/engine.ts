import { byType } from "@/model/catalog";
import type { Project } from "@/model/types";
import { BLOCK_TYPE } from "./blocks.generated";
import { chainOf } from "./chain";

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
  "env", "env2", "lfo", "random", "follow", "seq", "arp", "keytrack",
  // Effect
  "delay", "reverb", "chorus", "phaser", "flanger", "comp", "limiter",
  "tape", "grain", "ring", "width", "fxchain",
  // Route
  "macros", "mixer", "voice", "split", "out",
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
  | { type: "chain"; order: number[] }
  | { type: "mods"; routes: Array<{ source: number; block: number; param: number; depth: number }> }
  | { type: "modDepth"; value: number }
  | { type: "modSlew"; value: number }
  | { type: "panic" };

/** What the audio thread reports back, thirty times a second. */
export type Status = { step: number; voices: number };

/**
 * What the audio device is asked for.
 *
 * All three need the context rebuilt — none of them can change on a running
 * one — which is why Settings says so rather than pretending a knob turn is
 * enough. Sample rate is a request: the device grants what it can, and the
 * panel reports what it actually got.
 */
export type AudioOptions = {
  sampleRate?: number;
  latencyHint: AudioContextLatencyCategory;
  sinkId?: string;
};

export const DEFAULT_OPTIONS: AudioOptions = { latencyHint: "interactive" };

export class Audio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private ready = false;
  private pending: Message[] = [];
  private onReady: (() => void) | null = null;
  private listeners = new Set<(s: Status) => void>();
  private project: Project | null = null;
  status: Status = { step: -1, voices: 0 };
  options: AudioOptions = { ...DEFAULT_OPTIONS };

  /** Browsers will not start an AudioContext without a gesture, so this is
      called from the first click rather than at mount. */
  async start(onReady?: () => void) {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    this.onReady = onReady ?? null;

    const ctx = new AudioContext({
      latencyHint: this.options.latencyHint,
      // Omitted rather than passed as undefined: some browsers treat the key
      // being present as a request for whatever undefined coerces to.
      ...(this.options.sampleRate ? { sampleRate: this.options.sampleRate } : {}),
    });
    this.ctx = ctx;

    if (this.options.sinkId && "setSinkId" in ctx) {
      // Best effort. A device can vanish between being listed and being chosen,
      // and failing to open the speakers you asked for is not a reason to have
      // no sound at all.
      try { await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(this.options.sinkId); }
      catch { /* fall back to the default output */ }
    }

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
    analyser.smoothingTimeConstant = 0.35;
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
    this.project = project;
    const blocks = project.pages.flatMap((p) => p.blocks);
    this.send({ type: "blocks", types: blocks.map((b) => BLOCK_TYPE[b.type] ?? 0) });
    this.setChain(project);

    blocks.forEach((b, i) => {
      const def = byType(b.type);
      if (!def) return;
      b.params.forEach((p) => {
        // Catalogue order, not display order — the engine's switch is written
        // against the definition, and the UI is free to reorder what it shows.
        const index = def.params.findIndex((d) => p.id.startsWith(`${d.label.toLowerCase()}-`));
        if (index >= 0) this.send({ type: "param", block: i, index, value: p.value });
      });

      // Face state goes with the structure, not only when the face is edited.
      //
      // This message rebuilds every engine, so a fresh sequencer arrives with
      // an empty pattern. The grid does push its steps — but React runs child
      // effects before parent ones, so the face pushed first and the rebuild
      // then wiped it. The sequencer ran, reported its step, and played
      // nothing: a clock with no pattern looks exactly like a broken clock.
      if (b.type === "seq") this.sendSteps(i, b.face);
    });
  }

  /** Sixty-four steps of active, note, velocity, gate — the face's layout. */
  private sendSteps(block: number, face: number[]) {
    const stride = 4, steps = 64;
    for (let i = 0; i < steps; i++) {
      const at = i * stride;
      // An unedited grid has no face array yet, and its defaults live in the
      // face. Every fourth step, middle C — the same thing the grid draws.
      const has = face.length === steps * stride;
      this.send({
        type: "step",
        block,
        index: i,
        active: has ? face[at]! > 0.5 : i % 4 === 0,
        note: has ? Math.round(face[at + 1]!) : 60,
        velocity: has ? face[at + 2]! : 0.9,
        gate: has ? face[at + 3]! : 0.5,
      });
    }
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

  /**
   * The order to run blocks in, from the wires.
   *
   * Sent separately from the block list rather than reordering it: the
   * interface addresses a parameter by its position in that list, so sorting
   * the list would point every knob at the wrong block.
   */
  setChain(project: Project) {
    this.send({ type: "chain", order: chainOf(project).order });
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

  /**
   * Tear it down and build it again with new options.
   *
   * There is no other way: sample rate, latency and output device are all fixed
   * for the life of an AudioContext. The project goes back across afterwards,
   * so the only thing you lose is whatever was ringing.
   */
  async restart(options: Partial<AudioOptions>) {
    this.options = { ...this.options, ...options };
    const project = this.project;

    if (this.ctx) {
      const old = this.ctx;
      this.ctx = null;
      this.node = null;
      this.analyser = null;
      this.ready = false;
      this.pending.length = 0;
      await old.close().catch(() => {});
    }

    await this.start(() => { if (project) this.setProject(project); });
  }

  /** What the device actually gave us, which is not always what was asked. */
  get actual() {
    return {
      sampleRate: this.ctx?.sampleRate ?? 0,
      // Round-trip in milliseconds. The honest number to show, because the
      // render quantum is always 128 frames and says nothing about the device.
      latencyMs: this.ctx ? Math.round((this.ctx.baseLatency ?? 0) * 1000 * 10) / 10 : 0,
      state: this.ctx?.state ?? "closed",
    };
  }

  /** The meters and screens read from here rather than from a stand-in. */
  getAnalyser() { return this.analyser; }
  get running() { return this.ready; }
}

/** One per app. */
export const audio = new Audio();

// Reachable from the console in development. Audio bugs are the kind you cannot
// see, and being able to poke the engine from devtools is worth one global.
(globalThis as Record<string, unknown>).aka = audio;
