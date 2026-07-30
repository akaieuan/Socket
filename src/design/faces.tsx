import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { BlockInstance, Face } from "@/model/types";
import { useAudioContext, useProjectContext, modSources, modTargets } from "@/audio";

/**
 * The faces — everything a block draws that is not a knob.
 *
 * A plugin builder whose only vocabulary is knobs can only build one kind of
 * plugin. A patch bay, a step grid, a keyboard and a scope are each the point of
 * the panel they sit on, so they are first-class here rather than special cases
 * in the renderer: the whole set is one registry at the bottom of this file, and
 * a new one costs an entry.
 *
 * State lives on the block instance, not in the component, so a patch you spent
 * a minute making survives reordering the panel it sits on.
 */

export type FaceProps = {
  block: BlockInstance;
  onFace: (values: number[]) => void;
};

/* ── shared plumbing ──────────────────────────────────────────────────── */

/**
 * Reads a custom property off the element that is drawing.
 *
 * Off the element, not off `:root` — `--plugin-accent` is set on the frame, so
 * a canvas that asks the document for it gets nothing and silently falls back
 * to blue. Every face inherits the frame's accent for free this way, which is
 * the same mechanism the DOM faces already get from plain CSS.
 */
type Read = (name: string) => string;

/**
 * A canvas that re-measures on resize and drives an animation loop.
 *
 * Measuring once at mount is what made the first screen smear when the panel
 * widened — the backing store stayed the old size and the browser stretched
 * stale pixels. Everything that draws goes through here so that bug has one
 * place to not exist.
 */
function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, read: Read) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(draw);
  latest.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const style = getComputedStyle(canvas);
    const read: Read = (name) => style.getPropertyValue(name).trim();

    let w = 0, h = 0;
    const measure = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    let raf = 0, t = 0;
    const frame = () => {
      if (w > 0 && h > 0) { t += 1 / 60; ctx.clearRect(0, 0, w, h); latest.current(ctx, w, h, t, read); }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return ref;
}

const accentOf = (read: Read) => read("--plugin-accent") || read("--accent-blue");

/**
 * A face reads its own block's parameters.
 *
 * By id, not by label. Params are renameable, and a face that stopped
 * responding the moment you renamed its knob would be a trap — the id is
 * assigned once at instantiation from the catalogue label and never changes.
 */
const val = (block: BlockInstance, key: string, fallback: number) =>
  block.params.find((p) => p.id.startsWith(`${key}-`))?.value ?? fallback;

/** Same, for a choice: the selected index. */
const pick = (block: BlockInstance, key: string, fallback = 0) =>
  Math.round(val(block, key, fallback));

/** Face state, defaulted without writing to the model until something is touched. */
function useFaceState(block: BlockInstance, size: number, fill: (i: number) => number) {
  const stored = block.face.length === size ? block.face : null;
  return stored ?? Array.from({ length: size }, (_, i) => fill(i));
}

/** A stand-in signal. Never repeats exactly, which is the only property that matters. */
const wobble = (t: number, i: number) =>
  (0.55 + 0.45 * Math.sin(t * 1.3 + i * 0.35)) * (0.7 + 0.3 * Math.sin(t * 0.6 + i * 0.11));

/* ── displays ─────────────────────────────────────────────────────────── */

/**
 * The pixel screen — skeleton's PixelRack, in a canvas.
 *
 * Frequency runs outward from the middle, mirrored, for the reason enzyme's
 * does: left to right leaves most of a wide panel dead, because a synth's
 * energy is nearly all in the bottom bands.
 */
function Screen({ block }: FaceProps) {
  const bands = useRef<number[]>([]);
  const peaks = useRef<number[]>([]);
  const clock = useRef(0);

  const ref = useCanvas((ctx, w, h, _t, read) => {
    // The knobs above the screen drive it. A display that ignores its own
    // controls is a screensaver, and the whole reason to put controls on a
    // panel is that turning one changes what you are looking at.
    const mode = pick(block, "mode");
    const rate = val(block, "rate", 0.5);
    const tilt = val(block, "tilt", 0.5);
    const decay = val(block, "decay", 0.4);

    clock.current += (0.1 + rate * 1.4) / 60;
    const t = clock.current * 3;

    const cols = Math.max(12, Math.floor(w / 7));
    const rows = Math.max(5, Math.floor(h / 7));
    const cw = w / cols, ch = h / rows, px = Math.min(cw, ch) * 0.8;
    if (bands.current.length !== cols) {
      bands.current = new Array(cols).fill(0);
      peaks.current = new Array(cols).fill(0);
    }
    const mid = Math.floor(rows / 2), reach = Math.max(1, Math.floor(rows / 2));
    const centre = Math.floor(cols / 2);

    for (let c = 0; c < cols; c++) {
      // Mirror runs frequency outward from the middle; the others run it left
      // to right. Mirrored is what enzyme's screen does, and on a wide panel it
      // is the difference between a picture and a bump in one corner.
      const pos = mode === 2
        ? Math.abs(c - centre) / Math.max(1, centre)
        : c / Math.max(1, cols - 1);
      const lift = 1 + pos * tilt * 3;
      const e = (1 - pos) ** 1.6 * wobble(t, c) * lift;
      bands.current[c] = Math.max(0, Math.min(1, e));
      const hh = Math.round(bands.current[c]! * reach);
      // Slow fall reads as a stab hanging in the air; fast reads as a meter.
      peaks.current[c] = hh > peaks.current[c]!
        ? hh
        : Math.max(0, peaks.current[c]! - (0.02 + (1 - decay) * 0.3));
    }

    const panel = read("--mark-panel"), screen = read("--mark-screen");
    // Bloom is symmetrical about the middle row; bars sit on the floor.
    const lit = (i: number, j: number) => {
      const hh = Math.round(bands.current[i]! * reach);
      if (hh <= 0) return false;
      return mode === 1 ? j >= rows - hh : Math.abs(j - mid) <= hh;
    };

    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = lit(i, j) ? screen : panel;
        ctx.fillRect(i * cw, j * ch, cw, ch);
      }

    ctx.fillStyle = read("--muted-foreground");
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (lit(i, j)) continue;
        ctx.fillRect(i * cw + (cw - px) / 2, j * ch + (ch - px) / 2, px, px);
      }

    ctx.fillStyle = accentOf(read);
    for (let i = 0; i < cols; i++) {
      const hh = Math.round(bands.current[i]! * reach);
      if (hh <= 0) continue;
      const crest = mode === 1 ? [rows - hh] : [mid - hh, mid + hh];
      for (const j of crest) {
        if (j < 0 || j >= rows) continue;
        ctx.fillRect(i * cw + (cw - px) / 2, j * ch + (ch - px) / 2, px, px);
      }
    }
  });
  return <canvas ref={ref} className="face-canvas face-screen" />;
}

/** An oscilloscope trace, drifting so it reads as live rather than frozen. */
function Scope({ block }: FaceProps) {
  const ref = useCanvas((ctx, w, h, t, read) => {
    const cycles = 1 + val(block, "time", 0.4) * 9;
    const gain = 0.15 + val(block, "gain", 0.6) * 0.75;
    const dots = pick(block, "trace") === 1;

    ctx.strokeStyle = read("--hairline");
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    const at = (x: number) => {
      const a = x / w * Math.PI * 2 * cycles + t * 2;
      return h / 2 - (Math.sin(a) * 0.6 + Math.sin(a * 3 + t) * 0.22 + Math.sin(a * 5) * 0.1) * h * gain;
    };

    ctx.fillStyle = ctx.strokeStyle = accentOf(read);
    if (dots) {
      for (let x = 0; x <= w; x += 3) ctx.fillRect(x, at(x) - 1, 2, 2);
    } else {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) (x === 0 ? ctx.moveTo(x, at(x)) : ctx.lineTo(x, at(x)));
      ctx.stroke();
    }
  });
  return <canvas ref={ref} className="face-canvas face-scope" />;
}

/** A bar analyser — skeleton's RackAnalysis, log-spaced and peak-held. */
function Spectrum({ block }: FaceProps) {
  const peaks = useRef<number[]>([]);
  const held = useRef<number[]>([]);
  const ref = useCanvas((ctx, w, h, t, read) => {
    const counts = [16, 24, 32, 48];
    const want = counts[pick(block, "bands", 1)] ?? 24;
    // Never more bars than the panel has room for — a bar under two pixels
    // wide is noise, and the panel is resizable.
    const n = Math.max(8, Math.min(want, Math.floor(w / 5)));
    const slope = 0.6 + val(block, "tilt", 0.5) * 2.2;
    const smooth = val(block, "smooth", 0.4);

    if (peaks.current.length !== n) {
      peaks.current = new Array(n).fill(0);
      held.current = new Array(n).fill(0);
    }
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const raw = Math.max(0, Math.min(1, (1 - i / n) ** slope * wobble(t, i * 2) * 1.5));
      // Smoothing is a one-pole on the bar itself, which is what makes a
      // spectrum readable rather than a strobe.
      const a = 0.06 + (1 - smooth) * 0.9;
      held.current[i] = held.current[i]! + (raw - held.current[i]!) * a;
      const v = held.current[i]!;
      peaks.current[i] = v > peaks.current[i]! ? v : Math.max(0, peaks.current[i]! - 0.008);
      ctx.fillStyle = read("--mark-panel");
      ctx.fillRect(i * bw, 0, bw - 1, h);
      ctx.fillStyle = accentOf(read);
      ctx.fillRect(i * bw, h - v * h, bw - 1, v * h);
      ctx.fillStyle = read("--muted-foreground");
      ctx.fillRect(i * bw, h - peaks.current[i]! * h, bw - 1, 1.5);
    }
  });
  return <canvas ref={ref} className="face-canvas face-spectrum" />;
}

/** Stereo level, in segments, with a peak that falls slowly. */
function LevelMeter({ block }: FaceProps) {
  const peak = useRef([0, 0]);
  const ref = useCanvas((ctx, w, h, t, read) => {
    const fall = 0.001 + (1 - val(block, "hold", 0.6)) * 0.03;
    const segs = 14, gap = 2;
    const sh = (h - gap * (segs - 1)) / segs;
    const lanes = [wobble(t, 3) * 0.85, wobble(t * 1.1, 9) * 0.85];
    const lw = (w - 4) / 2;
    lanes.forEach((v, lane) => {
      peak.current[lane] = v > peak.current[lane]! ? v : Math.max(0, peak.current[lane]! - fall);
      const lit = Math.round(v * segs);
      const at = Math.round(peak.current[lane]! * segs);
      for (let s = 0; s < segs; s++) {
        const y = h - (s + 1) * sh - s * gap;
        const on = s < lit, isPeak = s === at - 1;
        ctx.fillStyle = on || isPeak ? (s > segs - 3 ? read("--accent-rose") : accentOf(read)) : read("--mark-panel");
        ctx.globalAlpha = on ? 1 : isPeak ? 0.6 : 1;
        ctx.fillRect(lane * (lw + 4), y, lw, sh);
      }
    });
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} className="face-canvas face-meter" />;
}

/**
 * An envelope drawn from the block's own A/D/S/R.
 *
 * It reads the parameters rather than being told them, so turning Decay
 * reshapes the picture — the reason a face gets the whole block and not a
 * value. A curve that ignored the knobs above it would be wallpaper.
 */
function Curve({ block }: FaceProps) {
  const ref = useCanvas((ctx, w, h, _t, read) => {
    const pad = 4, y0 = h - pad, y1 = pad;
    const a = val(block, "a", 0.1), d = val(block, "d", 0.4);
    const s = val(block, "s", 0.6), r = val(block, "r", 0.3);
    // 0.5 is linear; below bends the segment toward exponential, above toward
    // logarithmic. Drawn as a real bend rather than a label, because the shape
    // of an envelope is the one thing a number never tells you.
    const bend = val(block, "curve", 0.5);
    const span = Math.max(0.001, a + d + 1.2 + r);
    const x = (v: number) => pad + (v / span) * (w - pad * 2);
    const sy = y0 - s * (y0 - y1);

    ctx.strokeStyle = read("--hairline");
    ctx.beginPath(); ctx.moveTo(pad, y0); ctx.lineTo(w - pad, y0); ctx.stroke();

    // Each stage as a short polyline so the bend is visible.
    const seg = (x0: number, ya: number, x1: number, yb: number) => {
      for (let k = 1; k <= 12; k++) {
        const u = k / 12;
        const shaped = bend === 0.5 ? u : u ** (0.35 + (1 - bend) * 2.4);
        ctx.lineTo(x0 + (x1 - x0) * u, ya + (yb - ya) * shaped);
      }
    };

    ctx.beginPath();
    ctx.moveTo(x(0), y0);
    seg(x(0), y0, x(a), y1);
    seg(x(a), y1, x(a + d), sy);
    ctx.lineTo(x(a + d + 1.2), sy);
    seg(x(a + d + 1.2), sy, x(a + d + 1.2 + r), y0);

    ctx.strokeStyle = accentOf(read); ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();

    ctx.lineTo(x(0), y0);
    ctx.closePath();
    ctx.fillStyle = accentOf(read); ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} className="face-canvas face-curve" />;
}

/* ── interactive faces ────────────────────────────────────────────────── */

/** One per source, so a bundle of cables can be read apart. */
const CABLE_HUE = ["--accent-blue", "--accent-rose", "--accent-amber", "--accent-violet", "--accent-green", "--foreground"];

/**
 * The patch bay, with cables.
 *
 * It was a matrix of dots, which is a fine editor and a poor instrument: it
 * shows every connection you could make and none of the ones you did, because
 * a filled cell six rows down from a label reads as a value in a spreadsheet
 * rather than as a route. The whole point of a patch bay is that the routing
 * is the thing you can see.
 *
 * So: jacks down each side and a cable between them. Drag from a source to a
 * destination to patch, click a cable to pull it. Each source has its own
 * colour, because the moment there are four cables the only question you ever
 * ask is which one goes where.
 *
 * Cables sag. A straight line between two points is a diagram; a catenary is a
 * cable, and the sag is what lets your eye follow one across three others.
 */
function Matrix({ block, onFace }: FaceProps) {
  const project = useProjectContext();
  // Both sides resolve against the project. A jack with nothing behind it is
  // drawn dead rather than hidden — the panel keeps its shape, and you can see
  // that the cable you want needs a block you have not placed.
  const sources = project ? modSources(project) : [];
  const targets = project ? modTargets(project) : [];
  const rows = 6, cols = 6;
  // Kept as the same source×destination grid the matrix used, so an existing
  // patch survives the change — the encoding was never the problem.
  const cells = useFaceState(block, rows * cols, () => 0);
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ src: number; x: number; y: number } | null>(null);

  const toggle = (src: number, dst: number) => {
    const next = cells.slice();
    const i = src * cols + dst;
    next[i] = next[i] ? 0 : 1;
    onFace(next);
  };

  /** Where a jack sits, in the SVG's own 0..100 space. */
  const at = (side: "src" | "dst", i: number, n: number) => ({
    x: side === "src" ? 9 : 91,
    y: ((i + 0.5) / n) * 100,
  });

  const cable = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    // Sag proportional to span, so a short patch hangs less than a long one —
    // which is what a real cable does and what makes the picture readable.
    const sag = Math.min(26, Math.abs(dx) * 0.34);
    const mid = (a.y + b.y) / 2 + sag;
    return `M ${a.x} ${a.y} C ${a.x + dx * 0.35} ${mid} ${b.x - dx * 0.35} ${mid} ${b.x} ${b.y}`;
  };

  const start = (src: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const r = box.current?.getBoundingClientRect();
    if (!r) return;

    const move = (ev: PointerEvent) =>
      setDrag({ src, x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 });

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      // Nearest destination jack, if the release landed near one. A drop that
      // has to be pixel-accurate is a drop you make twice.
      const y = ((ev.clientY - r.top) / r.height) * 100;
      const x = ((ev.clientX - r.left) / r.width) * 100;
      if (x < 55) return;
      const dst = Math.round((y / 100) * cols - 0.5);
      if (dst >= 0 && dst < cols) toggle(src, dst);
    };

    setDrag({ src, x: at("src", src, rows).x, y: at("src", src, rows).y });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const patched = cells.flatMap((v, i) => (v ? [{ src: (i / cols) | 0, dst: i % cols }] : []));

  return (
    <div className="patchbay" ref={box}>
      <div className="patch-side patch-src">
        {Array.from({ length: rows }, (_, i) => {
          const src = sources[i];
          const live = !!src && src.block >= 0;
          return (
            <button
              key={i}
              className={`patch-jack${patched.some((p) => p.src === i) ? " on" : ""}${live ? "" : " dead"}`}
              style={{ color: `var(${CABLE_HUE[i]})` }}
              onPointerDown={live ? start(i) : undefined}
              title={live ? `Drag ${src.label} to a destination` : "No modulator here — place an LFO, Sequencer or Random"}
            >
              <span className="patch-label">{src?.label ?? "—"}</span>
              <span className="patch-hole" />
            </button>
          );
        })}
      </div>

      {/* The cables sit above the jacks and below the pointer: they have to be
          clickable to be pullable, but must not block a drag from a jack. */}
      <svg className="patch-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
        {patched.map(({ src, dst }) => (
          <path
            key={`${src}-${dst}`}
            className="patch-cable"
            d={cable(at("src", src, rows), at("dst", dst, cols))}
            stroke={`var(${CABLE_HUE[src]})`}
            onPointerDown={(e) => { e.stopPropagation(); toggle(src, dst); }}
          />
        ))}
        {drag && (
          <path
            className="patch-cable patch-dragging"
            d={cable(at("src", drag.src, rows), { x: drag.x, y: drag.y })}
            stroke={`var(${CABLE_HUE[drag.src]})`}
          />
        )}
      </svg>

      <div className="patch-side patch-dst">
        {Array.from({ length: cols }, (_, i) => {
          const dst = targets[i];
          const live = !!dst && dst.block >= 0;
          return (
            <button
              key={i}
              className={`patch-jack${patched.some((p) => p.dst === i) ? " on" : ""}${live ? "" : " dead"}`}
              title={live ? `${dst.name} → ${dst.via}` : `${dst?.name ?? ""} — nothing in the project can be this yet`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="patch-hole" />
              <span className="patch-label">{dst?.name ?? "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── the step grid ─────────────────────────────────────────────────────── */

const STEPS = 16;
/** Per step: active, note, velocity, gate. One flat array on the instance. */
const STRIDE = 4;

/** Which of the four a row edits. Drag anywhere in the column to set it. */
const LANES = [
  { key: "vel" as const, label: "VEL" },
  { key: "note" as const, label: "NOTE" },
  { key: "gate" as const, label: "GATE" },
];

const PATTERNS = ["1/4", "OFF", "1/8", "E3", "E5", "E7", "RND", "CLR"];

/**
 * A step sequencer, after bleep's.
 *
 * bleep's is the best-thought-out thing in the three plugins, and the shape it
 * gets right is that a step is not a flag. It carries a note, a velocity and a
 * gate length, and that is the whole difference between a sequencer and a
 * metronome — a pattern of identical hits is what a boolean gives you, and it
 * is why most built-in sequencers sound like a demo.
 *
 * Three lanes, one at a time. Sixteen steps by four values will not fit on a
 * panel at once and trying makes a spreadsheet; a lane switch costs one click
 * and keeps each view a shape you can read across.
 *
 * The playhead comes from the audio thread, not from a timer. The old grid ran
 * its own setInterval, which meant the line you watched and the note you heard
 * were two different clocks — visibly two, within a bar.
 */
function Steps({ block, onFace }: FaceProps) {
  const sound = useAudioContext();
  const [lane, setLane] = useState<(typeof LANES)[number]["key"]>("vel");

  const values = useFaceState(block, STEPS * STRIDE, (i) => {
    const field = i % STRIDE;
    const step = (i / STRIDE) | 0;
    if (field === 0) return step % 4 === 0 ? 1 : 0;   // active
    if (field === 1) return 60;                        // note
    if (field === 2) return 0.9;                       // velocity
    return 0.5;                                        // gate
  });

  const read = (step: number, field: number) => values[step * STRIDE + field]!;

  /** Write locally and to the engine in one move — they cannot disagree. */
  const write = (step: number, changes: Partial<Record<number, number>>) => {
    const next = values.slice();
    for (const [field, v] of Object.entries(changes)) next[step * STRIDE + Number(field)] = v!;
    onFace(next);
    sound.setStep(block.uid, step, {
      active: next[step * STRIDE]! > 0.5,
      note: Math.round(next[step * STRIDE + 1]!),
      velocity: next[step * STRIDE + 2]!,
      gate: next[step * STRIDE + 3]!,
    });
  };

  // Everything the engine does not already know: on mount, and whenever the
  // pattern is replaced wholesale by a generator.
  useEffect(() => {
    for (let i = 0; i < STEPS; i++)
      sound.setStep(block.uid, i, {
        active: read(i, 0) > 0.5,
        note: Math.round(read(i, 1)),
        velocity: read(i, 2),
        gate: read(i, 3),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join(","), sound.running]);

  const generate = (which: number) => {
    const next = values.slice();
    const set = (i: number, on: boolean) => { next[i * STRIDE] = on ? 1 : 0; };
    for (let i = 0; i < STEPS; i++) set(i, false);
    const euclid = (k: number) => { for (let i = 0; i < k; i++) set(((i * STEPS) / k) | 0, true); };

    // The same eight bleep offers. The Euclidean ones are the reason its grid
    // is pleasant: a blank sixteen is a chore, and those produce patterns
    // nobody arrives at by clicking.
    if (which === 0) for (let i = 0; i < STEPS; i += 4) set(i, true);
    if (which === 1) for (let i = 2; i < STEPS; i += 4) set(i, true);
    if (which === 2) for (let i = 0; i < STEPS; i += 2) set(i, true);
    if (which === 3) euclid(3);
    if (which === 4) euclid(5);
    if (which === 5) euclid(7);
    if (which === 6) for (let i = 0; i < STEPS; i++) set(i, Math.random() > 0.55);
    onFace(next);
  };

  /** Drag sets the lane's value; the top of the column is 1. */
  const paint = (e: React.PointerEvent, step: number) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, 1 - (e.clientY - box.top) / box.height));
    if (lane === "vel") write(step, { 0: 1, 2: Math.max(0.05, t) });
    if (lane === "gate") write(step, { 3: Math.max(0.02, t) });
    // Two octaves of travel, snapped: a continuous pitch lane is unplayable.
    if (lane === "note") write(step, { 1: Math.round(36 + t * 48) });
  };

  const height = (step: number) => {
    if (lane === "vel") return read(step, 2);
    if (lane === "gate") return read(step, 3);
    return (read(step, 1) - 36) / 48;
  };

  return (
    <div className="steps-face">
      <div className="steps">
        {Array.from({ length: STEPS }, (_, i) => {
          const on = read(i, 0) > 0.5;
          return (
            <button
              key={i}
              className={`step${sound.status.step === i ? " head" : ""}${on ? " on" : ""}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                // A click on the active lane toggles; a drag sets the value.
                if (lane === "vel" && on) write(i, { 0: 0 });
                else paint(e, i);
              }}
              onPointerEnter={(e) => e.buttons === 1 && paint(e, i)}
              aria-label={`Step ${i + 1}`}
            >
              <span className="step-fill" style={{ height: `${height(i) * 100}%` }} />
            </button>
          );
        })}
      </div>

      <div className="steps-tools">
        {LANES.map((l) => (
          <button
            key={l.key}
            className={`step-lane${lane === l.key ? " on" : ""}`}
            onPointerDown={(e) => { e.stopPropagation(); setLane(l.key); }}
          >
            {l.label}
          </button>
        ))}
        <span className="steps-gap" />
        {PATTERNS.map((p, i) => (
          <button
            key={p}
            className="step-gen"
            onPointerDown={(e) => { e.stopPropagation(); generate(i); }}
            title={`Pattern: ${p}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Two parameters at once. The one control that is genuinely faster than knobs. */
function XY({ block, onFace }: FaceProps) {
  const [x, y] = useFaceState(block, 2, () => 0.5);
  const box = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent | React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    onFace([
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)),
    ]);
  };

  const grab = (e: React.PointerEvent) => {
    e.stopPropagation();
    move(e);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Guides, so a position on the pad is a value you can read back rather than
  // one you can only feel.
  const divisions = [0, 3, 5][pick(block, "grid", 1)] ?? 3;

  return (
    <div className="xy" ref={box} onPointerDown={grab}>
      {Array.from({ length: Math.max(0, divisions - 1) }, (_, i) => (
        <Fragment key={i}>
          <span className="xy-guide xy-h" style={{ top: `${((i + 1) / divisions) * 100}%` }} />
          <span className="xy-guide xy-v" style={{ left: `${((i + 1) / divisions) * 100}%` }} />
        </Fragment>
      ))}
      <span className="xy-cross xy-h" style={{ top: `${(1 - y!) * 100}%` }} />
      <span className="xy-cross xy-v" style={{ left: `${x! * 100}%` }} />
      <span className="xy-dot" style={{ left: `${x! * 100}%`, top: `${(1 - y!) * 100}%` }} />
    </div>
  );
}

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * A keyboard that plays.
 *
 * Press and hold, the way a key works — the earlier version latched, which was
 * the honest behaviour for a mock and is the wrong one the moment there is a
 * sound to sustain. Held notes still show, but they show because they are
 * sounding rather than because they were clicked.
 *
 * C2 upward, so the range lands where a synth patch is usually voiced.
 */
function Keys({ block }: FaceProps) {
  const sound = useAudioContext();
  const n = [12, 24, 36, 61][pick(block, "range", 1)] ?? 24;
  const base = 36;

  const press = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const note = base + i;
    sound.noteOn(note, 0.9);
    const release = () => {
      sound.noteOff(note);
      window.removeEventListener("pointerup", release);
    };
    window.addEventListener("pointerup", release);
  };

  const held = (i: number) => sound.held.includes(base + i);
  const whites = Array.from({ length: n }, (_, i) => i).filter((i) => !BLACK.has(i % 12));

  return (
    <div className="keys">
      {whites.map((i, w) => (
        <button
          key={i}
          className={`key-w${held(i) ? " on" : ""}`}
          style={{ left: `${(w / whites.length) * 100}%`, width: `${100 / whites.length}%` }}
          onPointerDown={press(i)}
          aria-label={`Key ${i}`}
        />
      ))}
      {Array.from({ length: n }, (_, i) => i).filter((i) => BLACK.has(i % 12)).map((i) => {
        const before = whites.filter((wi) => wi < i).length;
        return (
          <button
            key={i}
            className={`key-b${held(i) ? " on" : ""}`}
            style={{ left: `${(before / whites.length) * 100}%`, width: `${100 / whites.length * 0.62}%` }}
            onPointerDown={press(i)}
            aria-label={`Key ${i}`}
          />
        );
      })}
    </div>
  );
}

/** Sixteen triggers. Latching, because a mock that forgets is worse than none. */
function Pads({ block, onFace }: FaceProps) {
  const cols = [4, 8][pick(block, "cols")] ?? 4;
  const rows = [4, 2, 1][pick(block, "rows")] ?? 4;
  const n = cols * rows;
  const on = useFaceState(block, n, () => 0);
  return (
    <div className="pads" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxWidth: cols * 38 }}>
      {on.map((v, i) => (
        <button
          key={i}
          className={`pad${v ? " on" : ""}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            const next = on.slice(); next[i] = v ? 0 : 1; onFace(next);
          }}
          aria-label={`Pad ${i + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * A text readout — skeleton's ModuleReadout.
 *
 * Numbers a knob cannot show: what note is sounding, how many voices are up,
 * what the engine is actually doing. Every instrument ends up needing one and
 * every instrument ends up inventing its own.
 */
function Readout({ block }: FaceProps) {
  const [tick, setTick] = useState(0);
  const ms = Math.round(1400 - val(block, "rate", 0.5) * 1200);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);

  const notes = ["C2", "G2", "A#3", "D3", "F4", "E2"];
  // Three things a readout is ever for. Which one a panel needs depends
  // entirely on what it sits next to, so it is a control rather than a choice
  // baked into the block.
  const sets: Record<number, [string, string][]> = {
    0: [["NOTE", notes[tick % notes.length]!], ["VOICES", `${(tick % 5) + 1}/8`], ["BEND", `${(tick % 3) - 1}`]],
    1: [["ENGINE", block.name], ["MODE", tick % 2 ? "POLY" : "MONO"], ["TUNE", `${440 + (tick % 3)}Hz`]],
    2: [["CPU", `${8 + (tick % 7)}%`], ["SR", "48k"], ["LAT", `${64 + (tick % 2) * 64}`]],
  };
  const lines = sets[pick(block, "source")] ?? sets[0]!;

  return (
    <div className="readout">
      {lines.map(([k, v]) => (
        <div className="readout-row" key={k}>
          <span>{k}</span><span className="readout-v">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ── the registry ─────────────────────────────────────────────────────── */

export const FACES: Record<Face, (p: FaceProps) => ReactNode> = {
  screen: Screen,
  scope: Scope,
  spectrum: Spectrum,
  meter: LevelMeter,
  curve: Curve,
  matrix: Matrix,
  steps: Steps,
  xy: XY,
  keys: Keys,
  pads: Pads,
  readout: Readout,
};
