import { useEffect, useState } from "react";
import { useProject } from "@/model/useProject";
import { Palette } from "@/components/Palette";
import { Inspector } from "@/components/Inspector";
import { Rail, type Pane } from "@/components/Rail";
import { TitleBar, type Theme, type View } from "@/components/TitleBar";
import { LayoutView } from "@/views/LayoutView";
import { SignalView } from "@/views/SignalView";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Socket — a desktop studio for building plugins out of blocks.
 *
 * Two views, because a plugin is two things at once. Layout is where a panel
 * sits; Signal is where a block sits in the chain. Conflating them was the
 * deepest thing wrong with the first version — a filter drawn left of an
 * oscillator is a layout choice, not a routing one, and no amount of dragging
 * panels around can express the second.
 *
 * The shell is shadcn on top of the generated akaVST tokens: title bar, rail,
 * inspector, menus. The plugin face below it is not, and must not become so —
 * those controls are ports of skeleton's LookAndFeel, and the premise of the
 * whole tool is that what you compose is what the plugin looks like. A preview
 * drawn in a slightly different dialect breaks that quietly.
 *
 * Still mock blocks: every one names DSP that exists inside bleep, enzyme or i4
 * and has not been extracted. Building the tool first is what tells us what a
 * block has to expose.
 */
export function App() {
  const store = useProject();
  const [view, setView] = useState<View>("layout");
  const [pane, setPane] = useState<Pane>("blocks");
  const [dragType, setDragType] = useState<string | null>(null);

  // The instruments ship both themes, so the builder has to show both. One
  // class on the root, because the plugin face and the app draw from the same
  // tokens — which is the whole reason the design system is generated rather
  // than copied.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col">
        <TitleBar store={store} view={view} onView={setView} theme={theme} onTheme={setTheme} />

        <div className="flex min-h-0 flex-1">
          <Rail pane={pane} onPane={setPane} />

          <ScrollArea className="border-hairline w-52 flex-none border-r">
            <div className="p-2">
              {pane === "blocks" && <Palette onAdd={store.addBlock} onDragBlock={setDragType} />}
              {pane === "presets" && <Placeholder title="Presets" note="Saved instruments will live here." />}
              {pane === "settings" && <Placeholder title="Settings" note="Build targets, output folder, JUCE path." />}
            </div>
          </ScrollArea>

          <main className="flex min-w-0 flex-1 flex-col">
            {view === "layout" ? (
              <LayoutView
                store={store}
                dragType={dragType}
                onDropBlock={() => { if (dragType) store.addBlock(dragType); setDragType(null); }}
              />
            ) : (
              <ScrollArea className="flex-1">
                <div className="scroll p-6">
                  <SignalView
                    project={store.project}
                    selected={store.selected}
                    onSelect={store.setSelected}
                    onWire={store.toggleWire}
                  />
                </div>
              </ScrollArea>
            )}
          </main>

          <ScrollArea className="border-hairline w-64 flex-none border-l">
            <Inspector store={store} />
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Rail destinations that exist as shape before they exist as feature. */
function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="px-1 py-2">
      <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">{note}</p>
    </div>
  );
}
