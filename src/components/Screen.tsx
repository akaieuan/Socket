import { useEffect, useRef } from "react";

/**
 * The pixel screen, as a block.
 *
 * A standing-in version of skeleton's PixelRack: whole cells, a two-grey
 * substrate, a spectral bloom radiating from the centre column. It is driven by
 * a shaped noise walk rather than by audio, because there is no audio here yet —
 * but the grammar is the real one, so a composed face shows what the instrument
 * would actually look like rather than a grey rectangle labelled "screen".
 */
export function Screen() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Re-measured on every resize, not once at mount.
    //
    // Sizing the backing store a single time means widening the panel stretches
    // stale pixels — the cells smear and the grid stops being whole cells, which
    // is the one property the whole grammar depends on. A ResizeObserver rebuilds
    // the grid instead, so the cell size stays constant and the column count
    // changes, which is what resizing a pixel display should do.
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let cw = 0;
    let ch = 0;
    let px = 0;
    let bands: number[] = [];
    let peaks: number[] = [];
    const gap = 0.2;

    const measure = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Constant cell size: more room means more cells, never bigger ones.
      const cell = 7;
      cols = Math.max(12, Math.floor(w / cell));
      rows = Math.max(5, Math.floor(h / cell));
      cw = w / cols;
      ch = h / rows;
      px = Math.min(cw, ch) * (1 - gap);
      bands = new Array(cols).fill(0);
      peaks = new Array(cols).fill(0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    let raf = 0;
    let t = 0;

    const styles = getComputedStyle(document.documentElement);
    const read = (n: string) => styles.getPropertyValue(n).trim();

    const draw = () => {
      if (cols === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      t += 0.045;
      const centre = Math.floor(cols / 2);
      const mid = Math.floor(rows / 2);
      const reach = Math.max(1, Math.floor(rows / 2));

      ctx.clearRect(0, 0, w, h);

      for (let c = 0; c < cols; c++) {
        const pos = Math.abs(c - centre) / Math.max(1, centre);
        // Low end in the middle, rolling off outward, with drift so it evolves.
        const energy =
          (1 - pos) ** 1.6 *
          (0.55 + 0.45 * Math.sin(t * 1.3 + c * 0.35)) *
          (0.7 + 0.3 * Math.sin(t * 0.6 + c * 0.11));
        bands[c] = Math.max(0, Math.min(1, energy * (1 + pos * 1.4)));
        const hgt = Math.round(bands[c] * reach);
        peaks[c] = hgt > peaks[c] ? hgt : Math.max(0, peaks[c] - 0.14);
      }

      const panel = read("--mark-panel") || "rgba(255,255,255,0.04)";
      const screen = read("--mark-screen") || "rgba(255,255,255,0.08)";
      const accent = read("--accent-blue");

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const hgt = Math.round(bands[i] * reach);
          const carved = hgt > 0 && Math.abs(j - mid) <= hgt;
          ctx.fillStyle = carved ? screen : panel;
          ctx.fillRect(i * cw, j * ch, cw, ch);
        }
      }

      ctx.fillStyle = read("--muted-foreground");
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const hgt = Math.round(bands[i] * reach);
          if (hgt > 0 && Math.abs(j - mid) <= hgt) continue;
          ctx.fillRect(i * cw + (cw - px) / 2, j * ch + (ch - px) / 2, px, px);
        }
      }

      ctx.fillStyle = accent;
      for (let i = 0; i < cols; i++) {
        const hgt = Math.round(bands[i] * reach);
        if (hgt <= 0) continue;
        for (const j of [mid - hgt, mid + hgt]) {
          if (j < 0 || j >= rows) continue;
          ctx.fillRect(i * cw + (cw - px) / 2, j * ch + (ch - px) / 2, px, px);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="screen" />;
}
