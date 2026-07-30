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

## Design tokens

The palette is not defined here. `pnpm sync:tokens` reads
`web/src/content/tokens.generated.json` out of the akaVST repo and writes
`src/styles.css`. That file is generated from `web/src/design/tokens.ts`, the
same source that emits the site's CSS and the plugins' `Tokens.h`. A copied
palette is one that will be wrong within a month.

The generated output is committed, so nothing here depends on having run the
sync.
