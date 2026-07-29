import { contextBridge } from "electron";

/**
 * The bridge between the renderer and anything privileged.
 *
 * Empty on purpose. Socket will need to read and write project folders and
 * invoke a build, and every one of those capabilities gets added here
 * deliberately and named — rather than handing the UI a filesystem and trusting
 * it. The renderer runs with contextIsolation on and no node integration, so
 * this is the only way through.
 */
contextBridge.exposeInMainWorld("socket", {
  version: "0.1.0",
});
