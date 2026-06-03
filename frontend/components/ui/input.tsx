import { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input
    className={cn(
      "border-border bg-background placeholder:text-muted-foreground/50 focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none",
      className
    )}
    {...props}
  />
);
