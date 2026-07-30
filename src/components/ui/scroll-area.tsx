import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

/**
 * `fitWidth` stops the content sizing to itself.
 *
 * Radix wraps the viewport's children in a `display: table` div so wide content
 * can scroll sideways. That is right for a routing matrix and wrong for a
 * fixed-width panel: the inspector's sections sized to their own content rather
 * than to the 256px column, and everything in them sat fifteen pixels past the
 * right edge of the window. A panel that should never scroll sideways says so.
 */
function ScrollArea({
  className, children, fitWidth = false, ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & { fitWidth?: boolean }) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "focus-visible:ring-ring/40 size-full rounded-[inherit] outline-none focus-visible:ring-[3px]",
          fitWidth && "[&>div]:!block [&>div]:!w-full",
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className, orientation = "vertical", ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb data-slot="scroll-area-thumb" className="bg-border-strong relative flex-1 rounded-full" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
