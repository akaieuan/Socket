import { useMemo, useState } from "react";
import { CATALOG } from "../model/catalog";
import { GROUPS } from "../model/types";
import { Section, TextInput } from "../design/controls";

/**
 * The block palette, grouped by what a block does to the signal.
 *
 * Source, Shape, Modulate, Effect, Route, Display — the same order a signal
 * travels, so the list reads as a chain rather than an alphabetised inventory.
 *
 * The filter is not a nicety at this length. Forty-eight blocks in a 220px rail
 * is a list you hunt through, and hunting is what stops someone reaching for
 * the block they half-remember. It matches the name, the group and the
 * provenance, so "bleep" finds everything lifted out of bleep.
 */
export function Palette({
  onAdd, onDragBlock,
}: { onAdd: (type: string) => void; onDragBlock: (type: string | null) => void }) {
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CATALOG;
    return CATALOG.filter((d) =>
      `${d.name} ${d.group} ${d.from} ${d.face ?? ""}`.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <>
      <div className="palette-search">
        <TextInput value={q} onChange={setQ} placeholder="Filter blocks…" />
        <p className="palette-count">
          {hits.length} of {CATALOG.length} blocks
        </p>
      </div>

      {GROUPS.map((group) => {
        const items = hits.filter((d) => d.group === group);
        if (items.length === 0) return null;
        return (
          <Section key={group} title={group}>
            <div className="palette">
              {items.map((def) => (
                <button
                  key={def.type}
                  /* Blocks with no DSP behind them are dimmed rather than
                     hidden. You can still build with them — that is the point
                     of building the tool first — but you should never be
                     unsure which half of your instrument exists. */
                  className={`palette-item${def.from.startsWith("—") ? " stub" : ""}`}
                  draggable
                  onDragStart={() => onDragBlock(def.type)}
                  onDragEnd={() => onDragBlock(null)}
                  onClick={() => onAdd(def.type)}
                  title={def.from}
                >
                  <span className="palette-name">{def.name}</span>
                  <span className="palette-from">{def.from}</span>
                </button>
              ))}
            </div>
          </Section>
        );
      })}

      {hits.length === 0 && <p className="hint">Nothing matches “{q}”.</p>}
    </>
  );
}
