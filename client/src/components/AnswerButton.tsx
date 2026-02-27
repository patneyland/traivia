import { cn } from "../lib/utils";

type Props = {
  label: string;
  color: "red" | "blue" | "yellow" | "green";
  disabled?: boolean;
  onClick?: () => void;
  selected?: boolean;
};

const colorClasses = {
  red: "bg-gameRed text-white",
  blue: "bg-gameBlue text-white",
  yellow: "bg-gameYellow text-foreground",
  green: "bg-gameGreen text-white",
};

export function AnswerButton({
  label,
  color,
  disabled,
  onClick,
  selected,
}: Props) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "button-3d w-full text-left text-lg",
        colorClasses[color],
        selected && "outline outline-4 outline-foreground",
        disabled && "opacity-70"
      )}
    >
      {label}
    </button>
  );
}
