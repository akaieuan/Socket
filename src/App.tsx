import { useEffect, useRef, useState } from "react";
import { CATALOG, place, type BlockDef, type Placed } from "./blocks/catalog";
import { initialPlugin, SIZES, ACCENTS, type PluginState } from "./plugin";
import { Frame } from "./components/Frame";
import { Panel } from "./components/Panel";
import { Inspector } from "./components/Inspector";

/**
 * Socket — laying out a plugin.
 *
 * The first pass rendered blocks into an unbounded grid, which is why it read as
 * a list of cards rather than an editor: with no frame there is no layout
 * problem, and with no layout problem there is nothing to design. Everything now
 * happens inside a fixed-size plugin window, scaled to fit, so the constraint
 * that makes plugin layout an actual craft is present.
 */
export function App() {
  const [plugin, setPlugin] = useState<PluginState>(initialPlugin);
  const [face, setFace] = useState<Placed[]>([
    place(CATALOG[0]!),
    place(CATALOG[1]!),
    place(CATALOG[2]!),
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<BlockDef | null>(null);
  const [reorder, setReorder] = useState<{ from: string; over: string | null }>({ from: "", over: null });

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Fit the whole face in the stage. A plugin editor is fixed-size, and seeing
  // all of it at once is the point of having a frame.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const pad = 56;
      setScale(
        Math.min(
          1,
          (el.clientWidth - pad) / plugin.size.w,
          (el.clientHeight - pad) / plugin.size.h,
        ),
      );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [plugin.size]);

  const add = (def: BlockDef) => {
    const p = place(def);
    setFace((f) => [...f, p]);
    setSelected(p.uid);
  };

  const patch = (uid: string, fn: (b: Placed) => Placed) =>
    setFace((f) => f.map((b) => (b.uid === uid ? fn(b) : b)));

  const setParam = (uid: string, id: string, v: number) =>
    patch(uid, (b) => ({ ...b, params: b.params.map((p) => (p.id === id ? { ...p, value: v } : p)) }));

  const cycle = (uid: string, id: string) =>
    patch(uid, (b) => ({
      ...b,
      params: b.params.map((p) =>
        p.id === id && p.options
          ? { ...p, selected: ((p.selected ?? 0) + 1) % p.options.length }
          : p,
      ),
    }));

  const commitReorder = () => {
    const { from, over } = reorder;
    if (!from || !over || from === over) return setReorder({ from: "", over: null });
    setFace((f) => {
      const next = [...f];
      const a = next.findIndex((b) => b.uid === from);
      const bIdx = next.findIndex((b) => b.uid === over);
      const [moved] = next.splice(a, 1);
      next.splice(bIdx, 0, moved!);
      return next;
    });
    setReorder({ from: "", over: null });
  };

  const current = face.find((b) => b.uid === selected) ?? null;
  const gridWidth = plugin.size.w - 24;

  return (
    <div className="app">
      <header className="chrome">
        <span className="wordmark">socket</span>
        <span className="label">plugin studio</span>
        <span className="chrome-spacer" />
        <span className="label">
          {face.length} blocks · {Math.round(scale * 100)}% · nothing makes sound yet
        </span>
      </header>

      <div className="workspace">
        <aside className="rail">
          <p className="label">Blocks</p>
          <div className="palette">
            {CATALOG.map((def) => (
              <button
                key={def.type}
                className="palette-item"
                draggable
                onDragStart={() => setDragging(def)}
                onDragEnd={() => setDragging(null)}
                onClick={() => add(def)}
              >
                <span className="palette-name">{def.name}</span>
                <span className="palette-from">{def.from}</span>
              </button>
            ))}
          </div>
        </aside>

        <main
          className="stage"
          ref={stageRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragging) add(dragging);
            setDragging(null);
          }}
          onPointerDown={() => setSelected(null)}
        >
          <Frame plugin={plugin} scale={scale}>
            {face.length === 0 && <p className="empty">Drag a block in, or click one on the left.</p>}
            {face.map((b) => (
              <Panel
                key={b.uid}
                block={b}
                gridWidth={gridWidth}
                selected={b.uid === selected}
                onSelect={() => setSelected(b.uid)}
                onParam={(id, v) => setParam(b.uid, id, v)}
                onCycle={(id) => cycle(b.uid, id)}
                onSpan={(span) => patch(b.uid, (x) => ({ ...x, span }))}
                onRemove={() => {
                  setFace((f) => f.filter((x) => x.uid !== b.uid));
                  if (selected === b.uid) setSelected(null);
                }}
                onDragStart={() => setReorder({ from: b.uid, over: null })}
                onDragOver={() => setReorder((r) => (r.over === b.uid ? r : { ...r, over: b.uid }))}
                onDrop={commitReorder}
              />
            ))}
          </Frame>
        </main>

        <aside className="rail rail-right">
          <Inspector
            plugin={plugin}
            setPlugin={setPlugin}
            block={current}
            onParam={(id, v) => current && setParam(current.uid, id, v)}
            onCycle={(id) => current && cycle(current.uid, id)}
            onSpan={(span) => current && patch(current.uid, (b) => ({ ...b, span }))}
          />
        </aside>
      </div>
    </div>
  );
}
