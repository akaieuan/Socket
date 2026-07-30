import { byType } from "../model/catalog";
import { findBlock } from "../model/project";
import { ACCENTS, SIZES, type Accent } from "../model/types";
import type { Store } from "../model/useProject";
import { Field, Hint, IconButton, ListButton, Section, Segmented, Slider, Stack, TextInput } from "../design/controls";

/**
 * The right rail: project when nothing is selected, block when something is.
 *
 * Both branches compose from the same control vocabulary, so a field in one
 * looks like a field in the other without either knowing about the other.
 */
export function Inspector({ store }: { store: Store }) {
  const { project, selected } = store;
  const block = selected ? findBlock(project, selected) : null;

  if (!block) return <ProjectInspector store={store} />;
  return <BlockInspector store={store} uid={block.uid} />;
}

function ProjectInspector({ store }: { store: Store }) {
  const { project } = store;
  return (
    <>
      <Section title="Plugin">
        <Stack>
          <Field label="Name">
            <TextInput value={project.name} onChange={store.setName} />
          </Field>
        </Stack>
      </Section>

      <Section title="Window">
        <div className="list">
          {SIZES.map((s) => (
            <ListButton
              key={s.name}
              title={s.name}
              subtitle={`${s.w}×${s.h}${s.from ? ` · ${s.from}` : ""}`}
              active={project.size.name === s.name}
              onClick={() => store.setSize(s)}
            />
          ))}
        </div>
      </Section>

      <Section title="Accent">
        <div className="accent-row">
          {ACCENTS.map((a) => (
            <button
              key={a}
              className={`accent-dot${project.accent === a ? " on" : ""}`}
              style={{ background: `var(--accent-${a})` }}
              onClick={() => store.setAccent(a as Accent)}
              aria-label={a}
            />
          ))}
        </div>
        <Hint>One accent per instrument — the house rule.</Hint>
      </Section>

      <Section title="Pages">
        <div className="list">
          {project.pages.map((pg, i) => (
            <ListButton
              key={pg.id}
              title={pg.name}
              subtitle={`${pg.blocks.length} blocks`}
              active={i === store.activePage}
              onClick={() => store.setActivePage(i)}
              onRemove={project.pages.length > 1 ? () => store.removePage(i) : undefined}
            />
          ))}
        </div>
        <button className="add-btn" onClick={store.addPage}>+ Add page</button>
      </Section>
    </>
  );
}

function BlockInspector({ store, uid }: { store: Store; uid: string }) {
  const block = findBlock(store.project, uid);
  if (!block) return null;
  const def = byType(block.type);

  return (
    <>
      <Section title="Block">
        <Stack>
          <Field label="Name">
            <TextInput value={block.name} onChange={(v) => store.renameBlock(uid, v)} />
          </Field>
          <Hint>{def?.from}</Hint>
        </Stack>
      </Section>

      <Section title={`Width · ${block.span}/12`}>
        <Slider value={block.span} min={2} max={12} step={1} onChange={(v) => store.setSpan(uid, v)} />
      </Section>

      <Section title="Ports">
        <Hint>
          {def?.ports.audioIn ? "Takes audio. " : ""}
          {def?.ports.audioOut ? "Produces audio. " : ""}
          {def?.ports.modOut ? "Produces modulation. " : ""}
          {!def?.ports.audioIn && !def?.ports.audioOut && !def?.ports.modOut ? "Display only — not in the signal path." : ""}
        </Hint>
      </Section>

      {block.params.length > 0 && (
        <Section title="Parameters">
          <Hint>What a control is called and where it sits is most of the design work in a panel.</Hint>
          {block.params.map((p, i) => (
            <div className="param-edit" key={p.id}>
              <TextInput value={p.label} onChange={(v) => store.renameParam(uid, p.id, v)} />
              <div className="param-tools">
                <IconButton label="↑" onClick={() => store.moveParam(uid, p.id, -1)} disabled={i === 0} />
                <IconButton label="↓" onClick={() => store.moveParam(uid, p.id, 1)} disabled={i === block.params.length - 1} />
              </div>
              {(p.kind === "knob" || p.kind === "fader") && (
                <Slider value={p.value} onChange={(v) => store.setParam(uid, p.id, v)} />
              )}
              {p.kind === "choice" && (
                <Segmented
                  options={(p.options ?? []).map((o, k) => ({ value: k, label: o }))}
                  value={p.value}
                  onChange={(v) => store.setParam(uid, p.id, v)}
                />
              )}
              {p.kind === "toggle" && (
                <Segmented
                  options={[{ value: 0, label: "Off" }, { value: 1, label: "On" }]}
                  value={p.value > 0.5 ? 1 : 0}
                  onChange={(v) => store.setParam(uid, p.id, v)}
                />
              )}
            </div>
          ))}
        </Section>
      )}

      <button className="add-btn danger" onClick={() => { store.removeBlock(uid); store.setSelected(null); }}>
        Remove block
      </button>
    </>
  );
}
