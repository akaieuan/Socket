/**
 * Icons drawn as pixels, in the same grammar as the screens.
 *
 * The instruments' one piece of iconography is PixelRack — a grid of whole
 * cells, never a curve, never a stroke. An icon set borrowed from anywhere else
 * would be the only thing in the app not speaking that language, so these are
 * bitmaps: five by five, one glyph per string, cells on where the character is
 * `#`.
 *
 * Five is the smallest grid that can hold a recognisable ramp, knee, cycle and
 * frame. Larger reads as illustration at this size, smaller as noise.
 */

export type Bitmap = string;

/** One per block group, in signal order. */
export const GROUP_ICONS: Record<string, Bitmap> = {
  // A ramp — the shape a generator makes.
  Source: `
    ....#
    ...##
    ..###
    .####
    #####`,
  // A lowpass knee: flat, then the corner, then gone.
  Shape: `
    #####
    .....
    ...#.
    ....#
    ....#`,
  // A cycle.
  Modulate: `
    .#...
    #.#..
    #.#.#
    ...#.
    ...#.`,
  // Taps, decaying.
  Effect: `
    #....
    #....
    #.#..
    #.#..
    #.#.#`,
  // A matrix of patch points.
  Route: `
    #.#.#
    .....
    #.#.#
    .....
    #.#.#`,
  // A framed screen with something lit inside.
  Display: `
    #####
    #...#
    #.#.#
    #...#
    #####`,
};

/**
 * Renders a bitmap as whole cells with gaps, exactly as PixelRack paints.
 *
 * `size` is the drawn edge in pixels; the cell and gap are derived from it so
 * the glyph stays on grid at any size rather than blurring between cells.
 */
export function PixelIcon({ bits, size = 15 }: { bits: Bitmap; size?: number }) {
  const rows = bits.trim().split("\n").map((r) => r.trim());
  const n = rows.length;
  const step = size / n;
  const cell = step * 0.76;

  return (
    <svg className="pixel-icon" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      {rows.flatMap((row, j) =>
        [...row].map((c, i) =>
          c === "#" ? (
            <rect key={`${i}-${j}`} x={i * step} y={j * step} width={cell} height={cell} />
          ) : null,
        ),
      )}
    </svg>
  );
}
