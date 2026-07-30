import { useRef } from "react";
import type { Placed } from "../blocks/catalog";
import { Knob } from "./Knob";
import { Screen } from "./Screen";

/**
 * A block, drawn as it would appear in a plugin, and manipulable in place.
 *
 * Two things you can do to it directly rather than through a panel of controls:
 * drag it to reorder, and drag its right edge to resize. Setting width from a
 * row of buttons in an inspector is a description of a layout; dragging the edge
 * is laying one out. For a tool whose whole question is "does composing this way
 * feel like anything", that difference is the product.
 *
 * Resize snaps to the twelve-column grid, because the face is a grid — free
 * pixel widths would let you build faces that could never be generated as a real
 * editor.
 */
export function Panel({
  block,
  selected,
  gridWidth,
  onSelect,
  onParam,
  onCycle,
  onRemove,
  onSpan,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  block: Placed;
  selected: boolean;
  gridWidth: number;
  onSelect: () => void;
  onParam: (id: string, v: number) => void;
  onCycle: (id: string) => void;
  onRemove: () => void;
  onSpan: (span: number) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const colW = gridWidth / 12;
    const startX = e.clientX;
    const startSpan = block.span;

    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / colW);
      onSpan(Math.max(2, Math.min(12, startSpan + delta)));
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
      ref={ref}
      className={`panel${selected ? " panel-selected" : ""}`}
      style={{ gridColumn: `span ${block.span}` }}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
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
              <Knob key={p.id} label={p.label} value={p.value ?? 0} onChange={(v) => onParam(p.id, v)} />
            ) : (
              <div className="choice" key={p.id}>
                <button
                  className="choice-box"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onCycle(p.id);
                  }}
                >
                  {p.options?.[p.selected ?? 0]}
                </button>
                <span className="knob-label">{p.label}</span>
              </div>
            ),
          )
        )}
      </div>

      <span className="panel-grip" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
