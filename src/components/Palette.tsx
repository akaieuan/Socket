import { useMemo, useState } from "react";
import { CATALOG } from "@/model/catalog";
import { GROUPS, type Group } from "@/model/types";
import { Input } from "@/components/ui/input";
import { GROUP_ICONS, PixelIcon } from "@/design/PixelIcon";

/**
 * The block palette, grouped by what a block does to the signal.
 *
 * Source, Shape, Modulate, Effect, Route, Display — the same order a signal
 * travels, so the list reads as a chain rather than an alphabetised inventory.
 *
 * Collapsed by default. Forty-nine blocks laid out flat is a column you scroll
 * past rather than read; six labelled rows is something you can take in at a
 * glance and then open. Each carries its group's pixel glyph, which is the only
 * iconography the instruments have — a borrowed icon set would be the one thing
 * in the app not speaking the same language as the screens.
 *
 * The filter overrides the collapse: while you are searching, every group with
 * a hit opens itself. Hiding a match behind a closed section would make the
 * search worse than no search.
 */
export function Palette({
  onAdd, onDragBlock,
}: { onAdd: (type: string) => void; onDragBlock: (type: string | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Group[]>(["Source"]);

  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!needle) return CATALOG;
    return CATALOG.filter((d) =>
      `${d.name} ${d.group} ${d.from} ${d.face ?? ""}`.toLowerCase().includes(needle),
    );
  }, [needle]);

  const toggle = (g: Group) =>
    setOpen((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]));

  return (
    <>
      <div className="palette-search">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter blocks…" spellCheck={false} />
      </div>

      {GROUPS.map((group) => {
        const items = hits.filter((d) => d.group === group);
        if (items.length === 0) return null;
        const expanded = needle ? true : open.includes(group);

        return (
          <section className="group" key={group}>
            <button
              className={`group-head${expanded ? " open" : ""}`}
              onClick={() => toggle(group)}
              aria-expanded={expanded}
            >
              <PixelIcon bits={GROUP_ICONS[group]!} />
              <span className="group-name">{group}</span>
              <span className="group-count">{items.length}</span>
            </button>

            {expanded && (
              <div className="palette">
                {items.map((def) => (
                  <button
                    key={def.type}
                    /* Blocks with no DSP behind them are dimmed rather than
                       hidden. You can still build with them — that is the point
                       of building the tool first — but you should never be
                       unsure which half of your instrument exists. The
                       provenance moved to the tooltip and the inspector: shown
                       on every row it doubled the list's height to repeat
                       something you only need once. */
                    className={`palette-item${def.from.startsWith("—") ? " stub" : ""}`}
                    draggable
                    onDragStart={() => onDragBlock(def.type)}
                    onDragEnd={() => onDragBlock(null)}
                    onClick={() => onAdd(def.type)}
                    title={`${def.name} — ${def.from}`}
                  >
                    {def.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {hits.length === 0 && <p className="hint">Nothing matches “{q}”.</p>}
    </>
  );
}
