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

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const cols = Math.max(12, Math.floor(w / 7));
    const rows = Math.max(5, Math.floor(h / 7));
    const cw = w / cols;
    const ch = h / rows;
    const gap = 0.2;
    const px = Math.min(cw, ch) * (1 - gap);

    const bands = new Array(cols).fill(0);
    const peaks = new Array(cols).fill(0);
    let raf = 0;
    let t = 0;

    const styles = getComputedStyle(document.documentElement);
    const read = (n: string) => styles.getPropertyValue(n).trim();

    const draw = () => {
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
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="screen" />;
}
