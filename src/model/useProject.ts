import { useCallback, useState } from "react";
import { instantiate, initialProject } from "./project";
import type { Accent, BlockInstance, Project, Size } from "./types";

/**
 * The single place project state changes.
 *
 * Thin on purpose — every operation is a pure transform over the project value,
 * so the component tree never mutates anything and the whole state is one object
 * that could be serialised, diffed or undone. That matters more here than in a
 * typical app: the eventual output of Socket is this value compiled to a plugin.
 */
let pageSeq = 0;
const nextPageId = () => `page-${++pageSeq}`;

export function useProject() {
  const [project, setProject] = useState<Project>(initialProject);
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const edit = useCallback((fn: (p: Project) => Project) => setProject(fn), []);

  const patchBlock = useCallback(
    (uid: string, fn: (b: BlockInstance) => BlockInstance) =>
      edit((p) => ({
        ...p,
        pages: p.pages.map((pg) => ({
          ...pg,
          blocks: pg.blocks.map((b) => (b.uid === uid ? fn(b) : b)),
        })),
      })),
    [edit],
  );

  return {
    project,
    activePage,
    setActivePage,
    selected,
    setSelected,

    setName: (name: string) => edit((p) => ({ ...p, name })),
    setSize: (size: Size) => edit((p) => ({ ...p, size })),
    setAccent: (accent: Accent) => edit((p) => ({ ...p, accent })),

    addPage: () => {
      // Switch to it. Adding a page and then a block, and having the block land
      // on the page you just left, is the kind of thing only using the tool
      // finds. The id counter is separate from the count so it survives removals.
      edit((p) => ({
        ...p,
        pages: [...p.pages, { id: nextPageId(), name: `Page ${p.pages.length + 1}`, blocks: [] }],
      }));
      setActivePage(project.pages.length);
    },

    renamePage: (i: number, name: string) =>
      edit((p) => ({ ...p, pages: p.pages.map((pg, k) => (k === i ? { ...pg, name } : pg)) })),

    removePage: (i: number) => {
      edit((p) => (p.pages.length <= 1 ? p : { ...p, pages: p.pages.filter((_, k) => k !== i) }));
      setActivePage((a) => (a >= i && a > 0 ? a - 1 : a));
    },

    addBlock: (type: string) => {
      const b = instantiate(type);
      if (!b) return;
      edit((p) => ({
        ...p,
        pages: p.pages.map((pg, k) => (k === activePage ? { ...pg, blocks: [...pg.blocks, b] } : pg)),
      }));
      setSelected(b.uid);
    },

    removeBlock: (uid: string) =>
      edit((p) => ({
        ...p,
        pages: p.pages.map((pg) => ({ ...pg, blocks: pg.blocks.filter((b) => b.uid !== uid) })),
        // A removed block cannot stay in the signal path.
        wires: p.wires.filter((w) => w.from !== uid && w.to !== uid),
      })),

    reorder: (from: string, to: string) =>
      edit((p) => ({
        ...p,
        pages: p.pages.map((pg) => {
          const a = pg.blocks.findIndex((b) => b.uid === from);
          const b = pg.blocks.findIndex((x) => x.uid === to);
          if (a < 0 || b < 0) return pg;
          const blocks = [...pg.blocks];
          const [moved] = blocks.splice(a, 1);
          blocks.splice(b, 0, moved!);
          return { ...pg, blocks };
        }),
      })),

    patchBlock,
    setSpan: (uid: string, span: number) => patchBlock(uid, (b) => ({ ...b, span })),
    renameBlock: (uid: string, name: string) => patchBlock(uid, (b) => ({ ...b, name })),

    /** Face-local state — a patch point, a step level, an XY position. */
    setFace: (uid: string, face: number[]) => patchBlock(uid, (b) => ({ ...b, face })),

    /** Every param at once, for presets and randomise. */
    setParams: (uid: string, values: number[]) =>
      patchBlock(uid, (b) => ({ ...b, params: b.params.map((p, i) => ({ ...p, value: values[i] ?? p.value })) })),

    setParam: (uid: string, id: string, value: number) =>
      patchBlock(uid, (b) => ({
        ...b,
        params: b.params.map((p) => (p.id === id ? { ...p, value } : p)),
      })),

    renameParam: (uid: string, id: string, label: string) =>
      patchBlock(uid, (b) => ({
        ...b,
        params: b.params.map((p) => (p.id === id ? { ...p, label } : p)),
      })),

    moveParam: (uid: string, id: string, dir: -1 | 1) =>
      patchBlock(uid, (b) => {
        const i = b.params.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= b.params.length) return b;
        const params = [...b.params];
        [params[i], params[j]] = [params[j]!, params[i]!];
        return { ...b, params };
      }),

    toggleWire: (from: string, to: string) =>
      edit((p) => {
        const has = p.wires.some((w) => w.from === from && w.to === to);
        return {
          ...p,
          wires: has
            ? p.wires.filter((w) => !(w.from === from && w.to === to))
            : [...p.wires, { from, to }],
        };
      }),
  };
}

export type Store = ReturnType<typeof useProject>;
