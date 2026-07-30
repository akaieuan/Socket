# Socket

A desktop studio for building audio plugins out of blocks. Electron, React,
TypeScript, running on port 4200.

You drag blocks onto a plugin window, lay them out on a twelve-column grid,
rename their parameters, and wire the audio path. What you compose is what the
plugin looks like — the controls are ports of the same `LookAndFeel` the
instruments use, drawn from the same generated design tokens, so the preview is
not an approximation of the result.

**Nothing makes sound yet.** Every block in the catalogue names DSP that exists
today inside [akaVST](https://github.com/akaieuan/akaVST)'s three instruments —
bleep, enzyme, i4 — or is marked `— not built`. Extracting that DSP into the
shared skeleton is the next piece of work, and it is deliberately second:
building the tool is what tells us what a block has to expose, and guessing
before building it is how you get an abstraction nobody can use.

## Running it

```bash
pnpm install && pnpm dev
```

`pnpm dev` starts Vite on 4200 and opens the Electron window against it.
`pnpm build` typechecks, bundles the renderer, and compiles the main process.

## Shape of it

```
src/
  model/        the project value and every operation over it
    types.ts      Project → Page → BlockInstance → Param, plus Ports and Face
    catalog.ts    the forty-nine block definitions
    project.ts    pure transforms: instantiate, findBlock, audioBlocks
    useProject.ts the one place state changes
  design/       the drawing vocabulary
    controls.tsx      app chrome: Section, Field, TextInput, Segmented
    faceControls.tsx  plugin controls: Knob, Fader, Choice, Toggle
    faces.tsx         everything a block draws that is not a knob
  components/   Frame, Panel, Palette, Inspector
  views/        LayoutView, SignalView
```

The split that matters is `design/controls` versus `design/faceControls`. The
first is Socket's own interface; the second is the plugin's. They must not drift
into each other — the moment the app starts drawing knobs its own way, the
preview stops being a preview.

## The four concepts

The first prototype was a layout tool wearing a plugin's clothes. Four things
turned out to be structural rather than features:

**Pages.** A plugin is not one face. bleep has Synth and FX, enzyme has five.
Tabs painted onto a frame are decoration; pages that own their own layout are
what a plugin actually is.

**Ports.** A block that only has parameters cannot be wired to anything, so
block order was purely visual. Audio has to be a separate dimension from layout,
because in a real instrument it is — a filter drawn to the left of an oscillator
is a layout choice, not a routing one. That is what the Signal view is for.

**Params.** Nameable and reorderable, because what a knob is called and where it
sits is most of the design work in a plugin panel.

**Faces.** A patch bay, a step grid, a keyboard and a scope are each the point of
the panel they sit on. A builder whose only vocabulary is knobs can only build
one kind of plugin, and the prototype hardcoded two widgets into the renderer,
which put a ceiling on the catalogue at two. They are one registry now
(`design/faces.tsx`) and face state lives on the block instance, so a patch you
spent a minute making survives reordering the panel it sits on.

A face reads its own block's parameters, by id rather than by label so renaming
a knob cannot break it. The screen's Mode, Rate, Tilt and Decay all change what
it draws; the analyser's Smooth is a real one-pole on each bar; the envelope's
Curve bends the drawn shape. A display whose controls do nothing is a
screensaver.

## Panels are containers

A panel is a CSS query container, so knobs, faders, choice boxes, faces and the
gaps between them all size off the panel rather than the window, and the
controls distribute across the width instead of huddling at its left edge. Four
knobs stranded in half a plugin was the symptom; the fix is controls that grow
into the room they are given, which is what hardware does. Adding parameters to
fill space would have been the wrong answer — the parameters are whatever the
DSP has.

## Pages are yours

One page holding synth, mod and FX is a whole instrument; so is five. Pages are
renameable, removable, and a block moves between them from its own inspector.
Nothing about the catalogue assumes a particular page structure.

## Icons

`design/PixelIcon.tsx` is the whole set, as bitmaps. The instruments' one piece
of iconography is PixelRack — whole cells, never a curve, never a stroke — so a
borrowed icon set would be the only thing in the app not speaking the language
of the screens.

Two rules make them legible: always 14px (seven cells into fourteen pixels is
exactly two pixels a cell, and a glyph whose cells land on fractions is a
blurred glyph), and group glyphs keep PixelRack's gap while utility glyphs fill
their cells — at two pixels a cell the gap eats most of a chevron.

Adding one is a string.

## shadcn, on the generated tokens

The app shell — title bar, activity rail, inspector, menus, tooltips — is
shadcn/ui on Tailwind v4, including its Sidebar. It did not bring a palette with it: `@theme inline`
in the generated stylesheet points every Tailwind colour at the akaVST
variables, and shadcn's own `--sidebar-*` names are aliases onto them. A
component dropped in by `npx shadcn@latest add` therefore arrives already
wearing akaSTYLE, with nothing to restyle by hand.

**The plugin face is not shadcn and must not become so.** Knobs, faders, choice
boxes and every face in `design/faces.tsx` are hand-drawn ports of skeleton's
`LookAndFeel`. The premise of the tool is that what you compose is what the
plugin looks like, and a preview drawn in a slightly different dialect breaks
that quietly. The line runs at the edge of the plugin window: outside it,
shadcn; inside it, ports.

## Design tokens

The palette is not defined here. `pnpm sync:tokens` reads
`web/src/content/tokens.generated.json` out of the akaVST repo and writes
`src/styles.css`. That file is generated from `web/src/design/tokens.ts`, the
same source that emits the site's CSS and the plugins' `Tokens.h`. A copied
palette is one that will be wrong within a month.

The generated output is committed, so nothing here depends on having run the
sync.
