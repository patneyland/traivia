import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import type { Room as RoomType } from "@trivia/shared";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  Check,
  Circle,
  Crown,
  Home,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { socket, pendingJoin, clearPendingJoin } from "../lib/socket";
import { getRoomMeta } from "../lib/room-meta";

const TOPICS = [
  "History",
  "Science",
  "Movies",
  "Music",
  "Sports",
  "Technology",
  "Art",
  "Geography",
  "Literature",
  "Food",
  "Nature",
  "Space",
];

function sortByScore(players: RoomType["players"]) {
  return [...players].sort((a, b) => b.score - a.score);
}

function formatCode(code: string) {
  if (code.includes("-")) return code;
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function aiQuips(interests: string[]) {
  if (!interests.length) return ["Building your custom quiz...", "Almost ready..."];
  return [
    `I spotted: ${interests.slice(0, 3).join(", ")}.`,
    "Balancing easy, medium, and hard questions.",
    "Finalizing distractors and answer keys.",
  ];
}

export function Room() {
  const [, params] = useRoute("/room/:code");
  const [, navigate] = useLocation();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [progress, setProgress] = useState({ message: "", percent: 0 });
  const [error, setError] = useState("");
  const [interests, setInterests] = useState(["", "", ""]);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStart, setQuestionStart] = useState(0);
  const [quipIndex, setQuipIndex] = useState(0);
  const autoStartedReadyKeyRef = useRef("");

  useEffect(() => {
    if (pendingJoin) {
      setRoom(pendingJoin.room);
      setPlayerId(pendingJoin.playerId);
      clearPendingJoin();
    }

    const onJoined = (payload: { room: RoomType; playerId: string }) => {
      setRoom(payload.room);
      setPlayerId(payload.playerId);
      clearPendingJoin();
    };

    const onUpdated = (payload: { room: RoomType }) => setRoom(payload.room);
    const onProgress = (payload: { message: string; percent: number }) => setProgress(payload);
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("room_joined", onJoined);
    socket.on("room_updated", onUpdated);
    socket.on("generation_progress", onProgress);
    socket.on("generation_error", onError);
    socket.on("error", onError);
    return () => {
      socket.off("room_joined", onJoined);
      socket.off("room_updated", onUpdated);
      socket.off("generation_progress", onProgress);
      socket.off("generation_error", onError);
      socket.off("error", onError);
    };
  }, []);

  useEffect(() => {
    if (!params?.code || !room) return;
    if (room.code !== params.code.toUpperCase()) navigate("/");
  }, [params?.code, room, navigate]);

  useEffect(() => {
    if (!room || room.state !== "playing" || !room.timerStartedAt) return;
    setSelectedChoice("");
    setQuestionStart(room.timerStartedAt);
    const tick = () => {
      const elapsed = (Date.now() - room.timerStartedAt) / 1000;
      setTimeLeft(Math.max(0, room.timerSeconds - elapsed));
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [room?.state, room?.currentQuestion, room?.timerStartedAt, room?.timerSeconds]);

  useEffect(() => {
    if (room?.state === "results") {
      confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
    }
  }, [room?.state]);

  const me = useMemo(
    () => room?.players.find((player) => player.id === playerId),
    [room, playerId]
  );
  const isHost = room?.hostId === playerId;
  const question = room?.questions[room.currentQuestion];
  const answers = room?.answers[String(room.currentQuestion)] ?? {};
  const sortedPlayers = useMemo(() => (room ? sortByScore(room.players) : []), [room]);
  const readyPlayers = room
    ? room.players.filter((player) => player.hasSubmittedInterests).length
    : 0;
  const canStartGame = room
    ? room.players.length > 0 && room.players.every((player) => player.hasSubmittedInterests)
    : false;
  const roomName = room
    ? getRoomMeta(room.code)?.roomName || `Room ${formatCode(room.code)}`
    : "Trivia Room";
  const currentInterests = room ? room.players.flatMap((player) => player.interests) : [];
  const quips = aiQuips(currentInterests);
  const myAnswer = (answers[playerId]?.choice as string | undefined) ?? selectedChoice;
  const answeredPlayers = room?.answeredCount ?? 0;
  const submittedInterests = Boolean(me?.hasSubmittedInterests);

  useEffect(() => {
    if (!me) return;
    if (room?.state !== "lobby" && room?.state !== "collecting_interests") return;
    if (!me.hasSubmittedInterests || !me.interests.length) return;
    const next = [...me.interests.slice(0, 3)];
    while (next.length < 3) next.push("");
    setInterests(next);
  }, [me, room?.state]);

  useEffect(() => {
    if (room?.state !== "generating") return;
    setQuipIndex(0);
    const interval = window.setInterval(() => {
      setQuipIndex((index) => (index + 1) % quips.length);
    }, 5500);
    return () => window.clearInterval(interval);
  }, [room?.state, quips.length]);

  useEffect(() => {
    if (!room || !isHost || room.state !== "ready") return;
    const key = `${room.code}:${room.currentQuestion}`;
    if (autoStartedReadyKeyRef.current === key) return;
    autoStartedReadyKeyRef.current = key;
    socket.emit("start_question");
  }, [room, isHost]);

  if (!room) {
    return (
      <div className="h-screen bg-gray-50 p-4">
        <div className="mx-auto flex h-full max-w-lg items-center justify-center">
          <div className="w-full rounded-lg border-[3px] border-gray-800 bg-white p-4 text-center">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin" />
            <h2 className="mt-2 text-2xl font-bold">Connecting...</h2>
            <p className="text-sm text-gray-600">Waiting for room data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-[3px] border-gray-800">
              {isHost ? <Crown className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-xl font-bold">{roomName}</h1>
              <p className="text-xs text-gray-600">
                {isHost ? "You are the host" : `Playing as ${me?.name ?? "Guest"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Users className="h-4 w-4" />
            <span>{room.players.length} players</span>
          </div>
        </div>

        {(room.state === "lobby" || room.state === "collecting_interests") && (
          <>
            {isHost ? (
              <>
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="space-y-3 md:col-span-2">
                    <div className="space-y-2 rounded-lg border-[3px] border-gray-800 bg-white p-4 text-center">
                      <p className="text-xs font-medium text-gray-600">Scan to join</p>
                      <div className="flex justify-center">
                        <div className="rounded-lg border-2 border-gray-800 bg-white p-3">
                          <QRCodeSVG
                            value={`${window.location.origin}/join-room?code=${room.code}`}
                            size={120}
                          />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-gray-600">Room Code</p>
                      <div className="flex gap-2">
                        <div className="w-full rounded-lg border-2 border-gray-800 bg-gray-50 px-3 py-2 text-xl font-bold tracking-widest">
                          {formatCode(room.code)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 rounded-lg border-2 border-gray-800 bg-white p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions</span>
                        <span>{room.questionCount}</span>
                      </div>
                      <div className="h-px bg-gray-200" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Interests/player</span>
                        <span>3</span>
                      </div>
                      <div className="h-px bg-gray-200" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">AI-generated</span>
                        <Sparkles className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-3 rounded-lg border-[3px] border-gray-800 bg-white">
                    <div className="flex items-center justify-between border-b-2 border-gray-800 p-3">
                      <h2 className="font-semibold">Players</h2>
                      <span className="text-xs text-gray-500">
                        {readyPlayers}/{room.players.length} ready
                      </span>
                    </div>
                    <div className="space-y-2 p-3">
                      {room.players.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between rounded-lg border-2 border-gray-800 bg-white p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-sm font-bold text-white">
                              {initial(player.name)}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{player.name}</div>
                              <div className="text-xs text-gray-500">Joined room</div>
                            </div>
                          </div>
                          {player.hasSubmittedInterests ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />
                          )}
                        </div>
                      ))}
                      {room.players.length === 0 && (
                        <div className="rounded-lg border-2 border-dashed border-gray-400 p-3 text-center text-sm text-gray-500">
                          Waiting for players to join...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate("/")}
                    className="rounded-lg border-2 border-gray-800 bg-white px-6 py-2.5 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => socket.emit("start_game")}
                    disabled={!canStartGame}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-800 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" />
                    {canStartGame ? "Start Game" : "Waiting for Player Interests..."}
                  </button>
                </div>
              </>
            ) : !submittedInterests ? (
              <div className="mx-auto max-w-lg space-y-3">
                <div className="space-y-3 rounded-lg border-[3px] border-gray-800 bg-white p-4">
                  <h2 className="text-center text-2xl font-bold">Your Interests</h2>
                  {interests.map((interest, index) => (
                    <div key={index} className="space-y-1">
                      <label className="text-xs font-medium">Interest {index + 1}</label>
                      <div className="relative">
                        <input
                          value={interest}
                          onChange={(event) => {
                            const next = [...interests];
                            next[index] = event.target.value;
                            setInterests(next);
                          }}
                          className="w-full rounded-lg border-2 border-gray-800 px-3 py-2.5 pr-9"
                        />
                        {interest && (
                          <button
                            onClick={() => {
                              const next = [...interests];
                              next[index] = "";
                              setInterests(next);
                            }}
                            className="absolute right-2 top-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5">
                    {TOPICS.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => {
                          const next = [...interests];
                          const empty = next.findIndex((value) => !value.trim());
                          if (empty >= 0) next[empty] = topic;
                          setInterests(next);
                        }}
                        className="rounded-lg border-2 border-gray-800 px-2.5 py-1 text-xs font-medium"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() =>
                    socket.emit("submit_interests", {
                      interests: interests.filter((value) => value.trim()),
                    })
                  }
                  className="w-full rounded-lg bg-gray-800 px-6 py-3 font-medium text-white"
                >
                  Submit Interests
                </button>
              </div>
            ) : (
              <div className="mx-auto max-w-lg rounded-lg border-[3px] border-gray-800 bg-white p-6 text-center">
                <LoaderCircle className="mx-auto h-7 w-7 animate-spin" />
                <h2 className="mt-3 text-xl font-bold">Waiting for Game to Start</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Your interests are submitted. Waiting for the host to begin.
                </p>
              </div>
            )}
          </>
        )}

        {(room.state === "generating" || room.state === "ready") && (
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="space-y-1 text-center">
              <Sparkles className="mx-auto h-8 w-8" />
              <h2 className="text-2xl font-bold">Generating Your Quiz</h2>
              <p className="text-sm text-gray-600">
                {progress.message || "AI is creating personalized questions..."}
              </p>
            </div>
            <div className="rounded-lg border-[3px] border-gray-800 bg-yellow-50 p-4">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5" />
                <p className="text-sm italic">{quips[quipIndex]}</p>
              </div>
            </div>
            <div className="rounded-lg border-[3px] border-gray-800 bg-white p-4">
              <div className="mb-2 flex justify-between text-xs font-medium">
                <span>Progress</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-gray-800">
                <div className="h-full bg-gray-800" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>
        )}

        {room.state === "playing" && !question && (
          <div className="mx-auto max-w-lg rounded-lg border-[3px] border-gray-800 bg-white p-6 text-center">
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin" />
            <h2 className="mt-3 text-xl font-bold">Loading Question</h2>
            <p className="mt-1 text-sm text-gray-600">Please wait...</p>
          </div>
        )}

        {room.state === "playing" && question && (
          <div className="space-y-3">
            <div className="space-y-3">
              <div className={`rounded-lg border-2 border-gray-800 bg-white ${isHost ? "p-5" : "p-3"}`}>
                <div className={`flex items-center justify-between ${isHost ? "text-xl font-semibold" : "text-sm"}`}>
                  <span>Q{room.currentQuestion + 1}/{room.questions.length}</span>
                  <span className={`flex items-center ${isHost ? "gap-2" : "gap-1"}`}>
                    <Timer className={isHost ? "h-6 w-6" : "h-4 w-4"} />
                    {Math.ceil(timeLeft)}s
                  </span>
                </div>
              </div>
              <div
                className={`rounded-lg border-[3px] border-gray-800 bg-white ${isHost ? "space-y-4 p-8" : "space-y-2 p-4"}`}
              >
                <h3 className={isHost ? "text-5xl font-semibold leading-tight" : "text-2xl font-semibold leading-tight"}>
                  {question.text}
                </h3>
                {isHost
                  ? (
                      <div className="grid grid-cols-2 gap-4">
                        {question.options.map((option) => (
                          <div
                            key={option}
                            className="flex min-h-[112px] w-full items-center gap-4 rounded-lg border-2 border-gray-300 bg-gray-50 p-5 text-left"
                          >
                            <Circle className="h-8 w-8" />
                            <span className="text-2xl font-medium leading-tight">{option}</span>
                          </div>
                        ))}
                      </div>
                    )
                  : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {question.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              if (selectedChoice) return;
                              setSelectedChoice(option);
                              socket.emit("submit_answer", {
                                choice: option,
                                timeMs: Date.now() - questionStart,
                              });
                            }}
                            disabled={Boolean(selectedChoice)}
                            className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left ${selectedChoice === option ? "border-gray-800 bg-gray-100" : "border-gray-800 bg-white"}`}
                          >
                            {selectedChoice === option ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                            <span className="text-sm font-medium">{option}</span>
                          </button>
                        ))}
                      </div>
                    )}
                {isHost && (
                  <div className="mt-4 rounded-lg border-2 border-gray-800 bg-gray-50 p-5">
                    <div className="mb-2 text-xl text-gray-700">
                      Answers received: {answeredPlayers}/{room.players.length}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {room.state === "revealing" && question && (
          <div className={isHost ? "grid gap-5 lg:grid-cols-5" : "space-y-3"}>
            <div
              className={`rounded-lg border-[3px] border-gray-800 bg-white ${isHost ? "space-y-4 p-8 lg:col-span-3" : "space-y-3 p-4"}`}
            >
              <h3 className={isHost ? "text-5xl font-semibold leading-tight" : "text-2xl font-semibold leading-tight"}>
                {question.text}
              </h3>
              <div className={isHost ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-2 sm:grid-cols-2"}>
                {question.options.map((option) => {
                  const count = room.players.filter(
                    (player) => answers[player.id]?.choice === option
                  ).length;
                  const correct = option === question.answer;
                  const mine = myAnswer === option;
                  return (
                    <div
                      key={option}
                      className={`flex items-center justify-between rounded-lg border-2 ${isHost ? "min-h-[112px] p-5" : "p-3"} ${correct ? "border-green-600 bg-green-50" : mine ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"}`}
                    >
                      <span className={isHost ? "text-2xl font-medium leading-tight" : "font-medium"}>{option}</span>
                      <span className={isHost ? "text-2xl font-bold" : "text-sm font-bold"}>{count}</span>
                    </div>
                  );
                })}
              </div>
              {isHost && (
                <button
                  onClick={() => socket.emit("next_question")}
                  className={`w-full rounded-lg bg-gray-800 font-medium text-white ${isHost ? "px-8 py-4 text-xl" : "px-6 py-3"}`}
                >
                  {room.currentQuestion + 1 >= room.questions.length ? "See Final Results" : "Next Question"}
                </button>
              )}
            </div>
            {isHost && (
              <div className="lg:col-span-2 rounded-lg border-[3px] border-gray-800 bg-white p-6">
                <h3 className="mb-3 text-2xl font-semibold">Leaderboard</h3>
                <div className="space-y-2">
                  {sortedPlayers.map((player, index) => (
                    <div key={player.id} className="flex justify-between rounded-lg border border-gray-200 px-4 py-3 text-xl">
                      <span>{index + 1}. {player.name}</span><span className="font-bold">{player.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {room.state === "results" && (
          <div className="mx-auto max-w-lg space-y-3">
            <div className="space-y-1 text-center">
              <Trophy className="mx-auto h-8 w-8" />
              <h2 className="text-2xl font-bold">Final Results</h2>
            </div>
            <div className="rounded-lg border-[3px] border-gray-800 bg-white p-4">
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="font-medium">{index + 1}. {player.name}</span>
                    <span className="font-bold">{player.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate("/")} className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-gray-800 bg-white px-6 py-3 text-sm font-medium">
                <Home className="h-4 w-4" />Home
              </button>
              <button
                onClick={() => (isHost ? socket.emit("collect_interests") : navigate("/"))}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-800 px-6 py-3 text-sm font-medium text-white"
              >
                <RotateCcw className="h-4 w-4" />Play Again
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border-2 border-red-600 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
