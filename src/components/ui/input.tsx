import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-card-border bg-card-alpha placeholder:text-muted-foreground/70 flex h-6.5 w-full min-w-0 rounded-md border px-2 py-1 text-[12px] transition-[color,box-shadow] outline-none",
        "hover:border-card-border-hover focus-visible:border-accent-blue focus-visible:ring-accent-blue/25 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
