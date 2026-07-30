import { createContext, useContext, type ReactNode } from "react";
import type { Project } from "@/model/types";
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

/**
 * The project, for the faces that need it.
 *
 * Only one does — the patch bay, which has to resolve a cable to a real block
 * and a real parameter. Passing the whole project down through Frame, Panel and
 * the face registry to reach it would put the project in the signature of every
 * component that has no use for it.
 */
const ProjectCtx = createContext<Project | null>(null);

export function ProjectProvider({ value, children }: { value: Project; children: ReactNode }) {
  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProjectContext(): Project | null {
  return useContext(ProjectCtx);
}

export { modSources, modTargets, routesFrom } from "./modulation";
export type { ModSource, ModTarget } from "./modulation";
