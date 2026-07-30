import { useEffect, useRef, useState } from "react";
import { audio } from "./engine";
import type { Project } from "@/model/types";

/**
 * Two rows of the computer keyboard as a piano.
 *
 * The Keyboard face is the obvious way in, but you cannot play a chord by
 * clicking and you cannot hear how a patch responds without playing it. Every
 * soft synth ships this mapping and everybody already knows it.
 */
const KEYS: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
  KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13,
  KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};

/**
 * Keeps the engine in step with the project, and provides note input.
 *
 * The whole project is pushed on any structural change — blocks added, removed
 * or reordered — and single parameters go across on their own. Sending
 * everything on every knob turn would flood the port at 60fps for no reason;
 * sending nothing on a rebuild would leave the engine playing the old patch.
 */
export function useAudio(project: Project) {
  const [running, setRunning] = useState(false);
  const [octave, setOctave] = useState(4);
  const [held, setHeld] = useState<number[]>([]);
  const octaveRef = useRef(octave);
  octaveRef.current = octave;

  /** Structure: the list of blocks and their order. */
  const shape = project.pages
    .flatMap((p) => p.blocks)
    .map((b) => `${b.uid}:${b.type}`)
    .join(",");

  useEffect(() => {
    if (running) audio.setProject(project);
    // Deliberately keyed on the shape rather than the project value: a knob
    // turn produces a new project object every frame, and rebuilding the
    // engine graph at 60fps would cut the sound up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, running]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // Never steal keys from a field someone is typing in.
      if (target && (target.tagName === "INPUT" || target.isContentEditable)) return;

      if (e.code === "KeyZ") { setOctave((o) => Math.max(0, o - 1)); return; }
      if (e.code === "KeyX") { setOctave((o) => Math.min(8, o + 1)); return; }
      if (e.code === "Escape") { audio.panic(); setHeld([]); return; }

      const semitone = KEYS[e.code];
      if (semitone === undefined) return;
      e.preventDefault();

      const note = 12 * octaveRef.current + 12 + semitone;
      setHeld((h) => (h.includes(note) ? h : [...h, note]));
      void start().then(() => audio.noteOn(note));
    };

    const up = (e: KeyboardEvent) => {
      const semitone = KEYS[e.code];
      if (semitone === undefined) return;
      const note = 12 * octaveRef.current + 12 + semitone;
      setHeld((h) => h.filter((n) => n !== note));
      audio.noteOff(note);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /** Browsers refuse to start audio without a gesture. */
  const start = async () => {
    if (audio.running) return;
    await audio.start(() => {
      setRunning(true);
      audio.setProject(project);
    });
  };

  return {
    running,
    octave,
    setOctave,
    held,
    start,
    noteOn: (note: number, velocity = 0.9) => { void start().then(() => audio.noteOn(note, velocity)); },
    noteOff: (note: number) => audio.noteOff(note),
    setParam: (uid: string, paramId: string, value: number) => audio.setParam(project, uid, paramId, value),
    panic: () => audio.panic(),
  };
}

export type AudioBinding = ReturnType<typeof useAudio>;
