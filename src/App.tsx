import { useEffect, useState } from "react";
import { useProject } from "./model/useProject";
import { Palette } from "./components/Palette";
import { Inspector } from "./components/Inspector";
import { LayoutView } from "./views/LayoutView";
import { SignalView } from "./views/SignalView";
import { Segmented } from "./design/controls";

type View = "layout" | "signal";

/**
 * Socket — a desktop studio for building plugins out of blocks.
 *
 * Two views, because a plugin is two things at once. Layout is where a panel
 * sits; Signal is where a block sits in the chain. Conflating them was the
 * deepest thing wrong with the first version — a filter drawn left of an
 * oscillator is a layout choice, not a routing one, and no amount of dragging
 * panels around can express the second.
 *
 * Still mock blocks: every one names DSP that exists inside bleep, enzyme or i4
 * and has not been extracted. Building the tool first is what tells us what a
 * block has to expose.
 */
export function App() {
  const store = useProject();
  const [view, setView] = useState<View>("layout");
  const [dragType, setDragType] = useState<string | null>(null);

  // The instruments ship both themes, so the builder has to show both. It is
  // one class on the root because the plugin face and the app draw from the
  // same tokens — which is the whole reason the design system is generated
  // rather than copied.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="app">
      <header className="chrome">
        <span className="wordmark">socket</span>
        <span className="label">plugin studio</span>
        <span className="chrome-spacer" />
        <Segmented
          options={[
            { value: "layout" as View, label: "Layout" },
            { value: "signal" as View, label: "Signal" },
          ]}
          value={view}
          onChange={setView}
        />
        <Segmented
          options={[
            { value: "dark" as const, label: "Dark" },
            { value: "light" as const, label: "Paper" },
          ]}
          value={theme}
          onChange={setTheme}
        />
        <span className="label">nothing makes sound yet</span>
      </header>

      <div className="workspace">
        <aside className="rail">
          <Palette onAdd={store.addBlock} onDragBlock={setDragType} />
        </aside>

        <main className="main">
          {view === "layout" ? (
            <LayoutView
              store={store}
              dragType={dragType}
              onDropBlock={() => { if (dragType) store.addBlock(dragType); setDragType(null); }}
            />
          ) : (
            <div className="scroll">
              <SignalView
                project={store.project}
                selected={store.selected}
                onSelect={store.setSelected}
                onWire={store.toggleWire}
              />
            </div>
          )}
        </main>

        <aside className="rail rail-right">
          <Inspector store={store} />
        </aside>
      </div>
    </div>
  );
}
