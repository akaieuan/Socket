import { byType, minRowsFor } from "../model/catalog";
import type { BlockInstance, Param } from "../model/types";
import { Choice, Fader, Knob, Toggle } from "../design/faceControls";
import { FACES } from "../design/faces";

/**
 * A block, drawn as it would appear in the plugin and manipulable in place.
 *
 * Moved by its header, resized by its edges. That division is the whole reason
 * it works: with the panel itself draggable, reaching for a knob started a drag
 * of the box, and you could not tell whether a control was reactive because
 * touching one moved the thing you were touching. A window is dragged by its
 * title bar for exactly this reason.
 *
 * Right edge sets columns, bottom edge sets rows, the corner sets both. Setting
 * a size from a row of buttons describes a layout; dragging an edge is laying
 * one out, and for a tool whose question is whether composing this way feels
 * like anything, that difference is the product.
 *
 * Both axes snap to the grid, because free pixel sizes would let you build
 * faces no real editor could generate — which would make the preview a lie.
 */
export function Panel({
  block, selected, gridWidth, rowStep, wired, dragging,
  onSelect, onParam, onParamIndex, onFace, onBox, onRemove, onDragStart, onDragEnd, onDragOver,
}: {
  block: BlockInstance;
  selected: boolean;
  gridWidth: number;
  rowStep: number;
  wired: boolean;
  dragging: boolean;
  onSelect: () => void;
  onParam: (id: string, v: number) => void;
  /** By catalogue index, for faces that own one of their own parameters. */
  onParamIndex: (index: number, v: number) => void;
  onFace: (values: number[]) => void;
  onBox: (span: number, rows: number) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
}) {
  const def = byType(block.type);
  const Face = def?.face ? FACES[def.face] : null;
  const minSpan = def?.minSpan ?? 2;
  const minRows = def ? minRowsFor(def) : 3;

  /** One handler for all three grips; only the axes they own can move. */
  const resize = (axes: "x" | "y" | "both") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const colW = gridWidth / 12;
    const x0 = e.clientX, y0 = e.clientY;
    const s0 = block.span, r0 = block.rows;

    const move = (ev: PointerEvent) => {
      const span = axes === "y" ? s0
        : Math.max(minSpan, Math.min(12, s0 + Math.round((ev.clientX - x0) / colW)));
      const rows = axes === "x" ? r0
        : Math.max(minRows, Math.min(64, r0 + Math.round((ev.clientY - y0) / rowStep)));
      onBox(span, rows);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`panel${selected ? " panel-selected" : ""}${dragging ? " panel-dragging" : ""}`}
      style={{ gridColumn: `span ${block.span}`, gridRow: `span ${block.rows}` }}
      data-uid={block.uid}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* The header is the handle. Everything below it belongs to the controls. */}
      <div className="panel-head" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
          you read is above the things you turn — and it takes whatever height
          is left over, so dragging a panel taller makes its screen bigger
          rather than opening a hole underneath it. */}
      {Face && (
        <div className="panel-face">
          <Face block={block} onFace={onFace} onParam={(i, v) => onParamIndex(i, v)} />
        </div>
      )}

      {block.params.length > 0 && (
        <div className={`panel-body${Face ? "" : " panel-body-fill"}`}>
          {block.params.map((p) => (
            <Control key={p.id} param={p} onChange={(v) => onParam(p.id, v)} />
          ))}
        </div>
      )}

      {block.params.length === 0 && !Face && <span className="hint">No parameters</span>}

      <span className="grip grip-x" onPointerDown={resize("x")} title="Drag to set width" />
      <span className="grip grip-y" onPointerDown={resize("y")} title="Drag to set height" />
      <span className="grip grip-xy" onPointerDown={resize("both")} title="Drag to resize" />
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
