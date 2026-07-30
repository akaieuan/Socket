import { Check, ChevronDown, LayoutGrid, Moon, Save, Settings, Sun, Waypoints } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Store } from "@/model/useProject";

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
  store, view, onView, theme, onTheme,
}: {
  store: Store;
  view: View;
  onView: (v: View) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const { project } = store;
  const blocks = project.pages.reduce((n, p) => n + p.blocks.length, 0);

  return (
    <header className="drag-region border-hairline flex h-11 flex-none items-center gap-2 border-b pr-2 pl-[88px]">
      <span className="no-drag text-[15px] font-light tracking-tight">socket</span>

      <Separator orientation="vertical" className="no-drag mx-1 !h-4" />

      {/* The document, named the way a desktop app names one: the file, then
          what has happened to it. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="no-drag gap-1.5 font-normal">
            {project.name}
            <span className="text-muted-foreground font-mono text-[10px]">
              {project.pages.length}p · {blocks}b
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuItem>
            <Save /> Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Export JUCE project
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

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => v && onView(v as View)}
        className="no-drag"
      >
        <ToggleGroupItem value="layout" aria-label="Layout">
          <LayoutGrid className="size-3" /> Layout
        </ToggleGroupItem>
        <ToggleGroupItem value="signal" aria-label="Signal">
          <Waypoints className="size-3" /> Signal
        </ToggleGroupItem>
      </ToggleGroup>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="no-drag"
            onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Moon /> : <Sun />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === "dark" ? "Dark" : "Paper"}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="no-drag mx-1 !h-4" />

      {/* Dummy for now, but the shape is the real one: the account menu belongs
          top-right and its absence is the loudest thing missing from an app
          that is otherwise trying to look finished. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="no-drag rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-accent-blue/30">
            <Avatar>
              <AvatarFallback>ak</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-8">
              <AvatarFallback>ak</AvatarFallback>
            </Avatar>
            <div className="grid text-[13px] leading-tight">
              <span>akaieuan</span>
              <span className="text-muted-foreground font-mono text-[10px]">local workspace</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem><Settings /> Preferences</DropdownMenuItem>
          <DropdownMenuItem>
            <Check /> Nothing makes sound yet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
