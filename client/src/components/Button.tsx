import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/utils";

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
  }
>;

export function Button({ variant = "primary", className, ...props }: Props) {
  const base =
    "button-3d inline-flex items-center justify-center gap-2 text-foreground";
  const styles = {
    primary: "bg-primary text-white",
    secondary: "bg-secondary text-white",
    ghost: "bg-white",
  };
  return (
    <button className={cn(base, styles[variant], className)} {...props} />
  );
}
