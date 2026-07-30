import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Frame } from "@/components/Frame";
import { Panel } from "@/components/Panel";
import type { Store } from "@/model/useProject";
import { useAudioContext } from "@/audio";

/** One grid row unit, and the gap between them. Together they set the step. */
export const ROW = 8;
export const GAP = 8;

/**
 * Laying out one page of the plugin.
 *
 * Everything happens inside the bounded window, scaled to fit. With no frame
 * there is no layout problem, and with no layout problem there is nothing to
 * design — the constraint is what makes plugin layout a craft.
 */
export function LayoutView({ store, dragType, onDropBlock }: {
  store: Store;
  dragType: string | null;
  onDropBlock: () => void;
}) {
  const { project, activePage, selected } = store;
  const sound = useAudioContext();
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const pad = 56;
      setScale(Math.min(1, (el.clientWidth - pad) / project.size.w, (el.clientHeight - pad) / project.size.h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.size]);

  const page = project.pages[activePage];
  useFlip(body, page?.blocks.map((b) => b.uid).join() ?? "");

  return (
    <div
      className="stage"
      ref={stage}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => dragType && onDropBlock()}
      onPointerDown={() => store.setSelected(null)}
    >
      <Frame project={project} page={activePage} onPage={store.setActivePage} scale={scale} bodyRef={body}>
        {(page?.blocks.length ?? 0) === 0 && (
          <p className="empty">Drag a block in, or click one on the left.</p>
        )}
        {page?.blocks.map((b) => (
          <Panel
            key={b.uid}
            block={b}
            gridWidth={project.size.w - 24}
            rowStep={(ROW + GAP) * scale}
            selected={b.uid === selected}
            dragging={b.uid === dragging}
            wired={project.wires.some((w) => w.from === b.uid || w.to === b.uid)}
            onSelect={() => store.setSelected(b.uid)}
            /* Both, every time. The store owns the value the UI draws and the
               preset saves; the engine needs it inside the same frame or the
               knob moves before the sound does. */
            onParam={(id, v) => { store.setParam(b.uid, id, v); sound.setParam(b.uid, id, v); }}
            onParamIndex={(i, v) => {
              const id = b.params[i]?.id;
              if (id) { store.setParam(b.uid, id, v); sound.setParam(b.uid, id, v); }
            }}
            onFace={(v) => store.setFace(b.uid, v)}
            onBox={(span, rows) => store.setBox(b.uid, span, rows)}
            onRemove={() => { store.removeBlock(b.uid); if (selected === b.uid) store.setSelected(null); }}
            onDragStart={() => setDragging(b.uid)}
            onDragEnd={() => setDragging(null)}
            /* Reordering happens on hover, not on drop. Blocks moving out of
               the way as you pass over them is what makes placement read as
               magnetic; committing on release means nothing moves until it is
               already too late to change your mind. */
            onDragOver={() => { if (dragging && dragging !== b.uid) store.reorder(dragging, b.uid); }}
          />
        ))}
      </Frame>
    </div>
  );
}

/**
 * FLIP: make the grid's reflow look like movement.
 *
 * Grid items do not transition between cells — a reorder is an instant jump,
 * and a jump reads as a glitch rather than as a block making room. So measure
 * where everything was, let React place it, then put each panel back where it
 * started with a transform and release it. The browser animates the release.
 *
 * Keyed on the uid order so it only runs when the arrangement actually changed.
 * Running it on every render would fight the resize grips, which change a
 * panel's box every frame on purpose.
 */
function useFlip(container: React.RefObject<HTMLDivElement | null>, order: string) {
  const before = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const panels = [...root.querySelectorAll<HTMLElement>("[data-uid]")];

    for (const el of panels) {
      const uid = el.dataset.uid!;
      const was = before.current.get(uid);
      const now = el.getBoundingClientRect();

      if (was) {
        const dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
            el.style.transform = "";
          });
        }
      }
      before.current.set(uid, now);
    }

    // Panels that left take their measurement with them.
    const live = new Set(panels.map((el) => el.dataset.uid));
    for (const uid of [...before.current.keys()]) if (!live.has(uid)) before.current.delete(uid);
  }, [order, container]);
}
