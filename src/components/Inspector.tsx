import type { Placed } from "../blocks/catalog";

/**
 * The selected block's properties.
 *
 * Width is here rather than as a drag handle on the panel because a plugin face
 * is a grid, not a canvas — the instruments lay out in rows of panels, and
 * letting a block be any arbitrary size would produce compositions that could
 * never be generated as a real editor.
 */
export function Inspector({
  block,
  onParam,
  onSpan,
}: {
  block: Placed | null;
  onParam: (id: string, v: number) => void;
  onSpan: (span: number) => void;
}) {
  if (!block) {
    return (
      <>
        <p className="label">Inspector</p>
        <p className="hint">Select a block.</p>
      </>
    );
  }

  return (
    <>
      <p className="label">{block.name}</p>
      <p className="hint">{block.from}</p>

      <p className="label section">Width</p>
      <div className="span-row">
        {[3, 4, 5, 6, 12].map((s) => (
          <button
            key={s}
            className={`span-btn${block.span === s ? " on" : ""}`}
            onClick={() => onSpan(s)}
          >
            {s === 12 ? "full" : s}
          </button>
        ))}
      </div>

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
            <span className="param-value">{p.options?.[p.selected ?? 0]}</span>
          )}
        </div>
      ))}
    </>
  );
}
