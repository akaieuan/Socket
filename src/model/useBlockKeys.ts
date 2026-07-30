import { useEffect } from "react";
import { byType, minRowsFor } from "./catalog";
import { allBlocks, findBlock } from "./project";
import type { Store } from "./useProject";

/**
 * The keyboard, for the selected block.
 *
 * Everything about a panel was drag-only: its size, its position in the order,
 * even removing it. Dragging is the right primary gesture — laying a panel out
 * is the product — but it is a poor way to move something by one column, and
 * it is no way at all to work if you cannot use a mouse precisely.
 *
 *   ← →        width, one column
 *   ↑ ↓        height, one row
 *   ⇧← ⇧→      move earlier or later in the layout order
 *   ⌫ / Delete remove
 *   Tab        next block, ⇧Tab previous
 *   Esc        deselect
 *
 * Arrows resize rather than move because resizing is the finer adjustment and
 * the one a drag is worst at — a row is eight pixels, and hitting that with a
 * grip on a scaled-down window is luck.
 */
export function useBlockKeys(store: Store) {
  const { project, selected } = store;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never take a key from a field someone is typing in — arrows move a
      // caret and Backspace deletes a character, and both matter more there.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const blocks = allBlocks(project);
      if (blocks.length === 0) return;

      // Tab cycles even with nothing selected — that is how you get started
      // without reaching for the mouse.
      if (e.key === "Tab") {
        e.preventDefault();
        // From the previous value, not the captured one — two presses in a tick
        // would otherwise both step off the same starting point.
        store.setSelected((prev) => {
          const at = blocks.findIndex((b) => b.uid === prev);
          const step = e.shiftKey ? -1 : 1;
          const next = at < 0
            ? (e.shiftKey ? blocks.length - 1 : 0)
            : (at + step + blocks.length) % blocks.length;
          const block = blocks[next]!;
          // Follow it to its page, or the selection is on something you cannot see.
          const page = project.pages.findIndex((pg) => pg.blocks.some((b) => b.uid === block.uid));
          if (page >= 0) store.setActivePage(page);
          return block.uid;
        });
        return;
      }

      if (!selected) return;
      const block = findBlock(project, selected);
      if (!block) return;
      const def = byType(block.type);

      switch (e.key) {
        case "Escape":
          store.setSelected(null);
          break;

        case "Backspace":
        case "Delete":
          e.preventDefault();
          store.removeBlock(selected);
          store.setSelected(null);
          break;

        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          if (e.shiftKey) {
            // Reorder, not resize. The neighbour in that direction is the one
            // it swaps with — which is what "move it left" means on a grid that
            // flows.
            const page = project.pages.find((pg) => pg.blocks.some((b) => b.uid === selected));
            const at = page?.blocks.findIndex((b) => b.uid === selected) ?? -1;
            const to = page?.blocks[at + dir];
            if (to) store.reorder(selected, to.uid);
          } else {
            store.nudgeSpan(selected, dir, def?.minSpan ?? 2);
          }
          break;
        }

        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const dir = e.key === "ArrowDown" ? 1 : -1;
          store.nudgeRows(selected, dir, def ? minRowsFor(def) : 3);
          break;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, selected, store]);
}
