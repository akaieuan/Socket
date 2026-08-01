import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The renderer's dev server.
 *
 * Port 4200, deliberately away from akaVST's site on 3000 so both can run at
 * once — the plugin studio and the storefront it shares a design language with
 * are routinely open together.
 *
 * Only used in development. A packaged Socket loads from file:// and has no
 * server and no port at all, which is the point of it being desktop-native:
 * direct filesystem access to project folders, and the ability to shell out to
 * CMake and actually build what it generates.
 */
export default defineConfig({
  /**
   * Where the built app expects to be served from.
   *
   * Default `/` covers the dev server and a packaged Electron build. The web
   * copy that sits under a path on akavst.com sets SOCKET_BASE, because every
   * asset URL and both engine files resolve against it — a bundle built for the
   * root and served from a subdirectory asks for /assets/… and gets the
   * website's 404 page, which fails as a blank screen rather than as an error.
   */
  base: process.env.SOCKET_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    // Radix ships a lot of packages that each depend on React. One resolved
    // copy or the hooks throw — and the failure mode is a wall of "invalid hook
    // call" that looks like a bug in your own components.
    dedupe: ["react", "react-dom"],
  },
  server: { port: 4200, strictPort: true },
  build: { outDir: "dist" },
});
