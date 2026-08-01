/// <reference types="vite/client" />

// Only here for `import.meta.env.BASE_URL`, which the engine resolves the
// worklet and the WebAssembly module against. Vite substitutes it at build
// time, so the bundler never needed this — but `tsc --noEmit` runs on its own
// and does, and a typecheck that passes only because the bundler is generous
// is a typecheck that will fail in CI instead of here.
