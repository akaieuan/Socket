import type { ReactNode } from "react";
import type { Project } from "../model/types";

/**
 * The plugin window.
 *
 * Its tabs are real now — clicking one switches the page being laid out, the way
 * it would in the built plugin. Painted-on tabs were the tell that this was a
 * layout tool rather than an editor: a plugin is not one face, and pretending
 * otherwise means the second page has nowhere to exist.
 *
 * Scaled to fit rather than scrolled, because a plugin editor is fixed-size and
 * seeing all of it at once is the whole reason for having a frame.
 */
export function Frame({
  project, page, onPage, scale, box, children, bodyRef,
}: {
  project: Project;
  page: number;
  onPage: (i: number) => void;
  scale: number;
  /** What it is actually drawn at — the same as size, unless it is fitting. */
  box: { w: number; h: number };
  children: ReactNode;
  /** The grid itself, so the layout view can measure it for FLIP. */
  bodyRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="frame-scaler" style={{ width: box.w * scale, height: box.h * scale }}>
      <div
        className="frame"
        style={{
          width: box.w,
          height: box.h,
          transform: `scale(${scale})`,
          ["--plugin-accent" as string]: `var(--accent-${project.accent})`,
        }}
      >
        <header className="frame-head">
          <span className="frame-word">{project.name}</span>
          <span className="frame-preset">Init</span>
          <span className="frame-tabs">
            {project.pages.map((pg, i) => (
              <button
                key={pg.id}
                className={`frame-tab${i === page ? " on" : ""}`}
                onClick={(e) => { e.stopPropagation(); onPage(i); }}
              >
                {pg.name}
              </button>
            ))}
          </span>
          <span className="frame-meter" />
        </header>

        <div className="frame-body" ref={bodyRef}>{children}</div>

        <footer className="frame-foot">
          {/* The pixels it would ship at, not the ones it happens to be scaled
              to — a plugin ships at a number even when you designed it by
              filling the window. */}
          <span>{box.w} × {box.h}{project.size.fit ? " · fit" : ""}</span>
          <span>{project.pages[page]?.blocks.length ?? 0} blocks on {project.pages[page]?.name}</span>
        </footer>
      </div>
    </div>
  );
}
