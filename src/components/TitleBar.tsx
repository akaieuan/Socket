import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Store } from "@/model/useProject";
import type { AudioBinding } from "@/audio";
import { Icon } from "@/design/PixelIcon";

export type View = "layout" | "signal";
export type Theme = "dark" | "light";

/**
 * The window's title bar.
 *
 * Electron draws no chrome here — `titleBarStyle: "hiddenInset"` leaves the
 * traffic lights floating over the app, so this row has to be both the title
 * bar and a real toolbar. `-webkit-app-region: drag` makes the empty parts of
 * it move the window and every control opts back out, which is the standard
 * arrangement and the reason a native app feels native: you can grab the top of
 * the window anywhere that is not a button.
 *
 * The 88px of left padding is the traffic lights' room. Nothing else may live
 * there.
 */
export function TitleBar({
  store, view, onView, theme, onTheme, sound,
}: {
  store: Store;
  view: View;
  onView: (v: View) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  sound: AudioBinding;
}) {
  const { project } = store;
  const blocks = project.pages.reduce((n, p) => n + p.blocks.length, 0);

  return (
    <header className="drag-region border-hairline flex h-9 flex-none items-center gap-1 border-b px-1.5">
      {/* The document, named the way a desktop app names one: the file, then
          what has happened to it. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="no-drag h-6 gap-1.5 px-1.5 text-[12px] font-normal">
            {project.name}
            <span className="text-muted-foreground font-mono text-[10px]">
              {project.pages.length}p · {blocks}b
            </span>
            <Icon name="chevronDown" className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuItem>
            <Icon name="save" /> Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <><Icon name="export" /> Export JUCE project</>
            <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Window</DropdownMenuLabel>
          {[1180, 1080, 1380, 900].length > 0 && (
            <DropdownMenuItem disabled className="text-[11px]">
              {project.size.w} × {project.size.h} · {project.size.name}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Only the state, not the controls. The transport lives in the panel
          that is always on screen; two of them is one too many, and the one in
          the chrome is the one you cannot reach from where you are working. */}
      {sound.running && (
        <span className="text-muted-foreground no-drag flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase">
          <span className="bg-accent-green size-1.5 rounded-full" />
          Live
        </span>
      )}

      <Separator orientation="vertical" className="no-drag mx-0.5 !h-4" />

      <ToggleGroup
        type="single"
        size="sm"
        value={view}
        onValueChange={(v) => v && onView(v as View)}
        className="no-drag"
      >
        <ToggleGroupItem value="layout" aria-label="Layout">
          <Icon name="layout" />Layout
        </ToggleGroupItem>
        <ToggleGroupItem value="signal" aria-label="Signal">
          <Icon name="signal" />Signal
        </ToggleGroupItem>
      </ToggleGroup>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="no-drag"
            onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === "dark" ? "Dark" : "Paper"}</TooltipContent>
      </Tooltip>

    </header>
  );
}
