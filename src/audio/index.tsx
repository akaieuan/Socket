import { createContext, useContext, type ReactNode } from "react";
import type { AudioBinding } from "./useAudio";

export { useAudio } from "./useAudio";
export { audio, hasEngine, BLOCK_TYPE } from "./engine";
export type { AudioBinding } from "./useAudio";

/**
 * The engine, reachable from anywhere that draws.
 *
 * A keyboard face six levels down needs to play a note, and threading a note
 * callback through Frame, Panel and the face registry would put audio in the
 * signature of every component that never makes a sound.
 */
const Ctx = createContext<AudioBinding | null>(null);

export function AudioProvider({ value, children }: { value: AudioBinding; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudioContext(): AudioBinding {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAudioContext outside AudioProvider");
  return v;
}
