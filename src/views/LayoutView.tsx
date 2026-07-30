import { useEffect, useRef, useState } from "react";
import { Frame } from "../components/Frame";
import { Panel } from "../components/Panel";
import type { Store } from "../model/useProject";

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
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [reorder, setReorder] = useState<{ from: string; over: string | null }>({ from: "", over: null });

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
  const gridWidth = project.size.w - 24;

  const commit = () => {
    if (reorder.from && reorder.over && reorder.from !== reorder.over) {
      store.reorder(reorder.from, reorder.over);
    }
    setReorder({ from: "", over: null });
  };

  return (
    <div
      className="stage"
      ref={stage}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => dragType && onDropBlock()}
      onPointerDown={() => store.setSelected(null)}
    >
      <Frame project={project} page={activePage} onPage={store.setActivePage} scale={scale}>
        {(page?.blocks.length ?? 0) === 0 && (
          <p className="empty">Drag a block in, or click one on the left.</p>
        )}
        {page?.blocks.map((b) => (
          <Panel
            key={b.uid}
            block={b}
            gridWidth={gridWidth}
            selected={b.uid === selected}
            wired={project.wires.some((w) => w.from === b.uid || w.to === b.uid)}
            onSelect={() => store.setSelected(b.uid)}
            onParam={(id, v) => store.setParam(b.uid, id, v)}
            onFace={(v) => store.setFace(b.uid, v)}
            onSpan={(s) => store.setSpan(b.uid, s)}
            onRemove={() => { store.removeBlock(b.uid); if (selected === b.uid) store.setSelected(null); }}
            onDragStart={() => setReorder({ from: b.uid, over: null })}
            onDragOver={() => setReorder((r) => (r.over === b.uid ? r : { ...r, over: b.uid }))}
            onDrop={commit}
          />
        ))}
      </Frame>
    </div>
  );
}
