import { Fragment } from "react";
import { byType } from "@/model/catalog";
import { audioBlocks, modBlocks } from "@/model/project";
import type { Project } from "@/model/types";
import { Label } from "@/components/ui/label";

/**
 * Signal flow — the dimension the layout could never express.
 *
 * On the face, block order is visual: where a panel sits says nothing about
 * where it is in the chain. In a real instrument those are independent, and
 * conflating them was the deepest thing wrong with the first version — a filter
 * drawn to the left of an oscillator is a layout choice, not a routing one.
 *
 * Click a source then a destination to wire or unwire them. Deliberately a
 * matrix rather than a node canvas: a plugin chain is nearly always short and
 * mostly linear, and a matrix shows every possible connection at once, including
 * the ones you have not made.
 */
/** A titled group, matching the inspector's rhythm. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <Label className="mb-2">{title}</Label>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground max-w-prose text-[12px] leading-[1.6]">{children}</p>;
}

export function SignalView({
  project, onWire, onSelect, selected,
}: {
  project: Project;
  onWire: (from: string, to: string) => void;
  onSelect: (uid: string) => void;
  selected: string | null;
}) {
  const audio = audioBlocks(project);
  const mods = modBlocks(project);
  const has = (from: string, to: string) => project.wires.some((w) => w.from === from && w.to === to);

  if (audio.length === 0) {
    return <Hint>Add a source or an effect block — nothing is in the audio path yet.</Hint>;
  }

  return (
    <div className="signal">
      <Section title="Audio routing">
        <Hint>
          Rows send, columns receive. A block only appears where its ports allow it — a source has no
          input, so it never shows as a destination.
        </Hint>

        <div className="matrix" style={{ gridTemplateColumns: `150px repeat(${audio.length}, 1fr)` }}>
          <span />
          {audio.map((b) => {
            const d = byType(b.type);
            return (
              <span key={b.uid} className={`matrix-col${d?.ports.audioIn ? "" : " dim"}`}>
                {b.name}
              </span>
            );
          })}

          {audio.map((from) => {
            const fd = byType(from.type);
            return (
              <Fragment key={from.uid}>
                <button
                  className={`matrix-row${selected === from.uid ? " on" : ""}`}
                  onClick={() => onSelect(from.uid)}
                >
                  {from.name}
                  <span className="matrix-from">{fd?.from.split(" · ")[0]}</span>
                </button>
                {audio.map((to) => {
                  const td = byType(to.type);
                  const legal = from.uid !== to.uid && !!fd?.ports.audioOut && !!td?.ports.audioIn;
                  return (
                    <button
                      key={`${from.uid}-${to.uid}`}
                      className={`cell${has(from.uid, to.uid) ? " wired" : ""}${legal ? "" : " illegal"}`}
                      disabled={!legal}
                      onClick={() => onWire(from.uid, to.uid)}
                      title={legal ? `${from.name} → ${to.name}` : "Not possible"}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </Section>

      {mods.length > 0 && (
        <Section title="Modulators">
          <Hint>
            These produce modulation rather than audio, so they sit outside the chain. Where each one
            lands is a Patch bay block on the face — routing modulation is part of the instrument, not
            part of the builder, which is why it is something you place rather than something up here.
          </Hint>
          <div className="mod-row">
            {mods.map((m) => (
              <button key={m.uid} className="mod-chip" onClick={() => onSelect(m.uid)}>
                {m.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
