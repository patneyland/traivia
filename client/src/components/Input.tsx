import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-pill border-4 border-foreground bg-white px-4 py-2 text-lg font-semibold text-foreground outline-none transition focus:shadow-[4px_4px_0px_hsl(260_50%_10%/0.2)]",
        className
      )}
      {...props}
    />
  );
}
