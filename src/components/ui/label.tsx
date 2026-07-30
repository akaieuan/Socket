import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-muted-foreground flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
