import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from "@trivia/shared";

const url =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, {
  autoConnect: true,
});

/** Cached room_joined payload so late-mounting components can read it. */
export let pendingJoin: { room: Room; playerId: string } | null = null;

export function clearPendingJoin() {
  pendingJoin = null;
}

socket.on("room_joined", (payload) => {
  pendingJoin = payload;
});
