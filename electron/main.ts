import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Socket's main process.
 *
 * In development the renderer is Vite on 4200. In a packaged build there is no
 * server and no port — the window loads from disk. That difference is the reason
 * this is desktop-native rather than a web app: a packaged Socket can read and
 * write project folders directly and shell out to CMake to build what it
 * generates, neither of which a browser can do.
 */
const DEV_SERVER = "http://localhost:4200";

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    // Chromeless-ish, matching the instruments: the window is the instrument,
    // not a document in a frame.
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a09",
    webPreferences: {
      preload: path.join(dirname, "preload.js"),
      // Nothing in the renderer needs node, and giving it node is how a UI
      // process ends up with filesystem access it never asked for. Anything
      // privileged goes over the preload bridge, explicitly.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    win.loadURL(DEV_SERVER);
  } else {
    win.loadFile(path.join(dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
