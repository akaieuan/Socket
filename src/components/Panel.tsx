import type { Placed } from "../blocks/catalog";
import { Knob } from "./Knob";
import { Screen } from "./Screen";

/**
 * A block, drawn as it would appear in a plugin.
 *
 * Same chrome as the instruments: a header with a tinted module tab, a hairline
 * border, no outline on the controls. If the preview does not look like the
 * thing it is previewing then composing here tells you nothing useful.
 */
export function Panel({
  block,
  selected,
  onSelect,
  onParam,
  onRemove,
}: {
  block: Placed;
  selected: boolean;
  onSelect: () => void;
  onParam: (id: string, v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`panel${selected ? " panel-selected" : ""}`}
      style={{ gridColumn: `span ${block.span}` }}
      onPointerDown={onSelect}
    >
      <div className="panel-head">
        <span className="panel-tab" />
        <span className="label">{block.name}</span>
        <button
          className="panel-remove"
          onPointerDown={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${block.name}`}
        >
          ×
        </button>
      </div>

      <div className="panel-body">
        {block.type === "screen" ? (
          <Screen />
        ) : (
          block.params.map((p) =>
            p.kind === "knob" ? (
              <Knob
                key={p.id}
                label={p.label}
                value={p.value ?? 0}
                onChange={(v) => onParam(p.id, v)}
              />
            ) : (
              <div className="choice" key={p.id}>
                <div className="choice-box">{p.options?.[p.selected ?? 0]}</div>
                <span className="knob-label">{p.label}</span>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
