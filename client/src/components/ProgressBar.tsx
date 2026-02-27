type Props = {
  value: number;
};

export function ProgressBar({ value }: Props) {
  return (
    <div className="h-4 w-full rounded-pill border-2 border-foreground bg-white">
      <div
        className="h-full rounded-pill bg-accent transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
