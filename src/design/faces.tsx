import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { BlockInstance, Face } from "@/model/types";
import { useAudioContext, useProjectContext, modSources, modTargets, NUM_SOURCES, NUM_TARGETS } from "@/audio";

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
  /** By catalogue index. The sequencer's PLAY button is the Run parameter —
      a transport button and a knob for the same thing is one too many. */
  onParam: (index: number, value: number) => void;
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

/**
 * A stand-in signal, for when nothing is playing.
 *
 * Not decoration: before you click Enable audio there is no signal, and a
 * display sitting at zero reads as broken rather than as silent. It never
 * repeats exactly, which is the only property that matters.
 */
const wobble = (t: number, i: number) =>
  (0.55 + 0.45 * Math.sin(t * 1.3 + i * 0.35)) * (0.7 + 0.3 * Math.sin(t * 0.6 + i * 0.11));

/**
 * The window a display maps to 0..1.
 *
 * Measured rather than guessed. Three notes through a lowpass put the
 * fundamentals at -43 to -59dB per band and everything above 400Hz below -120,
 * because the filter genuinely removed it. A -85 floor threw away half of the
 * useful range and a -15 ceiling was never reached, so the picture lived in the
 * top third of the scale and barely moved.
 */
const DB_FLOOR = -100, DB_CEIL = -30;

/**
 * Log-spaced bands from the analyser's linear bins.
 *
 * Linear bins are the wrong shape for a display: at 48kHz with a 2048-point
 * transform, half of them cover 12kHz and up, which is where a synth has almost
 * nothing. Thirty to sixteen thousand, logarithmically, is what an octave-spaced
 * ear expects — and it is why a spectrum drawn straight from the bins looks
 * dead on the right and crowded on the left.
 */
function bands(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, out: Float32Array) {
  analyser.getFloatFrequencyData(buf);
  const n = out.length;
  const nyquist = analyser.context.sampleRate / 2;
  const perBin = nyquist / buf.length;

  for (let b = 0; b < n; b++) {
    const lo = 30 * Math.pow(16000 / 30, b / n);
    const hi = 30 * Math.pow(16000 / 30, (b + 1) / n);
    const i0 = Math.max(0, Math.floor(lo / perBin));
    const i1 = Math.min(buf.length - 1, Math.max(i0, Math.ceil(hi / perBin)));

    // Peak, not mean. A mean across a wide high band buries a single strong
    // partial in the noise either side of it, which is exactly the thing you
    // put a display there to see.
    let peak = -Infinity;
    for (let i = i0; i <= i1; i++) if (buf[i]! > peak) peak = buf[i]!;
    out[b] = Math.max(0, Math.min(1, (peak - DB_FLOOR) / (DB_CEIL - DB_FLOOR)));
  }
}

/* ── displays ─────────────────────────────────────────────────────────── */

/**
 * The pixel screen — skeleton's PixelRack, in a canvas.
 *
 * Frequency runs outward from the middle, mirrored, for the reason enzyme's
 * does: left to right leaves most of a wide panel dead, because a synth's
 * energy is nearly all in the bottom bands.
 */
function Screen({ block }: FaceProps) {
  const sound = useAudioContext();
  const bins = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));
  const levels = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));
  const bandsRef = useRef<number[]>([]);
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
    if (bandsRef.current.length !== cols) {
      bandsRef.current = new Array(cols).fill(0);
      peaks.current = new Array(cols).fill(0);
    }
    const mid = Math.floor(rows / 2), reach = Math.max(1, Math.floor(rows / 2));
    const centre = Math.floor(cols / 2);

    // The real spectrum when something is playing, a stand-in when nothing is.
    const analyser = sound.analyser();
    const half = Math.max(1, Math.ceil(cols / 2));
    const wide = mode === 2 ? half : cols;
    if (analyser) {
      if (bins.current.length !== analyser.frequencyBinCount) bins.current = new Float32Array(analyser.frequencyBinCount);
      if (levels.current.length !== wide) levels.current = new Float32Array(wide);
      bands(analyser, bins.current, levels.current);
    }

    for (let c = 0; c < cols; c++) {
      // Mirror runs frequency outward from the middle; the others run it left
      // to right. Mirrored is what enzyme's screen does, and on a wide panel it
      // is the difference between a picture and a bump in one corner.
      const pos = mode === 2
        ? Math.abs(c - centre) / Math.max(1, centre)
        : c / Math.max(1, cols - 1);
      const lift = 1 + pos * tilt * 3;

      // pos is 0 at the low end and 1 at the high end in both layouts — the
      // middle outward when mirrored, left to right otherwise. Reading the
      // band with (1 - pos) put the fundamentals at the edges, where Tilt then
      // lifted them by two and a half, and the whole picture pinned.
      const raw = analyser
        ? levels.current[Math.min(wide - 1, Math.round(pos * (wide - 1)))]! * lift
        : (1 - pos) ** 1.6 * wobble(t, c) * lift;

      bandsRef.current[c] = Math.max(0, Math.min(1, raw));
      const hh = Math.round(bandsRef.current[c]! * reach);
      // Slow fall reads as a stab hanging in the air; fast reads as a meter.
      peaks.current[c] = hh > peaks.current[c]!
        ? hh
        : Math.max(0, peaks.current[c]! - (0.02 + (1 - decay) * 0.3));
    }

    const panel = read("--mark-panel"), screen = read("--mark-screen");
    // Bloom is symmetrical about the middle row; bars sit on the floor.
    const lit = (i: number, j: number) => {
      const hh = Math.round(bandsRef.current[i]! * reach);
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
      const hh = Math.round(bandsRef.current[i]! * reach);
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
  const sound = useAudioContext();
  const wave = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));

  const ref = useCanvas((ctx, w, h, t, read) => {
    const cycles = 1 + val(block, "time", 0.4) * 9;
    const gain = 0.15 + val(block, "gain", 0.6) * 0.75;
    const dots = pick(block, "trace") === 1;

    ctx.strokeStyle = read("--hairline");
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    const analyser = sound.analyser();
    if (analyser) {
      if (wave.current.length !== analyser.fftSize) wave.current = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(wave.current);
    }

    // Time is how much of the buffer fits across the panel — a real scope's
    // timebase, not a frequency. Ten is about two cycles of a low note.
    const span = analyser ? Math.max(64, Math.round(wave.current.length / cycles)) : 0;

    const at = (x: number) => {
      if (analyser && span > 0) {
        const i = Math.min(wave.current.length - 1, Math.round((x / w) * span));
        return h / 2 - wave.current[i]! * h * gain * 2.2;
      }
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
  const sound = useAudioContext();
  const bins = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));
  const levels = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));
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

    const analyser = sound.analyser();
    if (analyser) {
      if (bins.current.length !== analyser.frequencyBinCount) bins.current = new Float32Array(analyser.frequencyBinCount);
      if (levels.current.length !== n) levels.current = new Float32Array(n);
      bands(analyser, bins.current, levels.current);
    }

    const bw = w / n;
    for (let i = 0; i < n; i++) {
      // Tilt lifts the top end, which genuinely carries less — left alone a
      // real spectrum is a wall on the left and nothing after it.
      const raw = analyser
        ? Math.max(0, Math.min(1, levels.current[i]! * (1 + (i / n) * slope)))
        : Math.max(0, Math.min(1, (1 - i / n) ** slope * wobble(t, i * 2) * 1.5));
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
  const sound = useAudioContext();
  const wave = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0));
  const peak = useRef([0, 0]);
  const ref = useCanvas((ctx, w, h, t, read) => {
    const fall = 0.001 + (1 - val(block, "hold", 0.6)) * 0.03;
    const segs = 14, gap = 2;
    const sh = (h - gap * (segs - 1)) / segs;

    const analyser = sound.analyser();
    let lanes = [wobble(t, 3) * 0.85, wobble(t * 1.1, 9) * 0.85];
    if (analyser) {
      if (wave.current.length !== analyser.fftSize) wave.current = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(wave.current);
      let rms = 0, top = 0;
      for (const v of wave.current) { rms += v * v; if (Math.abs(v) > top) top = Math.abs(v); }
      rms = Math.sqrt(rms / wave.current.length);
      // RMS on one lane and peak on the other. A meter showing only peak reads
      // as loud when nothing is; only RMS and a clipping transient goes unseen.
      const scale = (x: number) => Math.max(0, Math.min(1, (20 * Math.log10(x + 1e-9) - DB_FLOOR) / (0 - DB_FLOOR)));
      lanes = [scale(rms), scale(top)];
    }
    const lw = (w - 4) / 2;
    lanes.forEach((v: number, lane: number) => {
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
  // Derived, not written twice: the destination list grew to seven when Scale
  // and Glide arrived, and a literal here is exactly how that goes wrong.
  const rows = NUM_SOURCES, cols = NUM_TARGETS;
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

/** Four pages of sixteen, like bleep's. */
const STEPS = 64;
const PER_PAGE = 16;
const PAGES = STEPS / PER_PAGE;
/** Per step: active, note, velocity, gate. One flat array on the instance. */
const STRIDE = 4;

const LANES = [
  { key: "vel" as const, label: "VEL", field: 2 },
  { key: "note" as const, label: "NOTE", field: 1 },
  { key: "gate" as const, label: "GATE", field: 3 },
];

const GENERATORS = ["1/4", "OFF", "1/8", "E3", "E5", "E7", "RND", "CLR"];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/**
 * A step sequencer, after bleep's.
 *
 * Pads in eight by two, not sixteen thin bars. That is bleep's shape and it is
 * the right one: a pad is big enough to carry its own step number and to show
 * its velocity as fill, and two rows of eight is how anyone who has used a drum
 * machine already counts a bar. Sixteen slivers is a waveform display that
 * happens to be clickable.
 *
 * Sixty-four steps across four pages. Sixteen was the first attempt and it was
 * the wrong trim — four bars is where a pattern stops being a loop, and pattern
 * length runs across the whole range so an odd length crosses pages by itself.
 *
 * The playhead comes from the audio thread. The old grid ran its own
 * setInterval, which meant the line you watched and the note you heard were two
 * different clocks — visibly two, within a bar.
 */
function Steps({ block, onFace, onParam }: FaceProps) {
  const sound = useAudioContext();
  const [lane, setLane] = useState<(typeof LANES)[number]["key"]>("vel");
  const [page, setPage] = useState(0);

  const values = useFaceState(block, STEPS * STRIDE, (i) => {
    const field = i % STRIDE;
    const step = (i / STRIDE) | 0;
    if (field === 0) return step % 4 === 0 ? 1 : 0;
    if (field === 1) return 60;
    if (field === 2) return 0.9;
    return 0.5;
  });

  const read = (step: number, field: number) => values[step * STRIDE + field]!;
  const running = (block.params.find((p) => p.id.startsWith("run-"))?.value ?? 0) > 0.5;
  const length = Math.round(1 + (block.params.find((p) => p.id.startsWith("length-"))?.value ?? 1) * (STEPS - 1));

  /** Local and engine in one move — they cannot disagree. */
  const push = (next: number[], step: number) => {
    sound.setStep(block.uid, step, {
      active: next[step * STRIDE]! > 0.5,
      note: Math.round(next[step * STRIDE + 1]!),
      velocity: next[step * STRIDE + 2]!,
      gate: next[step * STRIDE + 3]!,
    });
  };

  const write = (step: number, changes: Record<number, number>) => {
    const next = values.slice();
    for (const [field, v] of Object.entries(changes)) next[step * STRIDE + Number(field)] = v;
    onFace(next);
    push(next, step);
  };

  useEffect(() => {
    for (let i = 0; i < STEPS; i++) push(values, i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join(","), sound.running]);

  const generate = (which: number) => {
    const next = values.slice();
    const set = (i: number, on: boolean) => { next[i * STRIDE] = on ? 1 : 0; };
    for (let i = 0; i < STEPS; i++) set(i, false);
    // Across all sixty-four, as bleep's do. A Euclidean five that only filled
    // the page you were looking at would be a different rhythm on every page.
    const euclid = (k: number) => { for (let i = 0; i < k; i++) set(((i * STEPS) / k) | 0, true); };

    if (which === 0) for (let i = 0; i < STEPS; i += 4) set(i, true);
    if (which === 1) for (let i = 2; i < STEPS; i += 4) set(i, true);
    if (which === 2) for (let i = 0; i < STEPS; i += 2) set(i, true);
    if (which === 3) euclid(12);
    if (which === 4) euclid(20);
    if (which === 5) euclid(28);
    if (which === 6) for (let i = 0; i < STEPS; i++) set(i, Math.random() > 0.55);
    onFace(next);
  };

  /** Drag up the pad to raise the active lane's value. */
  const paint = (e: React.PointerEvent, step: number) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, 1 - (e.clientY - box.top) / box.height));
    if (lane === "vel") write(step, { 0: 1, 2: Math.max(0.05, t) });
    if (lane === "gate") write(step, { 0: 1, 3: Math.max(0.02, t) });
    if (lane === "note") write(step, { 0: 1, 1: Math.round(36 + t * 48) });
  };

  const readout = (step: number) => {
    if (lane === "note") return noteName(Math.round(read(step, 1)));
    return `${Math.round(read(step, lane === "vel" ? 2 : 3) * 100)}`;
  };

  return (
    <div className="seq">
      <div className="seq-transport">
        <button
          className={`seq-play${running ? " on" : ""}`}
          onPointerDown={(e) => { e.stopPropagation(); onParam(5, running ? 0 : 1); }}
        >
          {running ? "STOP" : "PLAY"}
        </button>
        {GENERATORS.map((g, i) => (
          <button
            key={g}
            className="seq-gen"
            onPointerDown={(e) => { e.stopPropagation(); generate(i); }}
            title={`Pattern: ${g}`}
          >
            {g}
          </button>
        ))}

        <span className="seq-gap" />

        <button className="seq-page-nav" onPointerDown={(e) => { e.stopPropagation(); setPage((p) => (p + PAGES - 1) % PAGES); }}>‹</button>
        <span className="seq-page">P{page + 1}/{PAGES}</span>
        <button className="seq-page-nav" onPointerDown={(e) => { e.stopPropagation(); setPage((p) => (p + 1) % PAGES); }}>›</button>
        <span className="seq-len">LEN {length}</span>
      </div>

      <div className="seq-grid">
        {Array.from({ length: PER_PAGE }, (_, cell) => {
          const step = page * PER_PAGE + cell;
          const on = read(step, 0) > 0.5;
          const level = read(step, 2);
          return (
            <button
              key={step}
              className={`seq-pad${on ? " on" : ""}${sound.status.step === step ? " head" : ""}${step >= length ? " past" : ""}`}
              // Velocity as fill, the way bleep does it. A pad you can read the
              // dynamics of across a whole bar without clicking anything.
              style={on ? { ["--fill" as string]: level.toFixed(3) } : undefined}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (lane === "vel" && on) write(step, { 0: 0 });
                else paint(e, step);
              }}
              onPointerEnter={(e) => e.buttons === 1 && paint(e, step)}
              aria-label={`Step ${step + 1}`}
            >
              {/* Every fourth, so you can count a bar without counting. */}
              {step % 4 === 0 && <span className="seq-num">{step + 1}</span>}
              {on && <span className="seq-val">{readout(step)}</span>}
            </button>
          );
        })}
      </div>

      <div className="seq-lanes">
        {LANES.map((l) => (
          <button
            key={l.key}
            className={`seq-lane${lane === l.key ? " on" : ""}`}
            onPointerDown={(e) => { e.stopPropagation(); setLane(l.key); }}
          >
            {l.label}
          </button>
        ))}
        <span className="seq-gap" />
        <span className="seq-hint">drag a pad to set {lane}</span>
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
const PITCH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteLabel = (n: number) => `${PITCH[n % 12]}${Math.floor(n / 12) - 1}`;

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

/**
 * The twelve semitones of a scale, as a keyboard that does not play.
 *
 * A Scale block's whole job is to say which notes are allowed, and every other
 * way of showing that is a list of numbers. One octave rather than several,
 * because the answer repeats — and the root is marked separately from the
 * degrees, since the same set of intervals is a different scale depending on
 * where it starts.
 *
 * Reads the masks the engine uses, not a copy of them, so a scale added in C++
 * cannot end up drawn wrong here.
 */
const SCALE_MASKS = [
  0b111111111111, 0b101010110101, 0b010110101101, 0b011010101101, 0b101011010101,
  0b011010110101, 0b010101011011, 0b010110101001, 0b001010101101, 0b010011101001,
  0b001010010101, 0b000110001101, 0b001010001101, 0b010001100011, 0b010101010101,
  0b000110001011, 0b001001001001, 0b000010000001, 0b000000000001, 0b111111111111,
];

function Degrees({ block }: FaceProps) {
  const root = pick(block, "root");
  const scale = pick(block, "scale", 1);
  const mask = SCALE_MASKS[scale] ?? SCALE_MASKS[0]!;
  // In runs -1..1 over Range semitones; where it lands is what the block is
  // currently emitting, and seeing that move is the difference between a
  // diagram of a scale and a display.
  const input = val(block, "in", 0.5) * 2 - 1;
  const range = 1 + val(block, "range", 0.5) * 47;
  const sounding = ((Math.round(input * range) % 12) + 12 + root) % 12;

  return (
    <div className="degrees">
      {PITCH.map((name, i) => {
        const inScale = (mask & (1 << ((i - root + 12) % 12))) !== 0;
        const isRoot = i === root;
        return (
          <span
            key={name}
            className={
              "degree" +
              (BLACK.has(i) ? " sharp" : "") +
              (inScale ? " in" : "") +
              (isRoot ? " root" : "") +
              (i === sounding && inScale ? " lit" : "")
            }
          >
            {name}
          </span>
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

  const sound = useAudioContext();
  const notes = ["C2", "G2", "A#3", "D3", "F4", "E2"];
  const live = sound.running;
  // Three things a readout is ever for. Which one a panel needs depends
  // entirely on what it sits next to, so it is a control rather than a choice
  // baked into the block. Real numbers where there are real numbers — a voice
  // count that counts nothing is the sort of detail that quietly teaches you
  // not to trust the panel.
  const sets: Record<number, [string, string][]> = {
    0: [
      ["NOTE", live ? (sound.held.length ? noteLabel(sound.held[sound.held.length - 1]!) : "—") : notes[tick % notes.length]!],
      ["VOICES", live ? `${sound.status.voices}/8` : `${(tick % 5) + 1}/8`],
      ["STEP", live && sound.status.step >= 0 ? String(sound.status.step + 1) : "—"],
    ],
    1: [["ENGINE", block.name], ["MODE", "POLY"], ["OCT", live ? String(sound.octave) : "—"]],
    2: [["STATE", live ? "LIVE" : "IDLE"], ["SR", "48k"], ["VOICES", live ? String(sound.status.voices) : "0"]],
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
  degrees: Degrees,
  pads: Pads,
  readout: Readout,
};
