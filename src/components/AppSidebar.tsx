import { useMemo, useState } from "react";

import { CATALOG } from "@/model/catalog";
import { PRESETS } from "@/model/presets";
import { hasEngine } from "@/audio";
import { GROUPS, type Group } from "@/model/types";
import type { Store } from "@/model/useProject";
import { GroupIcon, Icon, type IconName } from "@/design/PixelIcon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Pane = "blocks" | "presets" | "settings";

const PANES: Array<{ id: Pane; label: string; icon: IconName }> = [
  { id: "blocks", label: "Blocks", icon: "blocks" },
  { id: "presets", label: "Presets", icon: "folder" },
  { id: "settings", label: "Settings", icon: "sliders" },
];

/**
 * The sidebar.
 *
 * One column, in the shape every desktop app has converged on: a workspace
 * switcher at the top, destinations under it, the contextual content below
 * those, and the account at the bottom. The previous arrangement — a three-icon
 * rail floating beside a separate panel — is the shape you reach for when there
 * are twelve destinations, and there are three.
 *
 * Density is the other half of it. Block rows were tall enough that seven
 * sources filled the column; here a row is a row, groups collapse with a
 * chevron and carry their count, and the whole catalogue fits without scrolling
 * past anything.
 *
 * The group glyphs stay pixel-drawn. They are the one piece of iconography the
 * instruments have, and a borrowed set would be the only thing in the app not
 * speaking the same language as the screens.
 */
export function AppSidebar({
  store, pane, onPane, onAdd, onDragBlock,
}: {
  store: Store;
  pane: Pane;
  onPane: (p: Pane) => void;
  onAdd: (type: string) => void;
  onDragBlock: (type: string | null) => void;
}) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Group[]>(["Source"]);

  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!needle) return CATALOG;
    return CATALOG.filter((d) =>
      `${d.name} ${d.group} ${d.from} ${d.face ?? ""}`.toLowerCase().includes(needle),
    );
  }, [needle]);

  return (
    <Sidebar collapsible="icon" className="border-hairline">
      <SidebarHeader className="gap-1.5">
        {/* The collapse control belongs to the sidebar, not to the toolbar. A
            button somewhere else that happens to affect this panel is a button
            you have to be told about. */}
        <div className="flex items-center gap-1">
          {!collapsed && <ProjectSwitcher store={store} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={collapsed ? "mx-auto" : "text-muted-foreground hover:text-foreground"}
              >
                <Icon name={collapsed ? "expand" : "collapse"} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand" : "Collapse"} · ⌘B
            </TooltipContent>
          </Tooltip>
        </div>

        <SidebarMenu>
          {PANES.map(({ id, label, icon }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton isActive={pane === id} onClick={() => onPane(id)} tooltip={label}>
                <Icon name={icon} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {pane === "blocks" && (
          <>
            <SidebarGroup className="pb-0 group-data-[collapsible=icon]:hidden">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter blocks…"
                spellCheck={false}
              />
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {GROUPS.map((group) => {
                    const items = hits.filter((d) => d.group === group);
                    if (items.length === 0) return null;
                    // Searching opens every group with a hit: a match hidden
                    // behind a closed section makes the filter worse than none.
                    const expanded = needle ? true : open.includes(group);

                    return (
                      <Collapsible
                        key={group}
                        asChild
                        open={expanded}
                        onOpenChange={() =>
                          setOpen((o) => (o.includes(group) ? o.filter((x) => x !== group) : [...o, group]))
                        }
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={group} className="font-mono text-[10px] tracking-[0.16em] uppercase">
                              <GroupIcon group={group} />
                              <span>{group}</span>
                              {/* Count and chevron sit inline. As an absolutely
                                  positioned badge the count landed on top of
                                  the chevron. */}
                              <span className="text-muted-foreground ml-auto tabular-nums">{items.length}</span>
                              <Icon name="chevronDown" className="opacity-60 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {items.map((def) => (
                                <SidebarMenuSubItem key={def.type}>
                                  <SidebarMenuSubButton asChild>
                                    <button
                                      draggable
                                      onDragStart={() => onDragBlock(def.type)}
                                      onDragEnd={() => onDragBlock(null)}
                                      onClick={() => onAdd(def.type)}
                                      title={
                                        hasEngine(def.type)
                                          ? `${def.name} — makes a sound · ${def.from}`
                                          : `${def.name} — no engine yet · ${def.from}`
                                      }
                                      className="flex w-full cursor-grab items-center gap-2 text-left"
                                    >
                                      <span className="truncate">{def.name}</span>
                                      {/* A dot on the ones that sound, rather
                                          than dimming the ones that do not.
                                          Eight of forty-nine have engines, and
                                          dimming forty-one reads as a broken
                                          palette instead of an honest one. */}
                                      {hasEngine(def.type) && (
                                        <span className="bg-accent-green ml-auto size-1 shrink-0 rounded-full" />
                                      )}
                                    </button>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>

                {hits.length === 0 && (
                  <p className="text-muted-foreground px-2 py-3 text-[11px]">Nothing matches “{q}”.</p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {pane === "presets" && (
          <SidebarGroup>
            <p className="text-muted-foreground mb-2 text-[11px] leading-[1.5]">
              Whole instruments — layout, wiring and patterns, not just knob values. Loading one
              replaces what you have; ⌘Z brings it back.
            </p>
            <div className="flex flex-col gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => store.load(preset.make())}
                  title={preset.note}
                  className="border-card-border bg-card-alpha hover:border-card-border-hover hover:bg-card rounded-md border px-2 py-1.5 text-left transition-colors"
                >
                  <span className="block text-[13px] leading-tight">{preset.name}</span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px] leading-[1.4]">
                    {preset.note}
                  </span>
                </button>
              ))}
            </div>
          </SidebarGroup>
        )}
        {pane === "settings" && (
          <Placeholder title="Settings" note="Build targets, output folder, JUCE path." />
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-card-alpha">
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md">ak</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-[13px]">akaieuan</span>
                    <span className="text-muted-foreground truncate font-mono text-[9px]">local workspace</span>
                  </div>
                  <Icon name="chevronUpDown" className="ml-auto opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem><Icon name="spark" /> Nothing makes sound yet</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Icon name="sliders" /> Preferences</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/**
 * The project, and what you can do to it.
 *
 * Hidden entirely when the sidebar is collapsed rather than reduced to its
 * glyph: at 44px the name and size are what it is for, and a lone square that
 * opens a menu is a mystery button.
 */
function ProjectSwitcher({ store }: { store: Store }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-card-alpha">
          <div className="bg-card-alpha border-card-border flex aspect-square size-7 items-center justify-center rounded-md border">
            <GroupIcon group="Display" className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-[13px]">{store.project.name}</span>
            <span className="text-muted-foreground truncate font-mono text-[9px]">
              {store.project.size.w}×{store.project.size.h} · {store.project.pages.length} pages
            </span>
          </div>
          <Icon name="chevronUpDown" className="ml-auto opacity-50" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-52">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <DropdownMenuItem>{store.project.name}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Icon name="plus" /> New plugin
          <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Destinations that exist as shape before they exist as feature. */
function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <SidebarGroup>
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">{title}</p>
      <p className="text-muted-foreground mt-2 text-[11px] leading-[1.5]">{note}</p>
    </SidebarGroup>
  );
}
