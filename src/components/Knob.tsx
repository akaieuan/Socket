/**
 * The house rotary, in the browser.
 *
 * A port of skeleton's drawRotarySlider, and it has to stay a port: the whole
 * premise of Socket is that what you compose here is what the plugin looks like,
 * and a preview drawn in a slightly different dialect quietly breaks that
 * promise. Same geometry — a filled body so it reads as an object rather than a
 * diagram, a visible track so the range is legible, an arc that is greyscale
 * until you touch it, and a notch at the rim rather than a spoke to the hub.
 */

type Props = {
  value: number;
  label: string;
  size?: number;
  onChange?: (v: number) => void;
};

/** ~270 degrees of travel, matching the plugins. */
const SWEEP = 2.35;

export function Knob({ value, label, size = 46, onChange }: Props) {
  const r = size / 2;
  const thickness = Math.min(2.2, r * 0.2);
  const arcR = r - thickness / 2;
  const bodyR = arcR - thickness * 1.4;

  const angle = (value * 2 - 1) * SWEEP;
  const start = -SWEEP;

  const polar = (radius: number, a: number) => [
    r + radius * Math.sin(a),
    r - radius * Math.cos(a),
  ];

  const arc = (from: number, to: number, radius: number) => {
    const [x0, y0] = polar(radius, from);
    const [x1, y1] = polar(radius, to);
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };

  const [nx, ny] = polar(arcR - thickness * 1.1, angle);
  const [mx, my] = polar(arcR - thickness * 1.1 - Math.max(4, r * 0.3), angle);

  const drag = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startV = value;
    const move = (ev: PointerEvent) => {
      // Vertical drag, same sensitivity feel as the plugins.
      onChange(Math.max(0, Math.min(1, startV + (startY - ev.clientY) / 180)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="knob">
      <svg width={size} height={size} onPointerDown={drag} style={{ cursor: onChange ? "ns-resize" : "default" }}>
        {bodyR > 2 && <circle cx={r} cy={r} r={bodyR} fill="var(--card)" />}
        <path d={arc(start, SWEEP, arcR)} stroke="var(--border-strong)" strokeWidth={thickness} fill="none" strokeLinecap="round" />
        {value > 0 && (
          <path d={arc(start, angle, arcR)} stroke="var(--muted-foreground)" strokeWidth={thickness} fill="none" strokeLinecap="round" />
        )}
        <line x1={mx} y1={my} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={Math.max(2, thickness * 1.1)} strokeLinecap="round" />
      </svg>
      <span className="knob-label">{label}</span>
    </div>
  );
}
