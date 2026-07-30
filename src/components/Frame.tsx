import type { ReactNode } from "react";
import type { PluginState } from "../plugin";

/**
 * The plugin window itself.
 *
 * Draws the chrome the instruments actually have — a wordmark, a preset strip,
 * page tabs, an output meter — so the thing being laid out reads as a plugin
 * rather than as a container. None of it is functional; it is there because a
 * layout without its surroundings is not a layout you can judge.
 *
 * Scaled to fit rather than scrolled. A plugin editor is fixed-size, and seeing
 * the whole face at once is the entire reason for having a frame — cropping it
 * would put back the problem the frame exists to solve.
 */
export function Frame({
  plugin,
  scale,
  children,
}: {
  plugin: PluginState;
  scale: number;
  children: ReactNode;
}) {
  return (
    <div
      className="frame-scaler"
      style={{ width: plugin.size.w * scale, height: plugin.size.h * scale }}
    >
      <div
        className="frame"
        style={{
          width: plugin.size.w,
          height: plugin.size.h,
          transform: `scale(${scale})`,
          ["--plugin-accent" as string]: `var(--accent-${plugin.accent})`,
        }}
      >
        <header className="frame-head">
          <span className="frame-word">{plugin.name}</span>
          <span className="frame-preset">Init</span>
          <span className="frame-tabs">
            <span className="frame-tab on">Main</span>
            <span className="frame-tab">FX</span>
          </span>
          <span className="frame-meter" />
        </header>

        <div className="frame-body">{children}</div>

        <footer className="frame-foot">
          <span>{plugin.size.w} × {plugin.size.h}</span>
        </footer>
      </div>
    </div>
  );
}
