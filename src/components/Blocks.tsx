/**
 * The block inventory, stated honestly.
 *
 * Socket composes plugins out of blocks. Today the design blocks exist and the
 * DSP blocks do not — every oscillator, filter and effect is still welded inside
 * bleep, enzyme and i4 rather than extracted. So the shell shows what is
 * actually available and what is not, rather than a palette of things that would
 * produce silence.
 *
 * Same convention as akaVST's /demo/skeleton: an inventory with status, because
 * the gap is the useful part.
 */

type Status = "ships" | "planned";

type Block = { name: string; blurb: string; status: Status; group: string };

const BLOCKS: Block[] = [
  { group: "Design", name: "Palette", status: "ships", blurb: "Generated from akaVST's token source — the same colours the instruments compile against." },
  { group: "Design", name: "LookAndFeel", status: "ships", blurb: "One drawing layer: flat states, hairline separation, accent as punctuation." },
  { group: "Design", name: "Knob", status: "ships", blurb: "The house rotary — body, arc, notch, greyscale until you touch it." },
  { group: "Design", name: "PixelRack", status: "ships", blurb: "The animated screen, driven by a four-method device contract." },

  { group: "Sound", name: "Oscillator", status: "planned", blurb: "Lives in bleep's Voice. Needs extracting before anything here can make a sound." },
  { group: "Sound", name: "Filter", status: "planned", blurb: "Ladder filter, four modes. Currently welded into bleep and enzyme separately." },
  { group: "Sound", name: "Envelope", status: "planned", blurb: "ADSR. Three implementations across three plugins, none of them shared." },
  { group: "Sound", name: "FX chain", status: "planned", blurb: "Chorus, phaser, bitcrush, delay, reverb — bleep's FxChain, not yet a block." },
  { group: "Sound", name: "Granular", status: "planned", blurb: "i4's Mosaic engine." },
  { group: "Sound", name: "Resonator", status: "planned", blurb: "i4's 48-band Ring." },

  { group: "Output", name: "Codegen", status: "planned", blurb: "Turn a composition into a buildable JUCE project. The last piece, and the largest." },
];

const GROUPS = ["Design", "Sound", "Output"];

export function Blocks() {
  const shipping = BLOCKS.filter((b) => b.status === "ships").length;

  return (
    <>
      <p className="label">
        {shipping} of {BLOCKS.length} blocks available
      </p>
      <p style={{ maxWidth: "44rem", marginTop: "0.75rem", lineHeight: 1.6, color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
        Socket builds plugins by composing blocks. The design layer is real and shared with the
        instruments; the sound layer is not extracted yet, so nothing here makes noise. Naming that
        is more useful than a palette of blocks that would produce silence.
      </p>

      {GROUPS.map((group) => (
        <section key={group} style={{ marginTop: "2rem" }}>
          <p className="label">{group}</p>
          <div className="grid" style={{ marginTop: "0.75rem" }}>
            {BLOCKS.filter((b) => b.group === group).map((b) => (
              <div className="card" key={b.name}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    className="dot"
                    style={{ background: b.status === "ships" ? "var(--accent-green)" : "var(--muted-foreground)" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>{b.name}</span>
                </div>
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.8rem", lineHeight: 1.55, color: "var(--muted-foreground)" }}>
                  {b.blurb}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
