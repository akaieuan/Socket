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
  project, page, onPage, scale, children, bodyRef,
}: {
  project: Project;
  page: number;
  onPage: (i: number) => void;
  scale: number;
  children: ReactNode;
  /** The grid itself, so the layout view can measure it for FLIP. */
  bodyRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="frame-scaler" style={{ width: project.size.w * scale, height: project.size.h * scale }}>
      <div
        className="frame"
        style={{
          width: project.size.w,
          height: project.size.h,
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
          <span>{project.size.w} × {project.size.h}</span>
          <span>{project.pages[page]?.blocks.length ?? 0} blocks on {project.pages[page]?.name}</span>
        </footer>
      </div>
    </div>
  );
}
