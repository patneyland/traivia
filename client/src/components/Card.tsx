import type { PropsWithChildren } from "react";
import { cn } from "../lib/utils";

type Props = PropsWithChildren<{ className?: string }>;

export function Card({ className, children }: Props) {
  return (
    <div
      className={cn(
        "rounded-3xl border-4 border-foreground bg-white/90 p-6 shadow-[8px_8px_0px_hsl(260_50%_10%/0.15)]",
        className
      )}
    >
      {children}
    </div>
  );
}
