import type { ReactNode } from "react";

/**
 * The inspector's control vocabulary.
 *
 * Every rail in Socket composes from these rather than styling its own inputs.
 * That is not tidiness for its own sake: the rails multiply as the tool grows —
 * project, page, block, parameter, signal — and a bespoke row in each is how a
 * panel ends up looking subtly unlike the one next to it.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sec">
      <p className="label">{title}</p>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-body">{children}</div>
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="text-input"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Slider({
  value, min = 0, max = 1, step = 0.01, onChange,
}: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input
      className="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`seg${o.value === value ? " on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="stack">{children}</div>;
}

export function ListButton({
  title, subtitle, active, onClick, onRemove,
}: {
  title: string;
  subtitle?: string;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className={`list-btn${active ? " on" : ""}`}>
      <button className="list-main" onClick={onClick}>
        <span className="list-title">{title}</span>
        {subtitle && <span className="list-sub">{subtitle}</span>}
      </button>
      {onRemove && (
        <button className="list-x" onClick={onRemove} aria-label={`Remove ${title}`}>
          ×
        </button>
      )}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}

export function IconButton({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="icon-btn" onClick={onClick} disabled={disabled} aria-label={label}>
      {label}
    </button>
  );
}
