import { cp, mkdir, rm, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Copy the web build into akaVST's public directory.
 *
 * Socket is an Electron app and the website is a Next.js site in a different
 * repository, so there is no build step that could reach across — Vercel builds
 * the site from its own checkout and has never heard of this one. The built
 * assets are therefore committed there, the same way the generated block
 * catalogue and the compiled engine are committed here.
 *
 * That is a real cost and worth naming: `/socket-test` is only as fresh as the
 * last time someone ran this. It says so on the page.
 */

const HERE = path.resolve(import.meta.dirname, "..");
const SITE = path.resolve(HERE, "../akaVST/web/public/socket-test");
const BUILD = path.join(HERE, "dist-web");

if (!existsSync(BUILD)) {
  console.error(`✗ no build at ${BUILD} — run pnpm build:web first`);
  process.exit(1);
}
if (!existsSync(path.dirname(SITE))) {
  console.error(`✗ akaVST's web/public is not at ${path.dirname(SITE)}`);
  console.error("  The two repos are expected to be siblings on disk.");
  process.exit(1);
}

// Replaced wholesale rather than merged: Vite's asset filenames are content
// hashed, so a copy that only adds files accumulates every build ever made.
await rm(SITE, { recursive: true, force: true });
await mkdir(SITE, { recursive: true });
await cp(BUILD, SITE, { recursive: true });

// The engine is not part of the Vite build — it is a prebuilt worklet and a
// WebAssembly module in public/, which Vite copies verbatim. Both are needed
// or the page loads and makes no sound.
for (const f of ["worklet.js", "engine.js"]) {
  const at = path.join(SITE, "engine", f);
  if (!existsSync(at)) {
    console.error(`✗ ${f} missing from the build — the page would be silent`);
    process.exit(1);
  }
}

/** What was deployed and when, so the page can say how stale it is. */
await writeFile(
  path.join(SITE, "build.json"),
  JSON.stringify({ built: new Date().toISOString() }, null, 2) + "\n",
);

let bytes = 0, files = 0;
const walk = async (dir: string) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(at);
    else { bytes += (await stat(at)).size; files++; }
  }
};
await walk(SITE);

console.log(`✓ ${SITE}`);
console.log(`  ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log("  Commit and push akaVST to deploy it.");
