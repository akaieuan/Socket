import { cn } from "@/lib/utils";

/**
 * The icon set, drawn as pixels.
 *
 * The instruments' one piece of iconography is PixelRack — a grid of whole
 * cells, never a curve, never a stroke. Socket draws from the same tokens as
 * the plugins it composes, so it should draw from the same grammar too: a
 * borrowed icon set would be the only thing in the app not speaking the
 * language of the screens, and the sidebar is where you would notice.
 *
 * Seven by seven throughout. Five is enough for a ramp and a frame but not for
 * a crescent or an arrow, and two grids at one size read as two sets.
 *
 * Every glyph is a string. Adding one is a string.
 */

export type Bitmap = string;

/** One per block group, in signal order. */
export const GROUP_ICONS: Record<string, Bitmap> = {
  // A ramp — the shape a generator makes.
  Source: `
    ......#
    .....##
    ....###
    ...####
    ..#####
    .######
    #######`,
  // A lowpass knee: flat, the corner, gone.
  Shape: `
    .......
    #####..
    .....#.
    ......#
    ......#
    .......
    .......`,
  // A cycle.
  Modulate: `
    .......
    ##...##
    .#...#.
    .#...#.
    .#####.
    .......
    .......`,
  // Taps, decaying.
  Effect: `
    #......
    #......
    #..#...
    #..#...
    #..#..#
    #..#..#
    #..#..#`,
  // A matrix of patch points.
  Route: `
    #.#.#.#
    .......
    #.#.#.#
    .......
    #.#.#.#
    .......
    #.#.#.#`,
  // A framed screen with something lit in it.
  Display: `
    #######
    #.....#
    #..#..#
    #.###.#
    #..#..#
    #.....#
    #######`,
};

/** Everything the app itself needs an icon for. */
export const ICONS = {
  blocks: `
    ###.###
    ###.###
    ###.###
    .......
    ###.###
    ###.###
    ###.###`,
  grip: `
    .......
    .#...#.
    .......
    .#...#.
    .......
    .#...#.
    .......`,
  folder: `
    ###....
    #..#...
    #######
    #.....#
    #.....#
    #.....#
    #######`,
  sliders: `
    ..#....
    #####..
    ..#....
    .......
    ....#..
    ..#####
    ....#..`,
  layout: `
    #######
    #..#..#
    #..#..#
    #######
    #.....#
    #.....#
    #######`,
  signal: `
    ...#...
    ....#..
    #######
    ....#..
    ...#...
    .......
    .......`,
  moon: `
    ..###..
    .##....
    ##.....
    ##.....
    ##.....
    .##....
    ..###..`,
  sun: `
    ...#...
    #..#..#
    ..###..
    .#####.
    ..###..
    #..#..#
    ...#...`,
  panel: `
    #######
    ##....#
    ##....#
    ##....#
    ##....#
    ##....#
    #######`,
  plus: `
    .......
    ...#...
    ...#...
    #######
    ...#...
    ...#...
    .......`,
  chevronDown: `
    .......
    .......
    #######
    .#####.
    ..###..
    ...#...
    .......`,
  chevronUpDown: `
    ...#...
    ..###..
    .#####.
    .......
    .#####.
    ..###..
    ...#...`,
  save: `
    #######
    #.###.#
    #.###.#
    #.....#
    #.###.#
    #.###.#
    #######`,
  export: `
    ...#...
    ..###..
    .#.#.#.
    ...#...
    #.....#
    #.....#
    #######`,
  trash: `
    .#####.
    #######
    .......
    .#.#.#.
    .#.#.#.
    .#.#.#.
    .#####.`,
  close: `
    #.....#
    .#...#.
    ..#.#..
    ...#...
    ..#.#..
    .#...#.
    #.....#`,
  check: `
    .......
    .....#.
    ....##.
    #..##..
    ##.#...
    .###...
    ..#....`,
  up: `
    ...#...
    ..###..
    .#####.
    ...#...
    ...#...
    ...#...
    .......`,
  down: `
    .......
    ...#...
    ...#...
    ...#...
    .#####.
    ..###..
    ...#...`,
  spark: `
    ...#...
    ...#...
    ..###..
    #######
    ..###..
    ...#...
    ...#...`,
  dot: `
    .......
    .......
    ..###..
    ..###..
    ..###..
    .......
    .......`,
} satisfies Record<string, Bitmap>;

export type IconName = keyof typeof ICONS;

/**
 * Renders a bitmap as cells, the way PixelRack paints.
 *
 * Always 14px, never smaller, and that is load-bearing: seven cells into
 * fourteen pixels is exactly two pixels a cell, and a pixel glyph whose cells
 * land on fractions is a blurred glyph. At 12px the same grid gives 1.7px cells
 * and every shape turns to mush — which is what the first pass did.
 *
 * `gapped` is the difference between the two jobs the set does. Group glyphs
 * keep PixelRack's gap, because there the visible grid *is* the idea. Utility
 * glyphs — chevrons, arrows, a plus — fill their cells: at two pixels a cell
 * the gap eats most of the mark and a solid triangle reads where a dotted one
 * does not. Both are still built out of whole cells on the same grid, which is
 * what makes them one set.
 */
export function PixelIcon({
  bits, className, gapped = false,
}: { bits: Bitmap; className?: string; gapped?: boolean }) {
  const rows = bits.trim().split("\n").map((r) => r.trim());
  const n = rows.length;
  const cell = gapped ? 0.72 : 1;

  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      className={cn("size-3.5 shrink-0", className)}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rows.flatMap((row, j) =>
        [...row].map((c, i) =>
          c === "#" ? <rect key={`${i}-${j}`} x={i} y={j} width={cell} height={cell} fill="currentColor" /> : null,
        ),
      )}
    </svg>
  );
}

/** A block group's glyph: gapped, because there the grid is the point. */
export function GroupIcon({ group, className }: { group: string; className?: string }) {
  return <PixelIcon bits={GROUP_ICONS[group] ?? GROUP_ICONS.Display!} className={className} gapped />;
}

/** Everything else, by name. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <PixelIcon bits={ICONS[name]} className={className} />;
}
