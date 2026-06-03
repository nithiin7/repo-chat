"use client";

import { useTheme } from "next-themes";
import { Toaster, toast } from "sonner";

export { toast };

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme as "light" | "dark"}
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm",
        },
      }}
    />
  );
}
