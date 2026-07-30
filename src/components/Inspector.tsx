import type { Placed } from "../blocks/catalog";
import { SIZES, ACCENTS, type PluginState, type Accent } from "../plugin";

/**
 * Plugin settings when nothing is selected, block settings when something is.
 *
 * The plugin half matters more than it looks: window size and accent are the two
 * decisions that shape every layout choice after them, and they had nowhere to
 * live while the face was an unbounded grid.
 */
export function Inspector({
  plugin,
  setPlugin,
  block,
  onParam,
  onCycle,
  onSpan,
}: {
  plugin: PluginState;
  setPlugin: (p: PluginState) => void;
  block: Placed | null;
  onParam: (id: string, v: number) => void;
  onCycle: (id: string) => void;
  onSpan: (span: number) => void;
}) {
  if (!block) {
    return (
      <>
        <p className="label">Plugin</p>

        <input
          className="name-input"
          value={plugin.name}
          onChange={(e) => setPlugin({ ...plugin, name: e.target.value })}
          spellCheck={false}
        />

        <p className="label section">Window</p>
        <div className="size-list">
          {SIZES.map((s) => (
            <button
              key={s.name}
              className={`size-btn${plugin.size.name === s.name ? " on" : ""}`}
              onClick={() => setPlugin({ ...plugin, size: s })}
            >
              <span>{s.name}</span>
              <span className="size-dim">
                {s.w}×{s.h}
                {s.from ? ` · ${s.from}` : ""}
              </span>
            </button>
          ))}
        </div>

        <p className="label section">Accent</p>
        <div className="accent-row">
          {ACCENTS.map((a) => (
            <button
              key={a}
              className={`accent-dot${plugin.accent === a ? " on" : ""}`}
              style={{ background: `var(--accent-${a})` }}
              onClick={() => setPlugin({ ...plugin, accent: a as Accent })}
              aria-label={a}
            />
          ))}
        </div>

        <p className="hint section">
          One accent per instrument — the house rule. Select a block to edit it, drag a panel to
          reorder, drag its right edge to resize.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="label">{block.name}</p>
      <p className="hint">{block.from}</p>

      <p className="label section">Width · {block.span}/12</p>
      <input
        className="span-slider"
        type="range"
        min={2}
        max={12}
        step={1}
        value={block.span}
        onChange={(e) => onSpan(Number(e.target.value))}
      />

      {block.params.length > 0 && <p className="label section">Parameters</p>}
      {block.params.map((p) => (
        <div className="param" key={p.id}>
          <span className="param-name">{p.label}</span>
          {p.kind === "knob" ? (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={p.value ?? 0}
              onChange={(e) => onParam(p.id, Number(e.target.value))}
            />
          ) : (
            <button className="param-choice" onClick={() => onCycle(p.id)}>
              {p.options?.[p.selected ?? 0]}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
