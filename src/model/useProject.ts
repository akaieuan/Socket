import { useCallback, useEffect, useRef, useState } from "react";
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

/** Deep enough for a session, shallow enough not to hold a hundred projects. */
const HISTORY = 80;

/**
 * How long a run of small changes counts as one thing to undo.
 *
 * A knob drag produces a new project sixty times a second. Pushing each one
 * makes undo useless — a hundred presses to get back past a single gesture —
 * and pushing none loses the value you started from. Coalescing by time is the
 * usual answer and it is right here: let go of the knob for half a second and
 * the next move is a new entry.
 */
const COALESCE_MS = 500;

export function useProject() {
  const [project, setProject] = useState<Project>(initialProject);
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastPush = useRef(0);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const sync = () => setDepth({ undo: past.current.length, redo: future.current.length });

  /**
   * Every change goes through here, so history is not something to remember.
   *
   * `coalesce` marks a change that is part of a gesture — dragging a knob, an
   * edge, a step. Those merge into whatever entry is already open; everything
   * else is its own.
   */
  const edit = useCallback((fn: (p: Project) => Project, coalesce = false) => {
    setProject((p) => {
      const now = Date.now();
      const merge = coalesce && now - lastPush.current < COALESCE_MS;
      if (!merge) {
        past.current.push(p);
        if (past.current.length > HISTORY) past.current.shift();
        future.current.length = 0;
      }
      lastPush.current = now;
      return fn(p);
    });
    sync();
  }, []);

  const undo = useCallback(() => {
    setProject((p) => {
      const prev = past.current.pop();
      if (!prev) return p;
      future.current.push(p);
      lastPush.current = 0;   // never merge across an undo
      return prev;
    });
    sync();
  }, []);

  const redo = useCallback(() => {
    setProject((p) => {
      const next = future.current.pop();
      if (!next) return p;
      past.current.push(p);
      lastPush.current = 0;
      return next;
    });
    sync();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      // A text field has its own undo, and taking it would be worse than
      // having none — you would lose a rename you were halfway through.
      if (target && (target.tagName === "INPUT" || target.isContentEditable)) return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [undo, redo]);

  const patchBlock = useCallback(
    (uid: string, fn: (b: BlockInstance) => BlockInstance, coalesce = false) =>
      edit((p) => ({
        ...p,
        pages: p.pages.map((pg) => ({
          ...pg,
          blocks: pg.blocks.map((b) => (b.uid === uid ? fn(b) : b)),
        })),
      }), coalesce),
    [edit],
  );

  return {
    project,
    activePage,
    setActivePage,
    selected,
    setSelected,

    undo,
    redo,
    canUndo: depth.undo > 0,
    canRedo: depth.redo > 0,

    /** A whole project, from a preset or a file. Undoable like anything else. */
    load: (next: Project) => { edit(() => next); setActivePage(0); setSelected(null); },

    setName: (name: string) => edit((p) => ({ ...p, name }), true),
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

    /**
     * Move a block to another page.
     *
     * Pages are the user's variable, not the tool's: one page holding synth,
     * mod and FX is a legitimate instrument, and so is five. Without this,
     * where a block first landed was where it lived forever, which quietly made
     * the page count a decision you had to get right up front.
     */
    moveToPage: (uid: string, to: number) =>
      edit((p) => {
        const block = p.pages.flatMap((pg) => pg.blocks).find((b) => b.uid === uid);
        if (!block || !p.pages[to]) return p;
        return {
          ...p,
          pages: p.pages.map((pg, k) => ({
            ...pg,
            blocks: k === to
              ? [...pg.blocks.filter((b) => b.uid !== uid), block]
              : pg.blocks.filter((b) => b.uid !== uid),
          })),
        };
      }),

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
    setSpan: (uid: string, span: number) => patchBlock(uid, (b) => ({ ...b, span }), true),
    setRows: (uid: string, rows: number) => patchBlock(uid, (b) => ({ ...b, rows }), true),
    setBox: (uid: string, span: number, rows: number) => patchBlock(uid, (b) => ({ ...b, span, rows }), true),
    renameBlock: (uid: string, name: string) => patchBlock(uid, (b) => ({ ...b, name }), true),

    /** Face-local state — a patch point, a step level, an XY position. */
    setFace: (uid: string, face: number[]) => patchBlock(uid, (b) => ({ ...b, face }), true),

    /** Every param at once, for presets and randomise. */
    setParams: (uid: string, values: number[]) =>
      patchBlock(uid, (b) => ({ ...b, params: b.params.map((p, i) => ({ ...p, value: values[i] ?? p.value })) })),

    setParam: (uid: string, id: string, value: number) =>
      patchBlock(uid, (b) => ({
        ...b,
        params: b.params.map((p) => (p.id === id ? { ...p, value } : p)),
      }), true),

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
