import { Blocks } from "./components/Blocks";

/**
 * Socket — a desktop studio for building plugins out of modular blocks.
 *
 * The shell only, for now. What it can honestly do today is compose and preview
 * in the house design language; what it cannot do is produce a plugin that makes
 * sound, because the DSP is still welded inside the three instruments rather
 * than extracted as blocks. That gap is named on screen rather than hidden,
 * because a builder that looks finished and produces nothing is worse than one
 * that says what it is.
 */
export function App() {
  return (
    <div className="app">
      <header className="chrome">
        <span className="wordmark">socket</span>
        <span className="label">plugin studio · akaieuan</span>
      </header>
      <main>
        <Blocks />
      </main>
    </div>
  );
}
