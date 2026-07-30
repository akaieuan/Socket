/**
 * The audio thread.
 *
 * A single AudioWorkletProcessor hosting the WebAssembly engine — the same C++
 * the plugin compiles, not a JavaScript approximation of it. Native Web Audio
 * nodes would have been faster to reach, and would have meant Socket previewing
 * a different instrument from the one it exports.
 *
 * The module arrives as source text over postMessage, with the wasm embedded in
 * it. A worklet has no fetch, no import and its own global scope, so the main
 * thread reads the file and hands it across for evaluation in here.
 */

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.ptrL = 0;
    this.ptrR = 0;
    this.capacity = 0;
    // Anything that arrives before the module is ready waits rather than
    // being dropped — the UI sends the whole project state immediately on
    // connect and the wasm takes a moment.
    this.queue = [];
    this.port.onmessage = (e) => this.receive(e.data);
  }

  async receive(msg) {
    if (msg.type === "load") {
      // Reported rather than thrown. A rejection in here goes nowhere the main
      // thread can see, and the first version of this failed silently — the
      // button simply never turned green and the console stayed empty.
      try {
        // eslint-disable-next-line no-undef
        const factory = new Function(`${msg.glue}\nreturn createEngine;`)();
        // No binary to pass: the module is built SINGLE_FILE, so the wasm is
        // embedded in the glue. A worklet cannot fetch, and handing the bytes
        // across meant relying on emscripten to notice them — which it did not.
        this.engine = await factory({});
        this.engine._aka_prepare(sampleRate, 128);
        this.alloc(128);
        for (const m of this.queue) this.apply(m);
        this.queue.length = 0;
        this.port.postMessage({ type: "ready" });
      } catch (err) {
        this.port.postMessage({ type: "error", message: String(err?.stack ?? err) });
      }
      return;
    }
    if (!this.engine) { this.queue.push(msg); return; }
    this.apply(msg);
  }

  apply(msg) {
    const e = this.engine;
    switch (msg.type) {
      case "blocks":
        e._aka_begin_blocks();
        for (const t of msg.types) e._aka_push_block(t);
        e._aka_commit_blocks();
        break;
      case "param":    e._aka_set_param(msg.block, msg.index, msg.value); break;
      case "noteOn":   e._aka_note_on(msg.note, msg.velocity); break;
      case "noteOff":  e._aka_note_off(msg.note); break;
      case "panic":    e._aka_all_notes_off(); break;
    }
  }

  /** One allocation, reused every block. Nothing allocates while running. */
  alloc(frames) {
    const e = this.engine;
    if (this.capacity >= frames) return;
    if (this.ptrL) { e._free(this.ptrL); e._free(this.ptrR); }
    this.ptrL = e._malloc(frames * 4);
    this.ptrR = e._malloc(frames * 4);
    this.capacity = frames;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.engine || !out || out.length === 0) return true;

    const n = out[0].length;
    this.alloc(n);

    const e = this.engine;
    e._aka_process(this.ptrL, this.ptrR, n);

    // HEAPF32 is re-created whenever the heap grows, so it is read each block
    // rather than cached — a stale view reads freed memory.
    const heap = e.HEAPF32;
    const l = heap.subarray(this.ptrL >> 2, (this.ptrL >> 2) + n);
    const r = heap.subarray(this.ptrR >> 2, (this.ptrR >> 2) + n);
    out[0].set(l);
    if (out[1]) out[1].set(r);

    return true;
  }
}

registerProcessor("aka-engine", EngineProcessor);
