import { byType } from "../model/catalog";
import type { BlockInstance, Param } from "../model/types";
import { Choice, Fader, Knob, Toggle } from "../design/faceControls";
import { FACES } from "../design/faces";

/**
 * A block, drawn as it would appear in the plugin and manipulable in place.
 *
 * Drag to reorder, drag the right edge to resize. Setting width from a row of
 * buttons describes a layout; dragging the edge is laying one out, and for a
 * tool whose question is whether composing this way feels like anything, that
 * difference is the product.
 *
 * Resize snaps to the twelve-column grid, because free pixel widths would let
 * you build faces no real editor could generate — which would make the preview
 * a lie.
 */
export function Panel({
  block, selected, gridWidth, wired,
  onSelect, onParam, onFace, onSpan, onRemove, onDragStart, onDragOver, onDrop,
}: {
  block: BlockInstance;
  selected: boolean;
  gridWidth: number;
  wired: boolean;
  onSelect: () => void;
  onParam: (id: string, v: number) => void;
  onFace: (values: number[]) => void;
  onSpan: (span: number) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const def = byType(block.type);
  const Face = def?.face ? FACES[def.face] : null;
  const floor = def?.minSpan ?? 2;

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const colW = gridWidth / 12;
    const x0 = e.clientX;
    const s0 = block.span;
    const move = (ev: PointerEvent) =>
      onSpan(Math.max(floor, Math.min(12, s0 + Math.round((ev.clientX - x0) / colW))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`panel${selected ? " panel-selected" : ""}`}
      style={{ gridColumn: `span ${block.span}` }}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="panel-head">
        <span className="panel-tab" />
        <span className="label">{block.name}</span>
        {/* A block in the audio path is marked, because layout order and signal
            order are different things and the face cannot show the second. */}
        {wired && <span className="panel-wired" title="In the signal path" />}
        <button
          className="panel-remove"
          onPointerDown={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove ${block.name}`}
        >
          ×
        </button>
      </div>

      {/* The face sits above the controls, because on real hardware the thing
          you read is above the things you turn. */}
      {Face && (
        <div className="panel-face">
          <Face block={block} onFace={onFace} />
        </div>
      )}

      {block.params.length > 0 && (
        <div className="panel-body">
          {block.params.map((p) => (
            <Control key={p.id} param={p} onChange={(v) => onParam(p.id, v)} />
          ))}
        </div>
      )}

      {block.params.length === 0 && !Face && <span className="hint">No parameters</span>}

      <span className="panel-grip" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}

/** One parameter, in whichever shape it declares. */
function Control({ param: p, onChange }: { param: Param; onChange: (v: number) => void }) {
  switch (p.kind) {
    case "knob":
      return <Knob label={p.label} value={p.value} onChange={onChange} />;
    case "fader":
      return <Fader label={p.label} value={p.value} onChange={onChange} />;
    case "toggle":
      return <Toggle label={p.label} on={p.value > 0.5} onToggle={() => onChange(p.value > 0.5 ? 0 : 1)} />;
    case "choice":
      return (
        <Choice
          label={p.label}
          options={p.options ?? []}
          index={p.value}
          onCycle={() => onChange((p.value + 1) % Math.max(1, p.options?.length ?? 1))}
        />
      );
  }
}
