import { Icon } from "@/design/PixelIcon";
import { hasEngine } from "@/audio";
import { byType } from "@/model/catalog";
import { findBlock } from "@/model/project";
import { ACCENTS, SIZES, type Accent } from "@/model/types";
import type { Store } from "@/model/useProject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The right rail: project when nothing is selected, block when something is.
 *
 * Rebuilt on shadcn primitives for one reason — density. The hand-rolled
 * version gave every field its own generous stack, so four parameters filled
 * the column and the eye had nothing to group by. Here a section is a label and
 * its rows, a row is 28px, and the space between groups is the only space there
 * is. A properly spaced inspector is not one with more air; it is one with air
 * in fewer places.
 */
export function Inspector({ store }: { store: Store }) {
  const { project, selected } = store;
  const block = selected ? findBlock(project, selected) : null;
  return block ? <BlockInspector store={store} uid={block.uid} /> : <ProjectInspector store={store} />;
}

/** A titled group. The rhythm of the whole panel lives here. */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-3 py-2.5">
      <div className="mb-1.5 flex h-5 items-center justify-between">
        <Label>{title}</Label>
        {action}
      </div>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-1.5 text-[11px] leading-[1.5]">{children}</p>;
}

function ProjectInspector({ store }: { store: Store }) {
  const { project } = store;

  return (
    <>
      <Section title="Plugin">
        <Input value={project.name} onChange={(e) => store.setName(e.target.value)} spellCheck={false} />
      </Section>

      <Separator />

      <Section title="Window">
        <div className="grid grid-cols-2 gap-1">
          {SIZES.map((s) => (
            <button
              key={s.name}
              onClick={() => store.setSize(s)}
              className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                project.size.name === s.name
                  ? "border-accent-blue bg-card"
                  : "border-card-border bg-card-alpha hover:border-card-border-hover"
              }`}
            >
              <span className="block text-[12px] leading-tight">{s.name}</span>
              <span className="text-muted-foreground block font-mono text-[9px]">
                {s.w}×{s.h}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Separator />

      <Section title="Accent">
        <div className="flex gap-1.5">
          {ACCENTS.map((a) => (
            <Tooltip key={a}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => store.setAccent(a as Accent)}
                  aria-label={a}
                  style={{ background: `var(--accent-${a})` }}
                  className={`size-5 rounded-full border-2 transition-transform ${
                    project.accent === a ? "border-foreground scale-110" : "border-transparent hover:scale-110"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent>{a}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Note>One accent per instrument — the house rule.</Note>
      </Section>

      <Separator />

      <Section
        title="Pages"
        action={
          <Button variant="ghost" size="icon-sm" onClick={store.addPage} aria-label="Add page">
            <Icon name="plus" />
          </Button>
        }
      >
        <div className="space-y-1">
          {project.pages.map((pg, i) => (
            <div key={pg.id} className="flex items-center gap-1.5">
              <button
                onClick={() => store.setActivePage(i)}
                aria-label={`Show ${pg.name}`}
                title={`${pg.blocks.length} blocks`}
                className={`size-2 shrink-0 rounded-full border transition-colors ${
                  i === store.activePage ? "border-accent-blue bg-accent-blue" : "border-card-border-hover"
                }`}
              />
              <Input
                value={pg.name}
                onChange={(e) => store.renamePage(i, e.target.value)}
                onFocus={() => store.setActivePage(i)}
              />
              <span className="text-muted-foreground w-4 shrink-0 text-right font-mono text-[10px]">
                {pg.blocks.length}
              </span>
              {project.pages.length > 1 && (
                <Button variant="ghost" size="icon-sm" onClick={() => store.removePage(i)} aria-label={`Remove ${pg.name}`}>
                  <Icon name="close" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Note>
          Yours to decide. One page holding synth, mod and FX is a whole instrument; so is five. A block moves
          between them from its own panel.
        </Note>
      </Section>
    </>
  );
}

function BlockInspector({ store, uid }: { store: Store; uid: string }) {
  const block = findBlock(store.project, uid);
  if (!block) return null;
  const def = byType(block.type);
  const page = store.project.pages.findIndex((pg) => pg.blocks.some((b) => b.uid === uid));

  const ports = [
    def?.ports.audioIn ? "takes audio" : null,
    def?.ports.audioOut ? "makes audio" : null,
    def?.ports.modOut ? "makes modulation" : null,
  ].filter(Boolean);

  return (
    <>
      <Section
        title="Block"
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            className="hover:text-accent-rose"
            onClick={() => { store.removeBlock(uid); store.setSelected(null); }}
            aria-label="Remove block"
          >
            <Icon name="trash" />
          </Button>
        }
      >
        <Input value={block.name} onChange={(e) => store.renameBlock(uid, e.target.value)} spellCheck={false} />
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={`size-1 shrink-0 rounded-full ${hasEngine(block.type) ? "bg-accent-green" : "bg-muted-foreground/50"}`}
          />
          <p className="text-muted-foreground font-mono text-[10px]">
            {hasEngine(block.type) ? "makes a sound" : "no engine yet"} · {def?.from}
          </p>
        </div>
      </Section>

      <Separator />

      <Section title="Size">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2">
          <span className="text-muted-foreground font-mono text-[10px]">W</span>
          <Slider value={[block.span]} min={2} max={12} step={1} onValueChange={([v]) => store.setSpan(uid, v!)} />
          <span className="w-9 text-right font-mono text-[10px]">{block.span}/12</span>

          <span className="text-muted-foreground font-mono text-[10px]">H</span>
          <Slider value={[block.rows]} min={3} max={48} step={1} onValueChange={([v]) => store.setRows(uid, v!)} />
          <span className="w-9 text-right font-mono text-[10px]">{block.rows}r</span>
        </div>
        <Note>Or drag the panel's right edge, bottom edge or corner.</Note>
      </Section>

      <Separator />

      <Section title="Page">
        <ToggleGroup
          type="single"
          size="sm"
          value={String(page)}
          onValueChange={(v) => v && store.moveToPage(uid, Number(v))}
          className="w-full"
        >
          {store.project.pages.map((pg, i) => (
            <ToggleGroupItem key={pg.id} value={String(i)}>{pg.name}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>

      <Separator />

      <Section title="Ports">
        <p className="text-[11px] leading-[1.5]">
          {ports.length ? ports.join(", ") : "Display only — not in the signal path."}
        </p>
      </Section>

      {block.params.length > 0 && (
        <>
          <Separator />
          <Section title={`Parameters · ${block.params.length}`}>
            <div className="space-y-2.5">
              {block.params.map((p, i) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-1.5 gap-y-1.5">
                  <Input value={p.label} onChange={(e) => store.renameParam(uid, p.id, e.target.value)} spellCheck={false} />
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => store.moveParam(uid, p.id, -1)} aria-label="Move up">
                      <Icon name="up" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={i === block.params.length - 1} onClick={() => store.moveParam(uid, p.id, 1)} aria-label="Move down">
                      <Icon name="down" />
                    </Button>
                  </div>

                  <div className="col-span-2">
                    {(p.kind === "knob" || p.kind === "fader") && (
                      <Slider value={[p.value]} min={0} max={1} step={0.01} onValueChange={([v]) => store.setParam(uid, p.id, v!)} />
                    )}
                    {p.kind === "choice" && (
                      <ToggleGroup
                        type="single"
                        size="sm"
                        value={String(p.value)}
                        onValueChange={(v) => v && store.setParam(uid, p.id, Number(v))}
                        className="w-full"
                      >
                        {(p.options ?? []).map((o, k) => (
                          <ToggleGroupItem key={o} value={String(k)}>{o}</ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                    {p.kind === "toggle" && (
                      <ToggleGroup
                        type="single"
                        size="sm"
                        value={p.value > 0.5 ? "1" : "0"}
                        onValueChange={(v) => v && store.setParam(uid, p.id, Number(v))}
                        className="w-full"
                      >
                        <ToggleGroupItem value="0">Off</ToggleGroupItem>
                        <ToggleGroupItem value="1">On</ToggleGroupItem>
                      </ToggleGroup>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Note>What a control is called and where it sits is most of the design work in a panel.</Note>
          </Section>
        </>
      )}
    </>
  );
}
