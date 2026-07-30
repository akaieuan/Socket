/**
 * The parameter controls that appear on a plugin face.
 *
 * Ports of skeleton's LookAndFeel, and they have to stay ports: Socket's premise
 * is that what you compose is what the plugin looks like, and a preview drawn in
 * a slightly different dialect breaks that quietly.
 *
 * Everything that is not a parameter — screens, patch bays, keyboards — lives in
 * faces.tsx. The split is between what a plugin *exposes* and what it *shows*.
 */

const SWEEP = 2.35;

/**
 * Vertical drag, shared by every continuous control.
 *
 * 180px of travel for the full range: short enough to reach an extreme without
 * running out of screen, long enough that a knob is not twitchy. The same
 * number in both controls is what makes them feel like one instrument.
 */
function verticalDrag(value: number, onChange?: (v: number) => void) {
  return (e: React.PointerEvent) => {
    if (!onChange) return;
    e.stopPropagation();
    const y0 = e.clientY;
    const move = (ev: PointerEvent) =>
      onChange(Math.max(0, Math.min(1, value + (y0 - ev.clientY) / 180)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

export function Knob({
  value, label, size = 46, onChange,
}: { value: number; label: string; size?: number; onChange?: (v: number) => void }) {
  const r = size / 2;
  const thickness = Math.min(2.2, r * 0.2);
  const arcR = r - thickness / 2;
  const bodyR = arcR - thickness * 1.4;
  const angle = (value * 2 - 1) * SWEEP;

  const polar = (rad: number, a: number) => [r + rad * Math.sin(a), r - rad * Math.cos(a)];
  const arc = (from: number, to: number, rad: number) => {
    const [x0, y0] = polar(rad, from);
    const [x1, y1] = polar(rad, to);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${Math.abs(to - from) > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const [nx, ny] = polar(arcR - thickness * 1.1, angle);
  const [mx, my] = polar(arcR - thickness * 1.1 - Math.max(4, r * 0.3), angle);

  return (
    <div className="knob">
      <svg
        width={size}
        height={size}
        onPointerDown={verticalDrag(value, onChange)}
        style={{ cursor: onChange ? "ns-resize" : "default" }}
      >
        {bodyR > 2 && <circle cx={r} cy={r} r={bodyR} fill="var(--card)" />}
        <path d={arc(-SWEEP, SWEEP, arcR)} stroke="var(--border-strong)" strokeWidth={thickness} fill="none" strokeLinecap="round" />
        {value > 0 && (
          <path d={arc(-SWEEP, angle, arcR)} stroke="var(--muted-foreground)" strokeWidth={thickness} fill="none" strokeLinecap="round" />
        )}
        <line x1={mx} y1={my} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={Math.max(2, thickness * 1.1)} strokeLinecap="round" />
      </svg>
      <span className="knob-label">{label}</span>
    </div>
  );
}

/**
 * A fader.
 *
 * Not a knob rotated. Where several values are read against each other — EQ
 * bands, mixer channels — a row of faders draws the shape of the setting and a
 * row of knobs does not.
 */
export function Fader({
  value, label, height = 52, onChange,
}: { value: number; label: string; height?: number; onChange?: (v: number) => void }) {
  return (
    <div className="fader">
      <div
        className="fader-track"
        style={{ height, cursor: onChange ? "ns-resize" : "default" }}
        onPointerDown={verticalDrag(value, onChange)}
      >
        <span className="fader-fill" style={{ height: `${value * 100}%` }} />
        <span className="fader-cap" style={{ bottom: `calc(${value * 100}% - 3px)` }} />
      </div>
      <span className="knob-label">{label}</span>
    </div>
  );
}

export function Choice({
  label, options, index, onCycle,
}: { label: string; options: string[]; index: number; onCycle: () => void }) {
  return (
    <div className="choice">
      <button className="choice-box" onPointerDown={(e) => { e.stopPropagation(); onCycle(); }}>
        {options[index % options.length]}
      </button>
      <span className="knob-label">{label}</span>
    </div>
  );
}

export function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="choice">
      <button
        className={`toggle-box${on ? " on" : ""}`}
        onPointerDown={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {on ? "ON" : "OFF"}
      </button>
      <span className="knob-label">{label}</span>
    </div>
  );
}
