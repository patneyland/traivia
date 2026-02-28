import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Users } from "lucide-react";
import { socket } from "../lib/socket";

function normalizeCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

function formatCode(value: string) {
  if (value.length <= 3) return value;
  return `${value.slice(0, 3)}-${value.slice(3, 6)}`;
}

export function JoinRoom() {
  const [, navigate] = useLocation();
  const initialCode = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    return normalizeCode(query.get("code") ?? "");
  }, []);

  const [roomCode, setRoomCode] = useState(initialCode);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [awaitingJoin, setAwaitingJoin] = useState(false);
  const awaitingJoinRef = useRef(false);

  useEffect(() => {
    const handleJoined = (payload: { room: { code: string } }) => {
      if (!awaitingJoinRef.current) return;
      awaitingJoinRef.current = false;
      setAwaitingJoin(false);
      navigate(`/room/${payload.room.code}`);
    };

    const handleError = (payload: { message: string }) => {
      if (!awaitingJoinRef.current) return;
      awaitingJoinRef.current = false;
      setAwaitingJoin(false);
      setError(payload.message);
    };

    socket.on("room_joined", handleJoined);
    socket.on("error", handleError);

    return () => {
      socket.off("room_joined", handleJoined);
      socket.off("error", handleError);
      awaitingJoinRef.current = false;
    };
  }, [navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const code = normalizeCode(roomCode);
    const name = username.trim();

    if (code.length !== 6) {
      setError("Please enter a valid room code");
      return;
    }

    if (!name) {
      setError("Please enter your name");
      return;
    }

    awaitingJoinRef.current = true;
    setAwaitingJoin(true);
    socket.emit("join_room", { code, playerName: name });
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 p-4">
      <div className="mx-auto flex h-full w-full max-w-lg items-center justify-center">
        <div className="w-full space-y-3">
          <div className="space-y-1 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-[3px] border-gray-800">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Join Room</h1>
            <p className="text-sm text-gray-600">Enter the room code to join</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-4 rounded-lg border-[3px] border-gray-800 bg-white p-4">
              <div className="space-y-2">
                <label htmlFor="roomCode" className="block text-sm font-medium">
                  Room Code
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={formatCode(roomCode)}
                  onChange={(event) => setRoomCode(normalizeCode(event.target.value))}
                  placeholder="ABC-DEF"
                  maxLength={7}
                  required
                  className="w-full rounded-lg border-2 border-gray-800 px-3 py-2.5 text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2"
                />
              </div>

              <div className="h-px bg-gray-800" />

              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium">
                  Your Name
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g., John Doe"
                  required
                  className="w-full rounded-lg border-2 border-gray-800 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border-2 border-red-600 bg-red-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="rounded-lg border-2 border-gray-800 bg-gray-50 p-3 text-xs">
                <span className="font-medium">Tip:</span> Get the room code from
                the host who created the trivia session
              </div>
            </div>

            <button
              type="submit"
              disabled={awaitingJoin}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {awaitingJoin ? "Joining..." : "Join Room"}
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full rounded-lg border-2 border-gray-800 bg-white px-6 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              Back
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
