import { useState } from "react";
import { CATALOG, place, type BlockDef, type Placed } from "./blocks/catalog";
import { Panel } from "./components/Panel";
import { Inspector } from "./components/Inspector";

/**
 * Socket — composing a plugin out of blocks.
 *
 * Built on mock blocks on purpose. The product risk here is not whether the DSP
 * can be extracted — it can, it is sitting in three plugins — but whether
 * composing an instrument this way feels like anything. That question is only
 * answerable by using it, and the answer determines what a block has to expose,
 * which is exactly the thing you cannot guess before building the UI.
 *
 * Everything renders in the instruments' own design language, from akaVST's
 * token source, so what you arrange here is what the plugin would look like.
 */
export function App() {
  const [face, setFace] = useState<Placed[]>([
    place(CATALOG[0]!),
    place(CATALOG[1]!),
    place(CATALOG[2]!),
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<BlockDef | null>(null);

  const add = (def: BlockDef) => {
    const p = place(def);
    setFace((f) => [...f, p]);
    setSelected(p.uid);
  };

  const setParam = (uid: string, id: string, v: number) =>
    setFace((f) =>
      f.map((b) =>
        b.uid === uid
          ? { ...b, params: b.params.map((p) => (p.id === id ? { ...p, value: v } : p)) }
          : b,
      ),
    );

  const current = face.find((b) => b.uid === selected) ?? null;

  return (
    <div className="app">
      <header className="chrome">
        <span className="wordmark">socket</span>
        <span className="label">plugin studio</span>
        <span className="chrome-spacer" />
        <span className="label">{face.length} blocks · nothing makes sound yet</span>
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
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragging) add(dragging);
            setDragging(null);
          }}
        >
          <p className="label stage-label">The plugin</p>
          <div className="face">
            {face.length === 0 && (
              <p className="empty">Drag a block here, or click one in the list.</p>
            )}
            {face.map((b) => (
              <Panel
                key={b.uid}
                block={b}
                selected={b.uid === selected}
                onSelect={() => setSelected(b.uid)}
                onParam={(id, v) => setParam(b.uid, id, v)}
                onRemove={() => {
                  setFace((f) => f.filter((x) => x.uid !== b.uid));
                  if (selected === b.uid) setSelected(null);
                }}
              />
            ))}
          </div>
        </main>

        <aside className="rail rail-right">
          <Inspector
            block={current}
            onParam={(id, v) => current && setParam(current.uid, id, v)}
            onSpan={(span) =>
              current &&
              setFace((f) => f.map((b) => (b.uid === current.uid ? { ...b, span } : b)))
            }
          />
        </aside>
      </div>
    </div>
  );
}
