import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react()],
  server: { port: 4200, strictPort: true },
  build: { outDir: "dist" },
});
