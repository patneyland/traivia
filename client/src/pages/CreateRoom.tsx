import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Plus } from "lucide-react";
import { socket } from "../lib/socket";
import { setRoomMeta } from "../lib/room-meta";

export function CreateRoom() {
  const [, navigate] = useLocation();
  const [roomName, setRoomName] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [error, setError] = useState("");
  const [awaitingCreate, setAwaitingCreate] = useState(false);
  const awaitingCreateRef = useRef(false);
  const roomNameRef = useRef(roomName);
  const questionCountRef = useRef(questionCount);

  useEffect(() => {
    roomNameRef.current = roomName;
  }, [roomName]);

  useEffect(() => {
    questionCountRef.current = questionCount;
  }, [questionCount]);

  useEffect(() => {
    const handleJoined = (payload: {
      room: { code: string; timerSeconds: number; questionCount: number };
    }) => {
      if (!awaitingCreateRef.current) return;
      awaitingCreateRef.current = false;

      setAwaitingCreate(false);
      const latestRoomName = roomNameRef.current.trim();
      setRoomMeta(payload.room.code, { roomName: latestRoomName || undefined });

      const latestQuestionCount = questionCountRef.current;
      if (latestQuestionCount !== payload.room.questionCount) {
        socket.emit("update_settings", {
          questionCount: latestQuestionCount,
          timerSeconds: payload.room.timerSeconds,
        });
      }

      navigate(`/room/${payload.room.code}`);
    };

    const handleError = (payload: { message: string }) => {
      if (!awaitingCreateRef.current) return;
      awaitingCreateRef.current = false;
      setAwaitingCreate(false);
      setError(payload.message);
    };

    socket.on("room_joined", handleJoined);
    socket.on("error", handleError);

    return () => {
      socket.off("room_joined", handleJoined);
      socket.off("error", handleError);
      awaitingCreateRef.current = false;
    };
  }, []);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    awaitingCreateRef.current = true;
    setAwaitingCreate(true);
    socket.emit("create_room", {});
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 p-4">
      <div className="mx-auto flex h-full w-full max-w-lg items-center justify-center">
        <div className="w-full space-y-3">
          <div className="space-y-1 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-[3px] border-gray-800">
                <Plus className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Create Room</h1>
            <p className="text-sm text-gray-600">Set up a new trivia session</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-4 rounded-lg border-[3px] border-gray-800 bg-white p-4">
              <div className="space-y-2">
                <label htmlFor="roomName" className="block text-sm font-medium">
                  Room Name
                </label>
                <input
                  id="roomName"
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="e.g., Friday Night Trivia"
                  className="w-full rounded-lg border-2 border-gray-800 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="questionCount" className="block text-sm font-medium">
                  Number of Questions
                </label>
                <input
                  id="questionCount"
                  type="number"
                  min={10}
                  max={40}
                  value={questionCount}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(value)) {
                      setQuestionCount(Math.max(10, Math.min(40, value)));
                    }
                  }}
                  className="w-full rounded-lg border-2 border-gray-800 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2"
                />
                <p className="text-xs text-gray-500">Between 10 and 40</p>
              </div>

              <div className="space-y-1.5 rounded-lg border-2 border-gray-800 bg-gray-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-800" />
                  <span>A unique room code will be generated</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-800" />
                  <span>Share the code with others to join</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-800" />
                  <span>You&apos;ll be the room host</span>
                </div>
              </div>

            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border-2 border-red-600 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={awaitingCreate}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {awaitingCreate ? "Creating..." : "Create Room"}
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
