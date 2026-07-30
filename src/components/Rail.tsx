import { Blocks, FolderOpen, Settings2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Pane = "blocks" | "presets" | "settings";

const PANES: Array<{ id: Pane; label: string; Icon: typeof Blocks }> = [
  { id: "blocks", label: "Blocks", Icon: Blocks },
  { id: "presets", label: "Presets", Icon: FolderOpen },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

/**
 * The activity rail.
 *
 * The pattern every desktop tool converges on — a narrow strip of destinations
 * on the far left, and one contextual panel beside it. It scales where a single
 * fixed sidebar does not: presets, project settings and whatever comes after
 * them each need the same column, and without a rail they would each need their
 * own.
 *
 * Icons only, with tooltips. At this width a label is a truncation.
 */
export function Rail({ pane, onPane }: { pane: Pane; onPane: (p: Pane) => void }) {
  return (
    <nav className="border-hairline flex w-11 flex-none flex-col items-center gap-1 border-r py-2">
      {PANES.map(({ id, label, Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              aria-current={pane === id}
              onClick={() => onPane(id)}
              className={pane === id ? "bg-card-alpha text-foreground" : "text-muted-foreground"}
            >
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Inspector">
            <SlidersHorizontal />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Inspector is on the right</TooltipContent>
      </Tooltip>
    </nav>
  );
}
