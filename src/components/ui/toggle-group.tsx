import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<{ size?: "sm" | "default" }>({});

function ToggleGroup({
  className, size = "default", children, ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { size?: "sm" | "default" }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("group/toggle-group flex w-fit items-center gap-px rounded-md", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className, children, ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const { size } = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-size={size}
      className={cn(
        "border-card-border bg-card-alpha text-muted-foreground inline-flex flex-1 items-center justify-center gap-1 border whitespace-nowrap transition-colors duration-150 ease-out",
        "hover:text-foreground data-[state=on]:bg-accent-blue data-[state=on]:text-primary-foreground data-[state=on]:border-accent-blue",
        "focus-visible:ring-accent-blue/30 outline-none focus-visible:ring-[3px]",
        "rounded-none first:rounded-l-md last:rounded-r-md",
        size === "sm" ? "h-6 gap-1.5 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]",
        "font-mono tracking-wide",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
