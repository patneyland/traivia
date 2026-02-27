import type { Player } from "@trivia/shared";
import { cn } from "../lib/utils";

type Props = {
  player: Player;
  status?: "thinking" | "ready";
};

export function PlayerBadge({ player, status }: Props) {
  return (
    <div className="flex items-center justify-between rounded-3xl border-4 border-foreground bg-white px-4 py-3 shadow-[4px_4px_0px_hsl(260_50%_10%/0.15)]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-foreground bg-secondary text-center text-lg font-bold leading-8 text-white">
          {player.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="text-lg font-semibold">{player.name}</div>
          {player.isHost && (
            <div className="text-xs font-bold uppercase text-secondary">
              Host
            </div>
          )}
        </div>
      </div>
      {status && (
        <span
          className={cn(
            "rounded-pill border-2 border-foreground px-3 py-1 text-xs font-bold uppercase",
            status === "ready" ? "bg-accent text-foreground" : "bg-muted"
          )}
        >
          {status === "ready" ? "Ready" : "Thinking"}
        </span>
      )}
    </div>
  );
}
